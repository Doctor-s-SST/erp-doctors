"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"

// Icons
import {
    Activity,
    Upload,
    Users,
    AlertCircle,
    CheckCircle2,
    Layers,
    Clock,
    FileText,
    UserCheck,
    Send,
    Save,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
    Clock3,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
} from "lucide-react"

// Recharts Components
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LabelList
} from "recharts"

import { CardIndicador } from "@/components/atendimento/dashboards/CardIndicator"
import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const THEME_COLORS = {
    primary: "#317bbd",
    secondary: "#ec801a",
    success: "#10b981",
    danger: "#ef4444",
    violet: "#6366f1",
    warning: "#f59e0b",
    slate: "#64748b",
    legendBackground: "#0A2647",
};

function possuiAsoMontado(observacao?: string): boolean {

    if (!observacao) return false;

    const texto = observacao.toLowerCase();

    return (
        texto.includes("aso montado") ||
        texto.includes("aso emitido") ||
        texto.includes("montado")
    );
}

type ViewType = "geral" | "pendencias" | "concluidos";

type FiltroTipoExame =
    | "todos"
    | "clinico"
    | "complementar";


/* ============================================================
   CLASSIFICAÇÃO DO TIPO DE EXAME
============================================================ */

function classificarTipoExame(
    funcionario: any
): "clinico" | "complementar" {

    const exames =
        funcionario?.listaExamesResumida;

    if (
        !Array.isArray(exames) ||
        exames.length === 0
    ) {
        return "clinico";
    }

    const somenteClinicos =
        exames.every((exame: any) => {

            const descricao =
                String(
                    exame?.descricaoExame ||
                    exame?.nomeExame ||
                    exame?.nome ||
                    exame ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            if (!descricao) {
                return true;
            }

            return (
                descricao.includes("exame clínico") ||
                descricao.includes("exame clinico") ||
                descricao.includes("acuidade visual")
            );
        });

    return somenteClinicos
        ? "clinico"
        : "complementar";
}


/* ============================================================
   ORDENAÇÃO
============================================================ */

const compararValores = (
    a: any,
    b: any,
    key: string
) => {

    let valA = a[key];
    let valB = b[key];

    if (key === "statusVencimento") {

        valA =
            a.statusVencimento?.label || "";

        valB =
            b.statusVencimento?.label || "";

    } else if (key === "examesList") {

        valA =
            Array.isArray(a.examesList)
                ? a.examesList.join(", ")
                : "";

        valB =
            Array.isArray(b.examesList)
                ? b.examesList.join(", ")
                : "";
    }

    if (
        valA === null ||
        valA === undefined
    ) {
        return 1;
    }

    if (
        valB === null ||
        valB === undefined
    ) {
        return -1;
    }

    if (typeof valA === "string") {

        return valA.localeCompare(
            String(valB)
        );
    }

    return valA > valB
        ? 1
        : valA < valB
            ? -1
            : 0;
};


/* ============================================================
   DATA BR
============================================================ */

function parseDateBR(
    dateStr: string | null
): Date | null {

    if (!dateStr) {
        return null;
    }

    const parts =
        dateStr.split("/");

    if (parts.length !== 3) {
        return null;
    }

    return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0])
    );
}


/* ============================================================
   OBTÉM O MAIOR PRAZO ENTRE OS EXAMES
============================================================ */

function obterMaiorPrazo(
    exames: any[],
    prazosMap: Record<string, number>
): number | null {

    let maiorPrazo:
        number | null = null;

    if (!Array.isArray(exames)) {
        return null;
    }

    exames.forEach((exame: any) => {

        const nomeExame =
            String(
                exame?.descricaoExame ||
                exame?.nomeExame ||
                exame?.nome ||
                exame ||
                ""
            )
                .trim()
                .toLowerCase();

        if (!nomeExame) {
            return;
        }

        const prazo =
            prazosMap[nomeExame];

        if (
            prazo !== undefined &&
            (
                maiorPrazo === null ||
                prazo > maiorPrazo
            )
        ) {
            maiorPrazo = prazo;
        }
    });

    return maiorPrazo;
}


/* ============================================================
   STATUS SIMPLES — UTILIZADO NOS INDICADORES
============================================================ */

function obterStatusVencimento(
    dataFicha: string | null,
    prazoDias: number | null
): "vencido" | "no_prazo" | "sem_prazo" {

    if (
        !dataFicha ||
        prazoDias === null
    ) {
        return "sem_prazo";
    }

    const dataBase =
        parseDateBR(dataFicha);

    if (!dataBase) {
        return "sem_prazo";
    }

    const dataLimite =
        new Date(dataBase);

    dataLimite.setDate(
        dataLimite.getDate() +
        prazoDias
    );

    const hoje =
        new Date();

    hoje.setHours(
        0,
        0,
        0,
        0
    );

    const diffTime =
        dataLimite.getTime() -
        hoje.getTime();

    const diffDays =
        Math.ceil(
            diffTime /
            (1000 * 60 * 60 * 24)
        );

    if (diffDays < 0) {
        return "vencido";
    }

    return "no_prazo";
}


/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */

export default function IndicadoresSocged() {

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const [view, setView] =
        useState<ViewType>("geral");

    const [unidadeId, setUnidadeId] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [dadosRelatorio, setDadosRelatorio] =
        useState<any[]>([]);

    const [dadosGraficos, setDadosGraficos] =
        useState<any>(null);

    const [prazosMap, setPrazosMap] =
        useState<Record<string, number>>({});

    const [funcionariosSalvos, setFuncionariosSalvos] =
        useState<Set<string>>(new Set());

    const [filtroTipoExame, setFiltroTipoExame] =
        useState<FiltroTipoExame>("todos");


    /* ============================================================
       CONTEXTO DO USUÁRIO
    ============================================================ */

    useEffect(() => {

        const fetchUserContext =
            async () => {

                const {
                    data: { user }
                } =
                    await supabase.auth.getUser();

                if (!user) {
                    return;
                }

                const { data: profile } =
                    await supabase
                        .from("profiles")
                        .select("unidade_id")
                        .eq("id", user.id)
                        .single();

                if (profile?.unidade_id) {
                    setUnidadeId(
                        profile.unidade_id
                    );
                }
            };

        fetchUserContext();

    }, []);


    /* ============================================================
       CARREGA PRAZOS DOS EXAMES
    ============================================================ */

    useEffect(() => {

        async function loadPrazos() {

            const { data } =
                await supabase
                    .from("prazos_exames")
                    .select(
                        "nome_exame, prazo_dias"
                    );

            if (!data) {
                return;
            }

            const mapa:
                Record<string, number> = {};

            data.forEach((p) => {

                if (!p.nome_exame) {
                    return;
                }

                mapa[
                    p.nome_exame
                        .trim()
                        .toLowerCase()
                ] =
                    p.prazo_dias;
            });

            setPrazosMap(mapa);
        }

        loadPrazos();

    }, []);


    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */

    const funcionariosFiltradosTipo =
        useMemo(() => {

            if (
                filtroTipoExame ===
                "todos"
            ) {
                return dadosRelatorio;
            }

            return dadosRelatorio.filter(
                (item) => {

                    const funcionario =
                        item.socResumo ||
                        item;

                    return (
                        classificarTipoExame(
                            funcionario
                        ) ===
                        filtroTipoExame
                    );
                }
            );

        }, [
            dadosRelatorio,
            filtroTipoExame
        ]);


    /* ============================================================
       TOTAL DE FUNCIONÁRIOS
    ============================================================ */

    const totalFuncionarios =
        funcionariosFiltradosTipo.length;


    /* ============================================================
       FUNCIONÁRIOS CONCLUÍDOS
    ============================================================ */

    const funcionariosConcluidos =
        useMemo(() => {

            return funcionariosFiltradosTipo
                .filter((item) => {

                    const res =
                        item.socResumo ||
                        item;

                    const pendentes =
                        Number(
                            Array.isArray(
                                res.examesPendentes
                            )
                                ? res.examesPendentes.length
                                : res.examesPendentes ?? 0
                        );

                    return pendentes === 0;

                })
                .length;

        }, [
            funcionariosFiltradosTipo
        ]);


    /* ============================================================
       FUNCIONÁRIOS PENDENTES
    ============================================================ */

    const funcionariosPendentes =
        useMemo(() => {

            return funcionariosFiltradosTipo
                .filter((item) => {

                    const res =
                        item.socResumo ||
                        item;

                    const pendentes =
                        Number(
                            Array.isArray(
                                res.examesPendentes
                            )
                                ? res.examesPendentes.length
                                : res.examesPendentes ?? 0
                        );

                    return pendentes > 0;

                })
                .length;

        }, [
            funcionariosFiltradosTipo
        ]);


    /* ============================================================
       UPLOAD DO EXCEL
    ============================================================ */

    async function handleFileSubmit(
        event: React.ChangeEvent<HTMLInputElement>
    ) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        setFuncionariosSalvos(
            new Set()
        );

        setLoading(true);

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        formData.append(
            "unidadeId",
            unidadeId
        );

        try {

            const start =
                await fetch(
                    "/api/importar-excel-asos",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            if (!start.ok) {

                toast.error(
                    "Erro ao enviar arquivo Excel."
                );

                setLoading(false);

                return;
            }

            const data =
                await start.json();

            const jobId =
                data.jobId;

            if (!jobId) {

                toast.error(
                    "Não foi possível iniciar o processamento."
                );

                setLoading(false);

                return;
            }

            toast.info(
                "Arquivo enviado. Processando dados..."
            );

            let terminou = false;

            while (!terminou) {

                await new Promise(
                    (r) =>
                        setTimeout(
                            r,
                            3000
                        )
                );

                const status =
                    await fetch(
                        `/api/consulta-relatorios/?id=${jobId}`
                    );

                if (!status.ok) {
                    continue;
                }

                const resultado =
                    await status.json();

                const respostaBruta =
                    Array.isArray(resultado)
                        ? resultado[0]
                        : resultado;

                const resposta =
                    respostaBruta.json ??
                    respostaBruta;

                if (
                    resposta.status ===
                    "processing"
                ) {
                    continue;
                }

                if (
                    resposta.status ===
                    "empty"
                ) {

                    toast.warning(
                        "0 registros encontrados no Excel."
                    );

                    setDadosRelatorio(
                        []
                    );

                    setDadosGraficos(
                        null
                    );

                    terminou = true;
                }

                if (
                    resposta.status ===
                    "done"
                ) {

                    terminou = true;

                    const analyticsData =
                        resposta.data
                            ?.analytics ||
                        null;

                    const funcionariosList =
                        resposta.data
                            ?.funcionarios ||
                        [];

                    setDadosRelatorio(
                        funcionariosList
                    );

                    setDadosGraficos(
                        analyticsData
                    );

                    const total =
                        analyticsData
                            ?.totalFuncionarios ??
                        funcionariosList.length;

                    toast.success(
                        `${total} funcionários processados com sucesso!`
                    );
                }
            }

        } catch (error) {
            toast.error(
                "Erro ao importar e processar o arquivo."
            );

        } finally {

            setLoading(false);

            if (
                fileInputRef.current
            ) {
                fileInputRef.current.value =
                    "";
            }
        }
    }


    /* ============================================================
       RENDER
    ============================================================ */

    return (

        <div className="
            min-h-fit
            mt-2
            bg-gray-500/20
            rounded-xl
            p-2
        ">

            {/* =====================================================
                HEADER
            ===================================================== */}

            <header className="
                flex
                flex-col
                lg:flex-row
                justify-between
                items-start
                lg:items-center
                gap-4
                bg-gray-900
                p-4
                rounded-2xl
                border
                border-gray-700
                shadow-2xl
            ">

                <div className="
                    flex
                    items-center
                    gap-4
                ">

                    <div className="
                        bg-blue-500/10
                        p-2.5
                        rounded-xl
                        border
                        border-blue-500/20
                        text-blue-400
                    ">

                        <Activity
                            className="w-5 h-5"
                        />

                    </div>

                    <div>

                        <h1 className="
                            text-lg
                            font-black
                            text-white
                            uppercase
                            tracking-tight
                        ">
                            Gestão de ASOs
                        </h1>

                        <p className="
                            text-xs
                            text-slate-400
                            font-mono
                        ">
                            Importe o relatório SOCGED para análise
                        </p>

                    </div>

                </div>


                {/* FILTRO */}

                <div className="
                    flex
                    items-center
                    gap-2
                ">

                    <span className="
                        text-[10px]
                        font-bold
                        uppercase
                        tracking-wide
                        text-slate-400
                        whitespace-nowrap
                    ">
                        Filtrar por:
                    </span>

                    <div className="
                        relative
                    ">

                        <select
                            value={
                                filtroTipoExame
                            }
                            onChange={(e) =>
                                setFiltroTipoExame(
                                    e.target.value as
                                    FiltroTipoExame
                                )
                            }
                            className="
                                h-9
                                min-w-[170px]
                                appearance-none
                                rounded-lg
                                border
                                border-slate-700
                                bg-slate-800
                                px-3
                                pr-8
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-wide
                                text-slate-200
                                outline-none
                                transition-all
                                cursor-pointer
                                hover:border-slate-600
                                focus:border-blue-500
                                focus:ring-1
                                focus:ring-blue-500/30
                            "
                        >

                            <option value="todos">
                                Todos os exames
                            </option>

                            <option value="clinico">
                                Exames clínicos
                            </option>

                            <option value="complementar">
                                Exames complementares
                            </option>

                        </select>

                        <div className="
                            pointer-events-none
                            absolute
                            right-3
                            top-1/2
                            -translate-y-1/2
                            text-slate-400
                        ">

                            <ChevronDown
                                className="w-3.5 h-3.5"
                            />

                        </div>

                    </div>

                </div>


                {/* TABS + IMPORTAR */}

                <div className="
                    flex
                    flex-col
                    lg:flex-row
                    gap-4
                    items-center
                    w-full
                    lg:w-auto
                ">

                    <Tabs
                        value={view}
                        onValueChange={(v) =>
                            setView(
                                v as ViewType
                            )
                        }
                        className="
                            bg-slate-800
                            p-1
                            rounded-lg
                            border
                            border-slate-700
                        "
                    >

                        <TabsList className="
                            bg-transparent
                            h-8
                            gap-1
                        ">

                            <TabsTrigger
                                value="pendencias"
                                className="
                                    data-[state=active]:bg-blue-600
                                    text-[10px]
                                    uppercase
                                    text-white
                                    font-bold
                                    transition-all
                                "
                            >
                                Exames Pendentes
                            </TabsTrigger>

                            <TabsTrigger
                                value="concluidos"
                                className="
                                    data-[state=active]:bg-emerald-600
                                    text-[10px]
                                    uppercase
                                    text-white
                                    font-bold
                                    transition-all
                                "
                            >
                                Exames Concluídos
                            </TabsTrigger>

                        </TabsList>

                    </Tabs>


                    <div className="
                        flex
                        flex-wrap
                        gap-2
                        text-sm
                        items-center
                        w-full
                        lg:w-auto
                        justify-end
                    ">

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={
                                handleFileSubmit
                            }
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                        />

                        <Button
                            type="button"
                            onClick={() =>
                                fileInputRef
                                    .current
                                    ?.click()
                            }
                            disabled={loading}
                            className="
                                h-10
                                font-bold
                                uppercase
                                text-[10px]
                                gap-2
                                tracking-wider
                                bg-emerald-600
                                hover:bg-emerald-700
                                border
                                border-emerald-500
                                text-white
                                transition-all
                            "
                        >

                            <Upload
                                className="w-3.5 h-3.5"
                            />

                            {loading
                                ? "Processando..."
                                : "Importar Excel"}

                        </Button>

                    </div>

                </div>

            </header>


            {/* =====================================================
                LOADING
            ===================================================== */}

            {loading ? (

                <div className="
                    flex
                    flex-col
                    items-center
                    justify-center
                    py-32
                    space-y-4
                ">

                    <div className="
                        w-9
                        h-9
                        border-4
                        border-blue-600
                        border-t-transparent
                        rounded-full
                        animate-spin
                    " />

                    <p className="
                        text-xs
                        font-mono
                        text-slate-500
                        uppercase
                        tracking-widest
                    ">
                        Processando dados...
                    </p>

                    <p className="
                        text-red-400
                        text-xs
                        font-medium
                        uppercase
                    ">
                        Como estamos consultando o SOC,
                        este processamento pode demorar um pouco.
                        Por favor, aguarde!
                    </p>

                </div>

            ) : (

                <>

                    {/* =================================================
                        CARDS PRINCIPAIS
                        Somente 3 indicadores
                    ================================================= */}

                    <div className="
                        grid
                        gap-4
                        my-4
                        grid-cols-1
                        md:grid-cols-3
                    ">

                        {/* TOTAL */}

                        <CardIndicador
                            titulo="Total Funcionários"
                            valor={
                                totalFuncionarios
                            }
                            subtitulo={
                                filtroTipoExame ===
                                    "todos"
                                    ? "Todos os funcionários"
                                    : filtroTipoExame ===
                                        "clinico"
                                        ? "Exames clínicos"
                                        : "Exames complementares"
                            }
                            icon={
                                <Users
                                    size={24}
                                    className="text-blue-500"
                                />
                            }
                        />


                        {/* CONCLUÍDOS */}

                        <CardIndicador
                            titulo="Funcionários Concluídos"
                            valor={
                                funcionariosConcluidos
                            }
                            subtitulo="Prontos para montagem"
                            icon={
                                <CheckCircle2
                                    size={24}
                                    className="text-emerald-500"
                                />
                            }
                        />


                        {/* PENDENTES */}

                        <CardIndicador
                            titulo="Funcionários Pendentes"
                            valor={
                                funcionariosPendentes
                            }
                            subtitulo="Possuem exames pendentes"
                            icon={
                                <AlertCircle
                                    size={24}
                                    className="text-amber-500"
                                />
                            }
                        />

                    </div>


                    {/* =================================================
                        VIEW PENDÊNCIAS
                    ================================================= */}

                    {view === "pendencias" && (

                        <ViewExamesPendentes
                            analytics={
                                dadosGraficos
                            }
                            todosFuncionarios={
                                dadosRelatorio
                            }
                            filtroTipoExame={
                                filtroTipoExame
                            }
                        />

                    )}


                    {/* =================================================
                        VIEW CONCLUÍDOS
                    ================================================= */}

                    {view === "concluidos" && (

                        <ViewExamesConcluidos
                            todosFuncionarios={
                                dadosRelatorio
                            }
                            funcionariosSalvos={
                                funcionariosSalvos
                            }
                            onFuncionariosSalvos={
                                (cpfs) => {

                                    setFuncionariosSalvos(
                                        (prev) => {

                                            const novoSet =
                                                new Set(prev);

                                            cpfs.forEach(
                                                (cpf) =>
                                                    novoSet.add(
                                                        cpf
                                                    )
                                            );

                                            return novoSet;
                                        }
                                    );
                                }
                            }
                            filtroTipoExame={
                                filtroTipoExame
                            }
                            unidadeId={
                                unidadeId
                            }
                        />

                    )}

                </>

            )}

        </div>
    );
}


/* ============================================================
   VIEW EXAMES PENDENTES
============================================================ */

export function ViewExamesPendentes({
    analytics,
    todosFuncionarios,
    filtroTipoExame,
}: {
    analytics: any;
    todosFuncionarios: any[];
    filtroTipoExame: FiltroTipoExame;
}) {

    const pendencias =
        analytics?.funcionariosComExamesPendentes || [];

    const [prazosMap, setPrazosMap] =
        useState<Record<string, number>>({});

    const [
        selectedFuncionario,
        setSelectedFuncionario
    ] =
        useState<any | null>(null);

    const [modalOpen, setModalOpen] =
        useState(false);

    const [busca, setBusca] =
        useState("");

    const [sortKey, setSortKey] =
        useState<string>("nome");

    const [sortDirection, setSortDirection] =
        useState<"asc" | "desc">("asc");


    /* ============================================================
       PAGINAÇÃO
    ============================================================ */

    const [paginaAtual, setPaginaAtual] =
        useState(1);

    const [itensPorPagina, setItensPorPagina] =
        useState(15);


    /* ============================================================
       ORDENAÇÃO
    ============================================================ */

    const handleSort = (
        key: string
    ) => {

        if (sortKey === key) {

            setSortDirection(
                (prev) =>
                    prev === "asc"
                        ? "desc"
                        : "asc"
            );

        } else {

            setSortKey(key);

            setSortDirection("asc");
        }
    };


    /* ============================================================
       STATUS VISUAL
    ============================================================ */

    const calcularStatusVencimentoVisual =
        (
            dataFicha: string | null,
            prazoDias: number | null
        ) => {

            if (
                !dataFicha ||
                prazoDias === null
            ) {

                return {
                    label: "Sem Prazo",
                    color:
                        "bg-slate-500/10 text-slate-400 border-slate-500/20",
                    estaVencido: false,
                };
            }

            const dataBase =
                parseDateBR(dataFicha);

            if (!dataBase) {

                return {
                    label: "Data Inválida",
                    color:
                        "bg-slate-500/10 text-slate-400 border-slate-500/20",
                    estaVencido: false,
                };
            }

            const dataLimite =
                new Date(dataBase);

            dataLimite.setDate(
                dataLimite.getDate() +
                prazoDias
            );

            const hoje =
                new Date();

            hoje.setHours(
                0,
                0,
                0,
                0
            );

            const diffTime =
                dataLimite.getTime() -
                hoje.getTime();

            const diffDays =
                Math.ceil(
                    diffTime /
                    (1000 * 60 * 60 * 24)
                );

            if (diffDays < 0) {

                return {
                    label:
                        `Vencido há ${Math.abs(diffDays)}d`,
                    color:
                        "bg-red-500/20 text-red-500 border-red-500/30",
                    estaVencido: true,
                };
            }

            if (diffDays <= 3) {

                return {
                    label:
                        `Vence em ${diffDays}d`,
                    color:
                        "bg-amber-500/20 text-amber-500 border-amber-500/30",
                    estaVencido: false,
                };
            }

            return {
                label:
                    `No prazo (${diffDays}d)`,
                color:
                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
                estaVencido: false,
            };
        };


    /* ============================================================
       CARREGA PRAZOS
    ============================================================ */

    useEffect(() => {

        async function loadPrazos() {

            const { data } =
                await supabase
                    .from("prazos_exames")
                    .select(
                        "nome_exame, prazo_dias"
                    );

            if (!data) {
                return;
            }

            const mapa:
                Record<string, number> = {};

            data.forEach((p) => {

                if (p.nome_exame) {

                    mapa[
                        p.nome_exame
                            .trim()
                            .toLowerCase()
                    ] =
                        p.prazo_dias;
                }
            });

            setPrazosMap(mapa);
        }

        loadPrazos();

    }, []);


    /* ============================================================
       MAPA FUNCIONÁRIOS
    ============================================================ */

    const funcionariosMapeados =
        useMemo(() => {

            const map =
                new Map<string, any>();

            todosFuncionarios?.forEach(
                (item) => {

                    const res =
                        item.socResumo ||
                        item;

                    if (!res) {
                        return;
                    }

                    const cpf =
                        res.cpfFuncionario ||
                        res.cpf;

                    if (!cpf) {
                        return;
                    }

                    map.set(
                        cpf,
                        {

                            nome:
                                res.nomeFuncionario ||
                                res.nome,

                            cpf,

                            empresa:
                                res.razaoSocial ||
                                res.empresa ||
                                "-",

                            codigoEmpresa:
                                res.codigoEmpresa ||
                                "-",

                            codigoFuncionario:
                                res.codigoFuncionario ||
                                "-",

                            dataAso:
                                res.dataAso ||
                                res.dataPedido ||
                                null,

                            dataFicha:
                                res.dataFicha ||
                                res.dataPedido ||
                                null,

                            resultadoAsoSoc:
                                res.resultadoAsoSoc ||
                                "Pendente",

                            medico:
                                res.medico ||
                                "Não informado",

                            crmMedico:
                                res.crmMedico ||
                                "-",

                            totalExames:
                                res.totalExames ||
                                0,

                            examesPendentes:
                                res.examesPendentes ||
                                0,

                            examesConcluidos:
                                res.examesConcluidos ||
                                0,

                            listaExamesResumida:
                                res.listaExamesResumida ||
                                [],

                        }
                    );
                }
            );

            return map;

        }, [
            todosFuncionarios
        ]);


    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */

    const pendenciasFiltradas =
        useMemo(() => {

            if (
                filtroTipoExame ===
                "todos"
            ) {
                return pendencias;
            }

            return pendencias.filter(
                (item: any) => {

                    const cpf =
                        item.cpfFuncionario ||
                        item.cpf;

                    const funcionario =
                        funcionariosMapeados.get(
                            cpf
                        );

                    if (!funcionario) {
                        return false;
                    }

                    return (
                        classificarTipoExame(
                            funcionario
                        ) ===
                        filtroTipoExame
                    );
                }
            );

        }, [
            pendencias,
            funcionariosMapeados,
            filtroTipoExame
        ]);


    /* ============================================================
       PROCESSA + FILTRA + ORDENA
    ============================================================ */

    const pendenciasProcessadas =
        useMemo(() => {

            const termo =
                busca
                    .trim()
                    .toLowerCase();

            const lista =
                pendenciasFiltradas.map(
                    (item: any) => {

                        const cpf =
                            item.cpfFuncionario ||
                            item.cpf;

                        const fDados =
                            funcionariosMapeados.get(
                                cpf
                            );

                        const nome =
                            item.nomeFuncionario ||
                            item.nome ||
                            fDados?.nome ||
                            "Não Informado";

                        const empresa =
                            fDados?.empresa ||
                            item.empresa ||
                            item.unidade ||
                            "-";

                        const dataFicha =
                            fDados?.dataFicha ||
                            item.dataFicha ||
                            null;

                        const examesList:
                            string[] =
                            Array.isArray(
                                item.examesPendentes
                            )
                                ? item.examesPendentes
                                : [
                                    item.examesPendentes ||
                                    ""
                                ];

                        const maiorPrazo =
                            obterMaiorPrazo(
                                examesList,
                                prazosMap
                            );

                        const statusVencimento =
                            calcularStatusVencimentoVisual(
                                dataFicha,
                                maiorPrazo
                            );

                        return {
                            ...item,

                            cpf,

                            nome,

                            empresa,

                            dataFicha,

                            examesList,

                            maiorPrazo,

                            statusVencimento,
                        };
                    }
                );

            const filtrada =
                lista.filter(
                    (item: any) => {

                        if (!termo) {
                            return true;
                        }

                        return (
                            String(
                                item.nome
                            )
                                .toLowerCase()
                                .includes(
                                    termo
                                ) ||

                            String(
                                item.empresa
                            )
                                .toLowerCase()
                                .includes(
                                    termo
                                )
                        );
                    }
                );

            filtrada.sort(
                (a: any, b: any) => {

                    const resultado =
                        compararValores(
                            a,
                            b,
                            sortKey
                        );

                    return sortDirection ===
                        "asc"
                        ? resultado
                        : -resultado;
                }
            );

            return filtrada;

        }, [
            pendenciasFiltradas,
            funcionariosMapeados,
            prazosMap,
            busca,
            sortKey,
            sortDirection
        ]);


    /* ============================================================
       PAGINAÇÃO DOS RESULTADOS
    ============================================================ */

    const totalPaginas =
        Math.ceil(
            pendenciasProcessadas.length /
            itensPorPagina
        );

    const indiceInicial =
        (paginaAtual - 1) *
        itensPorPagina;

    const indiceFinal =
        indiceInicial +
        itensPorPagina;

    const pendenciasPaginadas =
        pendenciasProcessadas.slice(
            indiceInicial,
            indiceFinal
        );


    /* ============================================================
       RESET DA PAGINAÇÃO
    ============================================================ */

    useEffect(() => {

        setPaginaAtual(1);

    }, [
        busca,
        filtroTipoExame,
        sortKey,
        sortDirection
    ]);


    /* ============================================================
       GARANTE QUE A PÁGINA NÃO FIQUE INVÁLIDA
    ============================================================ */

    useEffect(() => {

        if (
            totalPaginas > 0 &&
            paginaAtual > totalPaginas
        ) {

            setPaginaAtual(
                totalPaginas
            );
        }

    }, [
        totalPaginas,
        paginaAtual
    ]);


    /* ============================================================
       INDICADORES DE ASO
       
       Calculados sobre todas as pendências filtradas,
       independentemente da busca digitada na tabela.
    ============================================================ */

    const indicadoresAso =
        useMemo(() => {

            let vencidos = 0;
            let dentroDoPrazo = 0;

            pendenciasFiltradas.forEach(
                (item: any) => {

                    const cpf =
                        item.cpfFuncionario ||
                        item.cpf;

                    const funcionario =
                        funcionariosMapeados.get(
                            cpf
                        );

                    const dataFicha =
                        funcionario?.dataFicha ||
                        item.dataFicha ||
                        null;

                    const examesList:
                        string[] =
                        Array.isArray(
                            item.examesPendentes
                        )
                            ? item.examesPendentes
                            : [
                                item.examesPendentes ||
                                ""
                            ];

                    const maiorPrazo =
                        obterMaiorPrazo(
                            examesList,
                            prazosMap
                        );

                    const status =
                        obterStatusVencimento(
                            dataFicha,
                            maiorPrazo
                        );

                    if (
                        status ===
                        "vencido"
                    ) {
                        vencidos++;
                    }

                    if (
                        status ===
                        "no_prazo"
                    ) {
                        dentroDoPrazo++;
                    }
                }
            );

            return {
                vencidos,
                dentroDoPrazo,
            };

        }, [
            pendenciasFiltradas,
            funcionariosMapeados,
            prazosMap
        ]);


    /* ============================================================
       TOTAIS
    ============================================================ */

    const totalFuncionariosPendentes =
        pendenciasFiltradas.length;

    const totalGeralFuncionarios =
        analytics?.totalFuncionarios ||
        funcionariosMapeados.size;

    const totalFuncionariosConcluidos =
        Math.max(
            0,
            totalGeralFuncionarios -
            totalFuncionariosPendentes
        );


    /* ============================================================
       MODAL
    ============================================================ */

    const handleRowClick = (
        cpf: string,
        itemPendente: any
    ) => {

        const fCompleto =
            funcionariosMapeados.get(
                cpf
            );

        if (fCompleto) {

            setSelectedFuncionario(
                fCompleto
            );

        } else {

            setSelectedFuncionario({

                nome:
                    itemPendente.nomeFuncionario ||
                    itemPendente.nome,

                cpf:
                    itemPendente.cpfFuncionario ||
                    itemPendente.cpf,

                empresa:
                    itemPendente.empresa ||
                    "-",

                dataAso:
                    itemPendente.dataAso ||
                    null,

                dataFicha:
                    itemPendente.dataFicha ||
                    null,

                resultadoAsoSoc:
                    "Pendente",

                totalExames:
                    itemPendente
                        .examesPendentes
                        ?.length ||
                    0,

                examesPendentes:
                    itemPendente
                        .examesPendentes
                        ?.length ||
                    0,

                examesConcluidos:
                    0,

                listaExamesResumida:
                    (
                        itemPendente
                            .examesPendentes ||
                        []
                    ).map(
                        (e: string) => ({
                            descricaoExame:
                                e,
                            isPendente:
                                true,
                            dataExame:
                                "-",
                        })
                    ),
            });
        }

        setModalOpen(true);
    };


    /* ============================================================
       EMPTY STATE
    ============================================================ */

    if (
        !analytics ||
        pendenciasFiltradas.length === 0
    ) {

        return (

            <div className="
                text-center
                py-20
                text-xs
                font-mono
                text-slate-400
                uppercase
                bg-white
                dark:bg-gray-900
                rounded-xl
                border
                border-dashed
                border-gray-700
            ">

                {analytics
                    ? "Nenhum funcionário com exames pendentes!"
                    : "Importe uma planilha Excel para ver os exames pendentes."}

            </div>
        );
    }


    /* ============================================================
       HEADER DA TABELA
    ============================================================ */

    const SortHeader = ({
        label,
        sortKeyValue
    }: {
        label: string;
        sortKeyValue: string;
    }) => (

        <TableHead
            className="
                font-bold
                text-xs
                uppercase
                text-slate-600
                dark:text-slate-300
                cursor-pointer
                select-none
            "
            onClick={() =>
                handleSort(
                    sortKeyValue
                )
            }
        >

            <div className="
                flex
                items-center
                gap-1
            ">

                {label}

                {sortKey ===
                    sortKeyValue ? (

                    sortDirection ===
                        "asc" ? (

                        <ArrowUp
                            className="w-3 h-3"
                        />

                    ) : (

                        <ArrowDown
                            className="w-3 h-3"
                        />
                    )

                ) : (

                    <ArrowUpDown
                        className="
                            w-3
                            h-3
                            opacity-40
                        "
                    />
                )}

            </div>

        </TableHead>
    );


    /* ============================================================
       RENDER
    ============================================================ */

    return (

        <Card className="
            bg-white
            dark:bg-gray-900
            border-gray-200
            dark:border-gray-800
            shadow-sm
        ">

            <CardHeader className="
                border-b
                border-gray-300
                dark:border-gray-700
                pb-3
            ">

                {/* TÍTULO + BUSCA */}

                <div className="
                    flex
                    flex-col
                    lg:flex-row
                    lg:items-center
                    justify-between
                    gap-3
                ">

                    <CardTitle className="
                        text-sm
                        font-black
                        uppercase
                        text-slate-700
                        dark:text-slate-200
                        flex
                        items-center
                        gap-2
                    ">

                        <AlertCircle
                            className="
                                w-4
                                h-4
                                text-red-500
                            "
                        />

                        Funcionários com Exames Pendentes

                        <Badge
                            variant="outline"
                            className="
                                text-sm
                                border-red-500/30
                                text-red-500
                                bg-red-500/5
                            "
                        >
                            {
                                pendenciasFiltradas.length
                            }
                        </Badge>

                    </CardTitle>

                    {/* INDICADORES DE ASO */}
                    <div className="
                    flex
                    flex-row
                    justify-center
                    gap-3
                ">

                        {/* ASOS VENCIDOS */}
                        <div className="
                        flex
                        items-center
                        justify-between
                        gap-3
                        rounded-xl
                        border
                        border-red-500/20
                        bg-red-500/5
                        px-4
                        py-3
                    ">

                            <div className="
                            flex
                            items-center
                            gap-3
                        ">

                                <div className="
                                flex
                                items-center
                                justify-center
                                w-9
                                h-9
                                rounded-lg
                                bg-red-500/10
                            ">

                                    <AlertCircle
                                        className="
                                        w-5
                                        h-5
                                        text-red-500
                                    "
                                    />

                                </div>

                                <div>

                                    <div className="
                                    text-[9px]
                                    uppercase
                                    font-bold
                                    tracking-wide
                                    text-slate-400
                                ">
                                        ASOs Vencidos
                                    </div>

                                    <div className="
                                    text-[10px]
                                    text-slate-500
                                    dark:text-slate-400
                                ">
                                        Prazo expirado
                                    </div>

                                </div>

                            </div>

                            <span className="
                            text-2xl
                            font-black
                            text-red-500
                        ">
                                {
                                    indicadoresAso.vencidos
                                }
                            </span>

                        </div>


                        {/* ASOS NO PRAZO */}
                        <div className="
                        flex
                        items-center
                        justify-between
                        gap-3
                        rounded-xl
                        border
                        border-emerald-500/20
                        bg-emerald-500/5
                        px-4
                        py-3
                    ">

                            <div className="
                            flex
                            items-center
                            gap-3
                        ">

                                <div className="
                                flex
                                items-center
                                justify-center
                                w-9
                                h-9
                                rounded-lg
                                bg-emerald-500/10
                            ">

                                    <CheckCircle2
                                        className="
                                        w-5
                                        h-5
                                        text-emerald-500
                                    "
                                    />

                                </div>

                                <div>

                                    <div className="
                                    text-[9px]
                                    uppercase
                                    font-bold
                                    tracking-wide
                                    text-slate-400
                                ">
                                        ASOs no Prazo
                                    </div>

                                    <div className="
                                    text-[10px]
                                    text-slate-500
                                    dark:text-slate-400
                                ">
                                        Dentro do prazo
                                    </div>

                                </div>

                            </div>

                            <span className="
                            text-2xl
                            font-black
                            text-emerald-500
                        ">
                                {
                                    indicadoresAso.dentroDoPrazo
                                }
                            </span>

                        </div>

                    </div>


                    <div className="
                        flex
                        flex-col
                        sm:flex-row
                        items-stretch
                        sm:items-center
                        gap-2
                    ">

                        <div className="
                            relative
                            w-full
                            sm:w-72
                        ">

                            <Search
                                className="
                                    absolute
                                    left-3
                                    top-1/2
                                    -translate-y-1/2
                                    w-4
                                    h-4
                                    text-slate-400
                                "
                            />

                            <Input
                                value={busca}
                                onChange={(e) =>
                                    setBusca(
                                        e.target.value
                                    )
                                }
                                placeholder="
                                    Buscar funcionário ou empresa...
                                "
                                className="
                                    pl-9
                                    h-9
                                    text-xs
                                "
                            />

                        </div>


                        {/* PROGRESSO */}

                        <div className="
                            flex
                            items-center
                            gap-2
                            bg-emerald-500/10
                            border
                            border-emerald-500/20
                            px-3
                            py-2
                            rounded-lg
                        ">

                            <UserCheck
                                className="
                                    w-4
                                    h-4
                                    text-emerald-500
                                "
                            />

                            <div>

                                <div className="
                                    text-[9px]
                                    uppercase
                                    font-bold
                                    text-slate-400
                                ">
                                    Progresso
                                </div>

                                <div className="
                                    text-xs
                                    font-black
                                    text-emerald-600
                                    dark:text-emerald-400
                                ">

                                    {
                                        totalFuncionariosConcluidos
                                    }

                                    {" "}de{" "}

                                    {
                                        totalGeralFuncionarios
                                    }

                                    {" "}concluídos

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </CardHeader>


            {/* =====================================================
                TABELA
            ===================================================== */}

            <CardContent className="
                p-0
                overflow-x-auto
            ">

                <Table>

                    <TableHeader className="
                        bg-slate-100
                        dark:bg-slate-800
                    ">

                        <TableRow>

                            <SortHeader
                                label="Funcionário"
                                sortKeyValue="nome"
                            />

                            <SortHeader
                                label="Empresa / Unidade"
                                sortKeyValue="empresa"
                            />

                            <SortHeader
                                label="Data Ficha"
                                sortKeyValue="dataFicha"
                            />

                            <SortHeader
                                label="Exames Pendentes"
                                sortKeyValue="examesList"
                            />

                            <SortHeader
                                label="Maior Prazo"
                                sortKeyValue="maiorPrazo"
                            />

                            <SortHeader
                                label="Status Vencimento"
                                sortKeyValue="statusVencimento"
                            />

                        </TableRow>

                    </TableHeader>


                    <TableBody>

                        {pendenciasPaginadas.map(
                            (
                                item: any,
                                idx: number
                            ) => (

                                <TableRow
                                    key={`${item.cpf}-${idx}`}
                                    className="
                                        hover:bg-slate-100
                                        dark:hover:bg-slate-800/80
                                        transition-colors
                                    "
                                >

                                    {/* FUNCIONÁRIO */}

                                    <TableCell className="
                                        font-bold
                                        text-xs
                                        text-blue-600
                                        dark:text-blue-400
                                        hover:underline
                                        cursor-pointer
                                    ">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRowClick(
                                                    item.cpf,
                                                    item
                                                )
                                            }
                                            className="
                                                text-left
                                                font-bold
                                                flex
                                                items-center
                                                gap-1.5
                                            "
                                        >

                                            {item.nome}

                                        </button>

                                    </TableCell>


                                    {/* EMPRESA */}

                                    <TableCell className="
                                        text-xs
                                        text-slate-600
                                        dark:text-slate-400
                                    ">
                                        {
                                            item.empresa
                                        }
                                    </TableCell>


                                    {/* DATA FICHA */}

                                    <TableCell className="
                                        text-xs
                                        text-slate-600
                                        dark:text-slate-400
                                        font-mono
                                    ">
                                        {
                                            item.dataFicha ||
                                            "-"
                                        }
                                    </TableCell>


                                    {/* EXAMES */}

                                    <TableCell>

                                        <div className="
                                            flex
                                            flex-wrap
                                            gap-1
                                        ">

                                            {
                                                item.examesList.map(
                                                    (
                                                        exame: string,
                                                        eIdx: number
                                                    ) => {

                                                        const prazoExame =
                                                            prazosMap[
                                                            exame
                                                                .trim()
                                                                .toLowerCase()
                                                            ];

                                                        return (

                                                            <Badge
                                                                key={
                                                                    eIdx
                                                                }
                                                                variant="outline"
                                                                className="
                                                                    bg-red-500/10
                                                                    text-red-500
                                                                    border-red-500/20
                                                                    text-[10px]
                                                                    gap-1
                                                                "
                                                            >

                                                                {
                                                                    exame
                                                                }

                                                                {
                                                                    prazoExame !==
                                                                    undefined && (

                                                                        <span className="
                                                                            text-[9px]
                                                                            font-bold
                                                                            text-amber-500
                                                                        ">
                                                                            (
                                                                            {
                                                                                prazoExame
                                                                            }d)
                                                                        </span>
                                                                    )
                                                                }

                                                            </Badge>
                                                        );
                                                    }
                                                )
                                            }

                                        </div>

                                    </TableCell>


                                    {/* MAIOR PRAZO */}

                                    <TableCell className="
                                        text-xs
                                        font-bold
                                        text-slate-700
                                        dark:text-slate-300
                                    ">

                                        {
                                            item.maiorPrazo !==
                                                null ? (

                                                <Badge className="
                                                    bg-amber-500/20
                                                    text-amber-400
                                                    border
                                                    border-amber-500/30
                                                    font-bold
                                                    text-[10px]
                                                ">

                                                    {
                                                        item.maiorPrazo
                                                    }

                                                    {" "}dia(s)

                                                </Badge>

                                            ) : (

                                                <span className="
                                                    text-slate-400
                                                    font-mono
                                                    text-[10px]
                                                ">
                                                    Não definido
                                                </span>
                                            )
                                        }

                                    </TableCell>


                                    {/* STATUS */}

                                    <TableCell>

                                        <Badge
                                            className={`
                                                font-bold
                                                text-[10px]
                                                border
                                                ${item.statusVencimento.color}
                                            `}
                                        >

                                            {
                                                item
                                                    .statusVencimento
                                                    .label
                                            }

                                        </Badge>

                                    </TableCell>

                                </TableRow>
                            )
                        )}

                    </TableBody>

                </Table>

            </CardContent>


            {/* =====================================================
                PAGINAÇÃO
            ===================================================== */}

            <div className="
                flex
                flex-col
                sm:flex-row
                items-center
                justify-between
                gap-3
                px-4
                py-3
                border-t
                border-gray-200
                dark:border-gray-800
                bg-slate-50/50
                dark:bg-slate-900/30
            ">

                {/* INFORMAÇÕES */}

                <div className="
                    flex
                    items-center
                    gap-3
                    text-[10px]
                    text-slate-400
                    uppercase
                    font-bold
                ">

                    <span>
                        {pendenciasProcessadas.length > 0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                pendenciasProcessadas.length
                            )} de ${pendenciasProcessadas.length}`
                            : "Nenhum resultado"}
                    </span>


                    {/* ITENS POR PÁGINA */}

                    <div className="
                        flex
                        items-center
                        gap-1.5
                    ">

                        <span>
                            Linhas:
                        </span>

                        <Select
                            value={String(itensPorPagina)}
                            onValueChange={(value) => {
                                setItensPorPagina(
                                    Number(value)
                                );
                                setPaginaAtual(1);
                            }}
                        >

                            <SelectTrigger className="
                                h-7
                                w-[65px]
                                text-[10px]
                                font-bold
                            ">

                                <SelectValue />

                            </SelectTrigger>

                            <SelectContent>

                                <SelectItem value="10">
                                    10
                                </SelectItem>

                                <SelectItem value="15">
                                    15
                                </SelectItem>

                                <SelectItem value="25">
                                    25
                                </SelectItem>

                                <SelectItem value="50">
                                    50
                                </SelectItem>

                            </SelectContent>

                        </Select>

                    </div>

                </div>


                {/* CONTROLES */}

                <div className="
                    flex
                    items-center
                    gap-1
                ">

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual === 1}
                        onClick={() =>
                            setPaginaAtual(
                                (prev) =>
                                    Math.max(
                                        1,
                                        prev - 1
                                    )
                            )
                        }
                        className="
                            h-7
                            px-2
                            text-[10px]
                            gap-1
                        "
                    >

                        <ChevronLeft className="w-3.5 h-3.5" />

                        <span className="hidden sm:inline">
                            Anterior
                        </span>

                    </Button>


                    {/* PÁGINAS */}

                    {Array.from(
                        {
                            length: totalPaginas
                        },
                        (_, index) =>
                            index + 1
                    )
                        .filter((pagina) => {

                            if (
                                totalPaginas <= 7
                            ) {
                                return true;
                            }

                            return (
                                pagina === 1 ||
                                pagina === totalPaginas ||
                                Math.abs(
                                    pagina -
                                    paginaAtual
                                ) <= 1
                            );
                        })
                        .map(
                            (
                                pagina,
                                index,
                                array
                            ) => {

                                const paginaAnterior =
                                    array[index - 1];

                                const mostrarReticencias =
                                    paginaAnterior &&
                                    pagina -
                                    paginaAnterior >
                                    1;

                                return (
                                    <React.Fragment
                                        key={pagina}
                                    >

                                        {mostrarReticencias && (
                                            <span className="
                                                px-1
                                                text-[10px]
                                                text-slate-400
                                            ">
                                                ...
                                            </span>
                                        )}

                                        <Button
                                            type="button"
                                            variant={
                                                paginaAtual ===
                                                    pagina
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setPaginaAtual(
                                                    pagina
                                                )
                                            }
                                            className="
                                                h-7
                                                min-w-7
                                                px-2
                                                text-[10px]
                                                font-bold
                                            "
                                        >
                                            {pagina}
                                        </Button>

                                    </React.Fragment>
                                );
                            }
                        )}


                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            paginaAtual ===
                            totalPaginas
                        }
                        onClick={() =>
                            setPaginaAtual(
                                (prev) =>
                                    Math.min(
                                        totalPaginas,
                                        prev + 1
                                    )
                            )
                        }
                        className="
                            h-7
                            px-2
                            text-[10px]
                            gap-1
                        "
                    >

                        <span className="hidden sm:inline">
                            Próxima
                        </span>

                        <ChevronRight className="w-3.5 h-3.5" />

                    </Button>

                </div>

            </div>


            {/* MODAL */}

            <FuncionarioModal
                open={modalOpen}
                onOpenChange={
                    setModalOpen
                }
                funcionario={
                    selectedFuncionario
                }
            />

        </Card>
    );
}

interface ViewExamesConcluidosProps {
    todosFuncionarios: any[];
    funcionariosSalvos: Set<string>;
    onFuncionariosSalvos: (cpfs: string[]) => void;
    filtroTipoExame: FiltroTipoExame;
    unidadeId: string;
}


/* ============================================================
    VIEW FUNCIONÁRIOS COM TODOS EXAMES CONCLUÍDOS
============================================================ */

export function ViewExamesConcluidos({
    todosFuncionarios,
    funcionariosSalvos,
    onFuncionariosSalvos,
    filtroTipoExame,
    unidadeId
}: ViewExamesConcluidosProps) {

    const [selectedFuncionario, setSelectedFuncionario] =
        useState<any | null>(null);

    const [modalOpen, setModalOpen] =
        useState(false);

    const [selectedCpfs, setSelectedCpfs] =
        useState<Set<string>>(new Set());

    const [saving, setSaving] =
        useState(false);


    // Estado do Filtro de Aba:
    // "pendentes" (disponíveis) ou "salvos" (montados/salvos)
    const [abaAtiva, setAbaAtiva] =
        useState<"pendentes" | "salvos">("pendentes");


    const [busca, setBusca] =
        useState("");

    const [sortKey, setSortKey] =
        useState<string>("nome");

    const [sortDirection, setSortDirection] =
        useState<"asc" | "desc">("asc");


    /* ============================================================
       PAGINAÇÃO
    ============================================================ */

    const [paginaAtual, setPaginaAtual] =
        useState(1);

    const [itensPorPagina, setItensPorPagina] =
        useState(15);


    /*
     * Funcionários que já chegaram da API com todos os exames concluídos.
     */

    const funcionariosConcluidos =
        useMemo(() => {

            const lista: any[] = [];

            todosFuncionarios.forEach((item) => {
                const res =
                    item.socResumo ||
                    item;

                if (!res) return;

                const cpf =
                    String(
                        res.cpfFuncionario ||
                        res.cpf ||
                        ""
                    ).trim();

                if (!cpf) return;

                const pendentesCount =
                    Number(
                        Array.isArray(
                            res.examesPendentes
                        )
                            ? res.examesPendentes.length
                            : res.examesPendentes ?? 0
                    );

                if (pendentesCount === 0) {

                    lista.push({

                        nome:
                            res.nomeFuncionario ||
                            res.nome ||
                            "Não informado",

                        cpf,
                        sequencial_ficha: res.sequencialFicha,
                        empresa:
                            res.razaoSocial ||
                            res.empresa ||
                            "-",

                        codigoEmpresa:
                            res.codigoEmpresa ||
                            "-",

                        codigoGed:
                            res.codigoGed ||
                            "-",

                        codigoFuncionario:
                            res.codigoFuncionario ||
                            "-",

                        dataAso:
                            res.dataAso ||
                            res.dataPedido ||
                            null,

                        dataFicha:
                            res.dataFicha ||
                            res.dataPedido ||
                            null,

                        resultadoAsoSoc:
                            res.resultadoAsoSoc ||
                            "Concluído",

                        medico:
                            res.medico ||
                            "Não informado",

                        crmMedico:
                            res.crmMedico ||
                            "-",

                        observacao: res.observacao || "",

                        totalExames:
                            Number(
                                res.totalExames ||
                                0
                            ),

                        examesPendentes:
                            0,

                        examesConcluidos:
                            Number(
                                res.examesConcluidos ||
                                res.totalExames ||
                                0
                            ),

                        listaExamesResumida:
                            res.listaExamesResumida ||
                            [],

                    });
                }
            });

            return lista;

        }, [
            todosFuncionarios
        ]);


    const funcionariosConcluidosFiltrados =
        useMemo(() => {

            if (
                filtroTipoExame ===
                "todos"
            ) {
                return funcionariosConcluidos;
            }

            return funcionariosConcluidos.filter(
                (funcionario) => {

                    return (
                        classificarTipoExame(
                            funcionario
                        ) ===
                        filtroTipoExame
                    );
                }
            );

        }, [
            funcionariosConcluidos,
            filtroTipoExame
        ]);


    const isFuncionarioMontado = (
        funcionario: any
    ) => {

        if (!funcionario) return false;

        return (
            funcionariosSalvos.has(
                funcionario.cpf
            ) ||
            possuiAsoMontado(
                funcionario.observacao
            )
        );
    };


    /*
     * Filtra a busca, ordena e alterna pela Aba Selecionada
     * (Pendentes vs Salvos/Montados)
     */

    const funcionariosFiltrados =
        useMemo(() => {

            const termo =
                busca
                    .trim()
                    .toLowerCase();

            const lista =
                funcionariosConcluidosFiltrados.filter(
                    (f) => {

                        const jaMontado =
                            isFuncionarioMontado(
                                f
                            );

                        // Aba pendentes = somente quem ainda não foi montado
                        if (
                            abaAtiva ===
                            "pendentes" &&
                            jaMontado
                        ) {
                            return false;
                        }

                        // Aba salvos = somente quem já foi montado
                        if (
                            abaAtiva ===
                            "salvos" &&
                            !jaMontado
                        ) {
                            return false;
                        }

                        if (!termo) return true;

                        return (
                            String(
                                f.nome ||
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    termo
                                ) ||

                            String(
                                f.empresa ||
                                ""
                            )
                                .toLowerCase()
                                .includes(
                                    termo
                                ) ||

                            String(
                                f.cpf ||
                                ""
                            ).includes(
                                termo
                            )
                        );
                    }
                );

            lista.sort((a, b) => {

                const av =
                    a[sortKey] ??
                    "";

                const bv =
                    b[sortKey] ??
                    "";

                const resultado =
                    typeof av ===
                        "number" &&
                        typeof bv ===
                        "number"

                        ? av - bv

                        : String(
                            av
                        ).localeCompare(
                            String(
                                bv
                            ),
                            "pt-BR",
                            {
                                numeric:
                                    true,
                                sensitivity:
                                    "base",
                            }
                        );

                return sortDirection ===
                    "asc"
                    ? resultado
                    : -resultado;
            });

            return lista;

        }, [
            funcionariosConcluidosFiltrados,
            busca,
            sortKey,
            sortDirection,
            funcionariosSalvos,
            abaAtiva,
        ]);


    /* ============================================================
       PAGINAÇÃO
    ============================================================ */

    const totalPaginas =
        Math.ceil(
            funcionariosFiltrados.length /
            itensPorPagina
        );

    const indiceInicial =
        (paginaAtual - 1) *
        itensPorPagina;

    const indiceFinal =
        indiceInicial +
        itensPorPagina;

    const funcionariosPaginados =
        funcionariosFiltrados.slice(
            indiceInicial,
            indiceFinal
        );


    /* ============================================================
       RESET DA PAGINAÇÃO
    ============================================================ */

    useEffect(() => {

        setPaginaAtual(1);

    }, [
        busca,
        filtroTipoExame,
        sortKey,
        sortDirection,
        abaAtiva,
    ]);


    /* ============================================================
       GARANTE QUE A PÁGINA NÃO FIQUE INVÁLIDA
    ============================================================ */

    useEffect(() => {

        if (
            totalPaginas > 0 &&
            paginaAtual > totalPaginas
        ) {

            setPaginaAtual(
                totalPaginas
            );
        }

    }, [
        totalPaginas,
        paginaAtual
    ]);


    const handleSort = (
        key: string
    ) => {

        if (
            sortKey === key
        ) {

            setSortDirection(
                (prev) =>
                    prev === "asc"
                        ? "desc"
                        : "asc"
            );

        } else {

            setSortKey(key);

            setSortDirection("asc");
        }
    };


    useEffect(() => {

        setSelectedCpfs(
            new Set()
        );

    }, [
        todosFuncionarios
    ]);


    /*
     * IMPORTANTE:
     * Seleciona TODOS os resultados filtrados,
     * e não somente a página atual.
     */

    const handleSelectAll = (
        checked: boolean
    ) => {

        if (!checked) {

            setSelectedCpfs(
                new Set()
            );

            return;
        }

        const disponiveis =
            funcionariosFiltrados
                .filter(
                    (f) =>
                        !isFuncionarioMontado(
                            f
                        )
                )
                .map(
                    (f) =>
                        f.cpf
                );

        setSelectedCpfs(
            new Set(
                disponiveis
            )
        );
    };


    const handleSelectOne = (
        cpf: string,
        checked: boolean
    ) => {

        const funcionario =
            funcionariosConcluidosFiltrados.find(
                (f) =>
                    f.cpf === cpf
            );

        if (
            !funcionario ||
            isFuncionarioMontado(
                funcionario
            )
        ) {
            return;
        }

        setSelectedCpfs(
            (prev) => {

                const novoSet =
                    new Set(prev);

                if (checked) {

                    novoSet.add(
                        cpf
                    );

                } else {

                    novoSet.delete(
                        cpf
                    );
                }

                return novoSet;
            }
        );
    };


    const handleSaveSelection = async () => {
        if (selectedCpfs.size === 0) {
            toast.warning("Selecione ao menos um funcionário para salvar.");
            return;
        }

        setSaving(true);

        try {
            const selecionados = funcionariosConcluidosFiltrados.filter(
                (f) =>
                    selectedCpfs.has(f.cpf) &&
                    !isFuncionarioMontado(f)
            );

            if (selecionados.length === 0) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const response = await fetch(
                "/api/enviar-asos-concluidos",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        selecionados,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error("Erro ao enviar funcionários.");
            }

            // Mapeia todos os selecionados para um array de objetos prontos para inserção em lote
            const dadosParaInserir = selecionados.map((f) => ({
                nome_paciente: f.nome,
                sequencial_ficha: f.sequencial_ficha,
                codigo_empresa_soc: f.codigoEmpresa,
                codigo_ged_soc: f.codigoGed,
                unidade_id: unidadeId,
            }));

            const saveBd = await supabase
                .from("pacientes_assinatura")
                .insert(dadosParaInserir);

            if (saveBd.error) {
                toast.error("Erro ao salvar funcionários.");
                return;
            }

            await response.json();

            const cpfsSalvos = selecionados.map((f) => f.cpf);

            onFuncionariosSalvos(cpfsSalvos);

            setSelectedCpfs((prev) => {
                const novo = new Set(prev);
                cpfsSalvos.forEach((cpf) => novo.delete(cpf));
                return novo;
            });

            toast.success(
                `${selecionados.length} funcionário(s) salvo(s) com sucesso!`
            );

        } catch (error) {
            toast.error(
                "Não foi possível salvar os funcionários selecionados."
            );
        } finally {
            setSaving(false);
        }
    };


    const handleRowClick = (
        f: any
    ) => {

        setSelectedFuncionario(
            f
        );

        setModalOpen(
            true
        );
    };


    if (
        funcionariosConcluidosFiltrados.length ===
        0
    ) {

        return (

            <div className="
                flex
                flex-col
                items-center
                justify-center
                py-20
                px-4
                bg-white
                dark:bg-gray-900
                rounded-xl
                border
                border-dashed
                border-gray-300
                dark:border-gray-700
            ">

                <div className="
                    w-12
                    h-12
                    rounded-full
                    bg-emerald-500/10
                    flex
                    items-center
                    justify-center
                    mb-4
                ">

                    <CheckCircle2
                        className="
                            w-6
                            h-6
                            text-emerald-500
                        "
                    />

                </div>

                <p className="
                    text-sm
                    font-bold
                    text-slate-700
                    dark:text-slate-200
                ">
                    Nenhum funcionário concluído
                </p>

                <p className="
                    text-xs
                    text-slate-400
                    mt-1
                    text-center
                ">
                    Os funcionários com todos os exames concluídos aparecerão aqui.
                </p>

            </div>
        );
    }


    /*
     * Todos os funcionários filtrados que podem ser selecionados.
     *
     * NÃO usa funcionariosPaginados.
     */

    const cpfsSelecionaveis =
        funcionariosFiltrados
            .filter(
                (f) =>
                    !isFuncionarioMontado(
                        f
                    )
            )
            .map(
                (f) =>
                    f.cpf
            );


    const allChecked =
        cpfsSelecionaveis.length >
        0 &&
        cpfsSelecionaveis.every(
            (cpf) =>
                selectedCpfs.has(
                    cpf
                )
        );


    const disponiveisNaAba =
        cpfsSelecionaveis.length;


    const quantidadeSalvos =
        funcionariosConcluidosFiltrados.filter(
            (f) =>
                funcionariosSalvos.has(
                    f.cpf
                ) ||
                possuiAsoMontado(
                    f.observacao
                )
        ).length;


    const quantidadePendentes =
        funcionariosConcluidosFiltrados.length -
        quantidadeSalvos;


    const SortHeader = ({
        label,
        sortKeyValue,
    }: {
        label: string;
        sortKeyValue: string;
    }) => (

        <TableHead
            className="
                font-black
                text-[10px]
                uppercase
                text-slate-500
                cursor-pointer
                select-none
            "
            onClick={() =>
                handleSort(
                    sortKeyValue
                )
            }
        >

            <div className="
                flex
                items-center
                gap-1
            ">

                {label}

                {sortKey ===
                    sortKeyValue ? (

                    sortDirection ===
                        "asc" ? (

                        <ArrowUp
                            className="
                                w-3
                                h-3
                            "
                        />

                    ) : (

                        <ArrowDown
                            className="
                                w-3
                                h-3
                            "
                        />
                    )

                ) : (

                    <ArrowUpDown
                        className="
                            w-3
                            h-3
                            opacity-40
                        "
                    />
                )}

            </div>

        </TableHead>
    );


    return (

        <Card className="
            bg-white
            dark:bg-gray-900
            border-gray-200
            dark:border-gray-800
            shadow-sm
            overflow-hidden
        ">

            {/* HEADER */}

            <CardHeader className="
                border-b
                border-gray-200
                dark:border-gray-700
                p-4
            ">

                <div className="
                    flex
                    flex-col
                    gap-4
                ">

                    {/* LINHA SUPERIOR */}

                    <div className="
                        flex
                        flex-col
                        lg:flex-row
                        lg:items-center
                        justify-between
                        gap-3
                    ">

                        {/* TÍTULO */}

                        <div>

                            <CardTitle className="
                                text-sm
                                font-black
                                uppercase
                                text-slate-700
                                dark:text-slate-200
                                flex
                                items-center
                                gap-2
                            ">

                                <CheckCircle2
                                    className="
                                        w-4
                                        h-4
                                        text-emerald-500
                                    "
                                />

                                Funcionários Concluídos

                            </CardTitle>

                            <p className="
                                text-[11px]
                                text-slate-400
                                mt-1
                            ">
                                Gerencie os funcionários prontos ou visualize os que já foram montados.
                            </p>

                        </div>


                        {/* ABAS */}

                        <div className="
                            flex
                            items-center
                            bg-slate-100
                            dark:bg-slate-800
                            p-1
                            rounded-xl
                            border
                            border-slate-200
                            dark:border-slate-700
                            shrink-0
                        ">

                            <button
                                type="button"
                                onClick={() => {

                                    setAbaAtiva(
                                        "pendentes"
                                    );

                                    setSelectedCpfs(
                                        new Set()
                                    );

                                    setPaginaAtual(
                                        1
                                    );
                                }}
                                className={`
                                    flex
                                    items-center
                                    gap-1.5
                                    px-3
                                    py-1.5
                                    rounded-lg
                                    text-xs
                                    font-black
                                    uppercase
                                    transition-all
                                    ${abaAtiva ===
                                        "pendentes"
                                        ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    }
                                `}
                            >

                                <Clock3
                                    className="
                                        w-3.5
                                        h-3.5
                                    "
                                />

                                Pendentes

                                <span className="
                                    px-1.5
                                    py-0.5
                                    rounded-full
                                    bg-blue-500/10
                                ">
                                    {
                                        quantidadePendentes
                                    }
                                </span>

                            </button>


                            <button
                                type="button"
                                onClick={() => {

                                    setAbaAtiva(
                                        "salvos"
                                    );

                                    setSelectedCpfs(
                                        new Set()
                                    );

                                    setPaginaAtual(
                                        1
                                    );
                                }}
                                className={`
                                    flex
                                    items-center
                                    gap-1.5
                                    px-3
                                    py-1.5
                                    rounded-lg
                                    text-xs
                                    font-black
                                    uppercase
                                    transition-all
                                    ${abaAtiva ===
                                        "salvos"
                                        ? "bg-white dark:bg-gray-900 text-emerald-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    }
                                `}
                            >

                                <CheckCircle2
                                    className="
                                        w-3.5
                                        h-3.5
                                    "
                                />

                                Montados

                                <span className="
                                    px-1.5
                                    py-0.5
                                    rounded-full
                                    bg-emerald-500/10
                                ">
                                    {
                                        quantidadeSalvos
                                    }
                                </span>

                            </button>

                        </div>


                        {/* LINHA DE AÇÕES */}

                        <div className="
                            flex
                            flex-col
                            sm:flex-row
                            gap-2
                        ">

                            {/* BUSCA */}

                            <div className="
                                relative
                            ">

                                <Search
                                    className="
                                        absolute
                                        left-3
                                        top-1/2
                                        -translate-y-1/2
                                        w-4
                                        h-4
                                        text-slate-400
                                    "
                                />

                                <Input
                                    value={busca}
                                    onChange={(e) =>
                                        setBusca(
                                            e.target.value
                                        )
                                    }
                                    placeholder="
                                        Buscar por nome, empresa ou CPF...
                                    "
                                    className="
                                        h-9
                                        pl-9
                                        pr-9
                                        text-xs
                                        bg-slate-50
                                        dark:bg-slate-800
                                        border-slate-200
                                        dark:border-slate-700
                                    "
                                />

                                {busca && (

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setBusca("")
                                        }
                                        className="
                                            absolute
                                            right-3
                                            top-1/2
                                            -translate-y-1/2
                                            text-slate-400
                                            hover:text-slate-600
                                        "
                                    >
                                        ×
                                    </button>

                                )}

                            </div>


                            {/* RESULTADO DA BUSCA */}

                            {busca && (

                                <div className="
                                    flex
                                    items-center
                                    px-2
                                    text-[10px]
                                    text-slate-400
                                ">
                                    {
                                        funcionariosFiltrados.length
                                    } resultado(s)
                                </div>

                            )}


                            {/* SALVAR SELECIONADOS */}

                            {abaAtiva ===
                                "pendentes" && (

                                    <Button
                                        type="button"
                                        onClick={
                                            handleSaveSelection
                                        }
                                        disabled={
                                            saving ||
                                            selectedCpfs.size ===
                                            0
                                        }
                                        className="
                                        h-9
                                        px-4
                                        text-[10px]
                                        font-black
                                        uppercase
                                        tracking-wide
                                        gap-2
                                        bg-blue-600
                                        hover:bg-blue-700
                                        disabled:opacity-50
                                        shrink-0
                                    "
                                    >

                                        {saving ? (

                                            <>

                                                <div className="
                                                w-3.5
                                                h-3.5
                                                border-2
                                                border-white/40
                                                border-t-white
                                                rounded-full
                                                animate-spin
                                            " />

                                                Salvando...

                                            </>

                                        ) : (

                                            <>

                                                <Save
                                                    className="
                                                    w-3.5
                                                    h-3.5
                                                "
                                                />

                                                Salvar

                                                {selectedCpfs.size >
                                                    0 &&
                                                    ` (${selectedCpfs.size})`}

                                            </>

                                        )}

                                    </Button>

                                )}

                        </div>

                    </div>

                </div>

            </CardHeader>


            {/* TABELA */}

            <CardContent className="
                p-0
                overflow-x-auto
            ">

                <Table>

                    <TableHeader className="
                        bg-slate-50
                        dark:bg-slate-800/80
                    ">

                        <TableRow className="
                            hover:bg-transparent
                        ">

                            <TableHead className="
                                w-12
                                text-center
                            ">

                                <Checkbox
                                    checked={
                                        allChecked
                                    }
                                    onCheckedChange={(
                                        checked
                                    ) =>
                                        handleSelectAll(
                                            !!checked
                                        )
                                    }
                                    disabled={
                                        disponiveisNaAba ===
                                        0
                                    }
                                />

                            </TableHead>


                            <SortHeader
                                label="Funcionário"
                                sortKeyValue="nome"
                            />

                            <SortHeader
                                label="CPF"
                                sortKeyValue="cpf"
                            />

                            <SortHeader
                                label="Empresa / Unidade"
                                sortKeyValue="empresa"
                            />

                            <SortHeader
                                label="Data Ficha"
                                sortKeyValue="dataFicha"
                            />

                            <SortHeader
                                label="Exames"
                                sortKeyValue="examesConcluidos"
                            />

                            <SortHeader
                                label="Observação"
                                sortKeyValue="observacao"
                            />

                            <SortHeader
                                label="Status"
                                sortKeyValue="resultadoAsoSoc"
                            />

                        </TableRow>

                    </TableHeader>


                    <TableBody>

                        {funcionariosPaginados.length ===
                            0 ? (

                            <TableRow>

                                <TableCell
                                    colSpan={7}
                                    className="
                                        text-center
                                        py-8
                                        text-xs
                                        text-slate-400
                                    "
                                >

                                    {abaAtiva ===
                                        "pendentes"

                                        ? "Nenhum funcionário pendente para montagem."

                                        : "Nenhum funcionário salvo ou com ASO montado nesta lista."}

                                </TableCell>

                            </TableRow>

                        ) : (

                            funcionariosPaginados.map(
                                (item) => {
                                    const isSelected =
                                        selectedCpfs.has(
                                            item.cpf
                                        );

                                    const jaMontado =
                                        isFuncionarioMontado(
                                            item
                                        );

                                    return (

                                        <TableRow
                                            key={
                                                item.cpf
                                            }
                                            className={`
                                                transition-all
                                                border-b
                                                dark:border-gray-800
                                                ${jaMontado
                                                    ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]"
                                                    : isSelected
                                                        ? "bg-blue-500/[0.06] hover:bg-blue-500/[0.09]"
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                }
                                            `}
                                        >

                                            {/* CHECKBOX */}

                                            <TableCell className="
                                                text-center
                                            ">

                                                {jaMontado ? (

                                                    <div
                                                        className="
                                                            mx-auto
                                                            flex
                                                            items-center
                                                            justify-center
                                                            w-5
                                                            h-5
                                                            rounded-full
                                                            bg-emerald-500/15
                                                        "
                                                        title="ASO já montado"
                                                    >

                                                        <CheckCircle2
                                                            className="
                                                                w-4
                                                                h-4
                                                                text-emerald-500
                                                            "
                                                        />

                                                    </div>

                                                ) : (

                                                    <Checkbox
                                                        checked={
                                                            isSelected
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            handleSelectOne(
                                                                item.cpf,
                                                                !!checked
                                                            )
                                                        }
                                                    />

                                                )}

                                            </TableCell>


                                            {/* FUNCIONÁRIO */}

                                            <TableCell>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRowClick(
                                                            item
                                                        )
                                                    }
                                                    className="
                                                        text-left
                                                        group
                                                        w-full
                                                    "
                                                >

                                                    <div className="
                                                        flex
                                                        items-center
                                                        gap-2.5
                                                    ">

                                                        {/* Avatar */}

                                                        <div
                                                            className={`
                                                                w-8
                                                                h-8
                                                                shrink-0
                                                                rounded-full
                                                                flex
                                                                items-center
                                                                justify-center
                                                                text-[10px]
                                                                font-black
                                                                ${jaMontado
                                                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                    : "bg-blue-500/10 text-blue-500"
                                                                }
                                                            `}
                                                        >

                                                            {jaMontado ? (

                                                                <CheckCircle2
                                                                    className="
                                                                        w-4
                                                                        h-4
                                                                    "
                                                                />

                                                            ) : (

                                                                item.nome
                                                                    ?.charAt(
                                                                        0
                                                                    )
                                                                    ?.toUpperCase()

                                                            )}

                                                        </div>


                                                        <div className="
                                                            min-w-0
                                                        ">

                                                            <div
                                                                className={`
                                                                    text-xs
                                                                    font-bold
                                                                    truncate
                                                                    ${jaMontado
                                                                        ? "text-emerald-700 dark:text-emerald-400"
                                                                        : "text-blue-600 dark:text-blue-400"
                                                                    }
                                                                    group-hover:underline
                                                                `}
                                                            >
                                                                {
                                                                    item.nome
                                                                }
                                                            </div>

                                                            <div className="
                                                                text-[9px]
                                                                text-slate-400
                                                                mt-0.5
                                                            ">
                                                                Clique para visualizar detalhes
                                                            </div>

                                                        </div>

                                                    </div>

                                                </button>

                                            </TableCell>


                                            {/* CPF */}

                                            <TableCell className="
                                                text-xs
                                                font-mono
                                                text-slate-500
                                            ">
                                                {
                                                    item.cpf
                                                }
                                            </TableCell>


                                            {/* EMPRESA */}

                                            <TableCell className="
                                                text-xs
                                                text-slate-600
                                                dark:text-slate-400
                                            ">

                                                <div
                                                    className="
                                                        max-w-[220px]
                                                        truncate
                                                    "
                                                    title={
                                                        item.empresa
                                                    }
                                                >
                                                    {
                                                        item.empresa
                                                    }
                                                </div>

                                            </TableCell>


                                            {/* DATA */}

                                            <TableCell className="
                                                text-xs
                                                font-mono
                                                text-slate-500
                                            ">
                                                {
                                                    item.dataFicha ||
                                                    "-"
                                                }
                                            </TableCell>


                                            {/* EXAMES */}

                                            <TableCell>

                                                <div className="
                                                    flex
                                                    items-center
                                                    gap-1.5
                                                ">

                                                    <span
                                                        className={`
                                                            text-xs
                                                            font-bold
                                                            ${jaMontado
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-slate-600 dark:text-slate-300"
                                                            }
                                                        `}
                                                    >
                                                        {
                                                            item.examesConcluidos
                                                        }
                                                    </span>

                                                    <span className="
                                                        text-[10px]
                                                        text-slate-400
                                                    ">
                                                        /
                                                        {" "}
                                                        {
                                                            item.totalExames
                                                        }
                                                    </span>

                                                    {jaMontado && (

                                                        <CheckCircle2
                                                            className="
                                                                w-3.5
                                                                h-3.5
                                                                text-emerald-500
                                                                ml-1
                                                            "
                                                        />

                                                    )}

                                                </div>

                                            </TableCell>

                                            <TableCell className="text-xs">
                                                {item.observacao || ""}
                                            </TableCell>


                                            {/* STATUS */}

                                            <TableCell>

                                                {jaMontado ? (

                                                    <Badge
                                                        variant="outline"
                                                        className="
                                                            text-[10px]
                                                            font-bold
                                                            bg-emerald-500/10
                                                            text-emerald-600
                                                            dark:text-emerald-400
                                                            border-emerald-500/30
                                                            gap-1
                                                        "
                                                    >

                                                        <CheckCircle2
                                                            className="
                                                                w-3
                                                                h-3
                                                            "
                                                        />

                                                        ASO MONTADO

                                                    </Badge>

                                                ) : (

                                                    <Badge
                                                        variant="outline"
                                                        className="
                                                            text-[10px]
                                                            font-bold
                                                            bg-blue-500/10
                                                            text-blue-600
                                                            dark:text-blue-400
                                                            border-blue-500/30
                                                            gap-1
                                                        "
                                                    >

                                                        <Clock3
                                                            className="
                                                                w-3
                                                                h-3
                                                            "
                                                        />

                                                        PRONTO PARA MONTAGEM

                                                    </Badge>

                                                )}

                                            </TableCell>

                                        </TableRow>
                                    );
                                }
                            )

                        )}

                    </TableBody>

                </Table>

            </CardContent>


            {/* =====================================================
                PAGINAÇÃO
            ===================================================== */}

            <div className="
                flex
                flex-col
                sm:flex-row
                items-center
                justify-between
                gap-3
                px-4
                py-3
                border-t
                border-gray-200
                dark:border-gray-800
                bg-slate-50/50
                dark:bg-slate-900/30
            ">

                {/* INFORMAÇÕES */}

                <div className="
                    flex
                    items-center
                    gap-3
                    text-[10px]
                    text-slate-400
                    uppercase
                    font-bold
                ">

                    <span>
                        {funcionariosFiltrados.length >
                            0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                funcionariosFiltrados.length
                            )} de ${funcionariosFiltrados.length}`
                            : "Nenhum resultado"}
                    </span>


                    {/* ITENS POR PÁGINA */}

                    <div className="
                        flex
                        items-center
                        gap-1.5
                    ">

                        <span>
                            Linhas:
                        </span>

                        <Select
                            value={String(
                                itensPorPagina
                            )}
                            onValueChange={(
                                value
                            ) => {

                                setItensPorPagina(
                                    Number(
                                        value
                                    )
                                );

                                setPaginaAtual(
                                    1
                                );
                            }}
                        >

                            <SelectTrigger className="
                                h-7
                                w-[65px]
                                text-[10px]
                                font-bold
                            ">

                                <SelectValue />

                            </SelectTrigger>

                            <SelectContent>

                                <SelectItem value="10">
                                    10
                                </SelectItem>

                                <SelectItem value="15">
                                    15
                                </SelectItem>

                                <SelectItem value="25">
                                    25
                                </SelectItem>

                                <SelectItem value="50">
                                    50
                                </SelectItem>

                            </SelectContent>

                        </Select>

                    </div>

                </div>


                {/* CONTROLES */}

                <div className="
                    flex
                    items-center
                    gap-1
                ">

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            paginaAtual ===
                            1
                        }
                        onClick={() =>
                            setPaginaAtual(
                                (prev) =>
                                    Math.max(
                                        1,
                                        prev - 1
                                    )
                            )
                        }
                        className="
                            h-7
                            px-2
                            text-[10px]
                            gap-1
                        "
                    >

                        <ChevronLeft
                            className="
                                w-3.5
                                h-3.5
                            "
                        />

                        <span className="
                            hidden
                            sm:inline
                        ">
                            Anterior
                        </span>

                    </Button>


                    {/* PÁGINAS */}

                    {Array.from(
                        {
                            length:
                                totalPaginas
                        },
                        (_, index) =>
                            index + 1
                    )
                        .filter(
                            (pagina) => {

                                if (
                                    totalPaginas <=
                                    7
                                ) {
                                    return true;
                                }

                                return (
                                    pagina ===
                                    1 ||

                                    pagina ===
                                    totalPaginas ||

                                    Math.abs(
                                        pagina -
                                        paginaAtual
                                    ) <= 1
                                );
                            }
                        )
                        .map(
                            (
                                pagina,
                                index,
                                array
                            ) => {

                                const paginaAnterior =
                                    array[
                                    index -
                                    1
                                    ];

                                const mostrarReticencias =
                                    paginaAnterior &&
                                    pagina -
                                    paginaAnterior >
                                    1;

                                return (

                                    <React.Fragment
                                        key={
                                            pagina
                                        }
                                    >

                                        {mostrarReticencias && (

                                            <span className="
                                                px-1
                                                text-[10px]
                                                text-slate-400
                                            ">
                                                ...
                                            </span>

                                        )}


                                        <Button
                                            type="button"
                                            variant={
                                                paginaAtual ===
                                                    pagina
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setPaginaAtual(
                                                    pagina
                                                )
                                            }
                                            className="
                                                h-7
                                                min-w-7
                                                px-2
                                                text-[10px]
                                                font-bold
                                            "
                                        >
                                            {
                                                pagina
                                            }
                                        </Button>

                                    </React.Fragment>

                                );
                            }
                        )}


                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            paginaAtual ===
                            totalPaginas
                        }
                        onClick={() =>
                            setPaginaAtual(
                                (prev) =>
                                    Math.min(
                                        totalPaginas,
                                        prev + 1
                                    )
                            )
                        }
                        className="
                            h-7
                            px-2
                            text-[10px]
                            gap-1
                        "
                    >

                        <span className="
                            hidden
                            sm:inline
                        ">
                            Próxima
                        </span>

                        <ChevronRight
                            className="
                                w-3.5
                                h-3.5
                            "
                        />

                    </Button>

                </div>

            </div>


            {/* MODAL DE DETALHES DO FUNCIONÁRIO */}

            <FuncionarioModal
                open={
                    modalOpen
                }
                onOpenChange={(
                    open
                ) => {

                    setModalOpen(
                        open
                    );

                    if (!open) {

                        setSelectedFuncionario(
                            null
                        );
                    }
                }}
                funcionario={
                    selectedFuncionario
                }
            />

        </Card>
    );
}

/* ============================================================
    COMPONENT REUTILIZÁVEL: MODAL DETALHES DO FUNCIONÁRIO
============================================================ */
function FuncionarioModal({ open, onOpenChange, funcionario }: { open: boolean; onOpenChange: (open: boolean) => void; funcionario: any }) {
    if (!funcionario) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <DialogHeader>
                    <DialogTitle className="text-base font-black uppercase text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-500" /> Detalhes do Funcionário
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        Ficha individual com os exames realizados e status do atendimento.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-xs mt-2">
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Nome</span>
                            <strong className="text-slate-800 dark:text-slate-200 text-sm">{funcionario.nome}</strong>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">CPF</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{funcionario.cpf || "-"}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Empresa</span>
                            <span className="text-slate-700 dark:text-slate-300 font-bold">{funcionario.empresa}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Data Ficha</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{funcionario.dataFicha || "Não emitida"}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Médico Responsável</span>
                            <span className="text-slate-700 dark:text-slate-300">{funcionario.medico} (CRM: {funcionario.crmMedico})</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-mono">Resultado ASO</span>
                            <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold text-[10px]">
                                {funcionario.resultadoAsoSoc || "N/A"}
                            </Badge>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 uppercase mb-2 text-[11px]">
                            Lista de Exames ({funcionario.listaExamesResumida?.length || 0})
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {funcionario.listaExamesResumida && funcionario.listaExamesResumida.length > 0 ? (
                                funcionario.listaExamesResumida.map((e: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-2 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{e.descricaoExame || e}</span>
                                        <Badge variant="outline" className={e.isPendente ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}>
                                            {e.isPendente ? "Pendente" : "Concluído"}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400 text-center py-4">Nenhum exame detalhado disponível.</p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ============================================================
    VIEW ANALYTICS & GRÁFICOS (GERAL)
============================================================ */
// function ViewGeralSocged({ analytics }: { analytics: any }) {
//     if (!analytics) {
//         return (
//             <div className="text-center py-20 text-xs font-mono text-slate-400 uppercase bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-700">
//                 Importe uma planilha Excel para visualizar o Dashboard.
//             </div>
//         );
//     }

//     const tiposExameData = Object.entries(analytics.quantidadePorTipoExame || {}).map(([tipo, qtd]) => ({
//         tipo,
//         total: Number(qtd) || 0
//     })).sort((a, b) => b.total - a.total);

//     const statusAsoData = Object.entries(analytics.distribuicaoStatusAso || {}).map(([status, qtd]) => ({
//         name: status,
//         total: Number(qtd) || 0
//     }));

//     const maxVal = tiposExameData.length > 0 ? Math.max(...tiposExameData.map((d) => d.total || 0)) : 10;
//     const limiteX = Math.ceil(maxVal * 1.2);

//     return (
//         <div className="space-y-4">
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

//                 <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
//                     <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
//                         <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
//                             <Layers className="w-4 h-4 text-orange-500" /> Quantidade por Tipo de Exame
//                         </CardTitle>
//                     </CardHeader>
//                     <CardContent className="h-[350px] pt-4">
//                         <ResponsiveContainer width="100%" height="100%">
//                             <BarChart data={tiposExameData} layout="vertical" margin={{ top: 10, right: 35, left: 10, bottom: 5 }}>
//                                 <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
//                                 <XAxis type="number" domain={[0, limiteX]} tick={{ fontSize: 10 }} />
//                                 <YAxis dataKey="tipo" type="category" tick={{ fontSize: 11 }} width={160} />
//                                 <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
//                                 <Bar dataKey="total" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={16} name="Quantidade">
//                                     <LabelList dataKey="total" position="right" offset={10} style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }} />
//                                 </Bar>
//                             </BarChart>
//                         </ResponsiveContainer>
//                     </CardContent>
//                 </Card>

//                 <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
//                     <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
//                         <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
//                             <Clock className="w-4 h-4 text-blue-500" /> Distribuição por Status do ASO
//                         </CardTitle>
//                     </CardHeader>
//                     <CardContent className="h-[350px] pt-4">
//                         <ResponsiveContainer width="100%" height="100%">
//                             <PieChart>
//                                 <Pie
//                                     data={statusAsoData}
//                                     dataKey="total"
//                                     nameKey="name"
//                                     cx="50%"
//                                     cy="50%"
//                                     innerRadius={60}
//                                     outerRadius={90}
//                                     label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
//                                 >
//                                     {statusAsoData.map((entry, index) => (
//                                         <Cell
//                                             key={`cell-${index}`}
//                                             fill={entry.name.toLowerCase().includes("conclui") || entry.name.toLowerCase().includes("pronto") || entry.name.toLowerCase().includes("apto") ? THEME_COLORS.success : THEME_COLORS.secondary}
//                                         />
//                                     ))}
//                                 </Pie>
//                                 <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
//                                 <Legend wrapperStyle={{ fontSize: '12px' }} />
//                             </PieChart>
//                         </ResponsiveContainer>
//                     </CardContent>
//                 </Card>
//             </div>
//         </div>
//     );
// }