"use client"

import React, { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// UI Components
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CardIndicador } from "@/components/atendimento/dashboards/CardIndicator";

// Icons
import {
    Activity,
    Upload,
    Users,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
} from "lucide-react";

// Types & Utils
import { ViewType, FiltroTipoExame, PrazosMap } from "./types";
import { classificarTipoExame } from "./utils";

// Subcomponents
import { ViewDashboard } from "./components/ViewDashboard";
import { ViewExamesPendentes } from "./components/ViewExamesPendentes";
import { ViewExamesConcluidos } from "./components/ViewExamesConcluidos";

export default function IndicadoresSocged() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [view, setView] = useState<ViewType>("geral");
    const [unidadeId, setUnidadeId] = useState("");
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [dadosGraficos, setDadosGraficos] = useState<any>(null);
    const [prazosMap, setPrazosMap] = useState<PrazosMap>({});
    const [funcionariosSalvos, setFuncionariosSalvos] = useState<Set<string>>(new Set());
    const [filtroTipoExame, setFiltroTipoExame] = useState<FiltroTipoExame>("todos");

    /* ============================================================
       CONTEXTO DO USUÁRIO
    ============================================================ */
    useEffect(() => {
        const fetchUserContext = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("unidade_id")
                .eq("id", user.id)
                .single();

            if (profile?.unidade_id) {
                setUnidadeId(profile.unidade_id);
            }
        };

        fetchUserContext();
    }, []);

    /* ============================================================
       CARREGA PRAZOS DOS EXAMES
    ============================================================ */
    useEffect(() => {
        async function loadPrazos() {
            const { data } = await supabase
                .from("prazos_exames")
                .select("nome_exame, prazo_dias");

            if (!data) return;

            const mapa: Record<string, number> = {};
            data.forEach((p) => {
                if (!p.nome_exame) return;
                mapa[p.nome_exame.trim().toLowerCase()] = p.prazo_dias;
            });

            setPrazosMap(mapa);
        }

        loadPrazos();
    }, []);

    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */
    const funcionariosFiltradosTipo = useMemo(() => {
        if (filtroTipoExame === "todos") {
            return dadosRelatorio;
        }

        return dadosRelatorio.filter((item) => {
            const funcionario = item.socResumo || item;
            return classificarTipoExame(funcionario) === filtroTipoExame;
        });
    }, [dadosRelatorio, filtroTipoExame]);

    /* ============================================================
       MÉTRICAS PRINCIPAIS
    ============================================================ */
    const totalFuncionarios = funcionariosFiltradosTipo.length;

    const funcionariosConcluidos = useMemo(() => {
        return funcionariosFiltradosTipo.filter((item) => {
            const res = item.socResumo || item;
            const pendentes = Number(
                Array.isArray(res.examesPendentes)
                    ? res.examesPendentes.length
                    : res.examesPendentes ?? 0
            );
            return pendentes === 0;
        }).length;
    }, [funcionariosFiltradosTipo]);

    const funcionariosPendentes = useMemo(() => {
        return funcionariosFiltradosTipo.filter((item) => {
            const res = item.socResumo || item;
            const pendentes = Number(
                Array.isArray(res.examesPendentes)
                    ? res.examesPendentes.length
                    : res.examesPendentes ?? 0
            );
            return pendentes > 0;
        }).length;
    }, [funcionariosFiltradosTipo]);

    /* ============================================================
       UPLOAD DO EXCEL E POLLING
    ============================================================ */
    async function handleFileSubmit(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setFuncionariosSalvos(new Set());
        setLoading(true);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("unidadeId", unidadeId);

        try {
            const start = await fetch("/api/importar-excel-asos", {
                method: "POST",
                body: formData,
            });

            if (!start.ok) {
                toast.error("Erro ao enviar arquivo Excel.");
                setLoading(false);
                return;
            }

            const data = await start.json();
            const jobId = data.jobId;

            if (!jobId) {
                toast.error("Não foi possível iniciar o processamento.");
                setLoading(false);
                return;
            }

            toast.info("Arquivo enviado. Processando dados...");

            let terminou = false;

            while (!terminou) {
                await new Promise((r) => setTimeout(r, 3000));

                const status = await fetch(`/api/consulta-relatorios/?id=${jobId}`);
                if (!status.ok) continue;

                const resultado = await status.json();
                const respostaBruta = Array.isArray(resultado)
                    ? resultado[0]
                    : resultado;
                const resposta = respostaBruta.json ?? respostaBruta;

                if (resposta.status === "processing") {
                    continue;
                }

                if (resposta.status === "empty") {
                    toast.warning("0 registros encontrados no Excel.");
                    setDadosRelatorio([]);
                    setDadosGraficos(null);
                    terminou = true;
                }

                if (resposta.status === "done") {
                    terminou = true;
                    const analyticsData = resposta.data?.analytics || null;
                    const funcionariosList = resposta.data?.funcionarios || [];
                    console.log(funcionariosList)

                    setDadosRelatorio(funcionariosList);
                    setDadosGraficos(analyticsData);

                    const total =
                        analyticsData?.totalFuncionarios ?? funcionariosList.length;

                    toast.success(`${total} funcionários processados com sucesso!`);
                }
            }
        } catch (error) {
            toast.error("Erro ao importar e processar o arquivo.");
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }

    return (
        <div className="min-h-fit mt-2 bg-gray-500/20 rounded-xl p-2">
            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>

                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">
                            Gestão de ASOs
                        </h1>
                        <p className="text-xs text-slate-400 font-mono">
                            Importe o relatório SOCGED para análise
                        </p>
                    </div>
                </div>

                {/* FILTRO */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                        Filtrar por:
                    </span>

                    <div className="relative">
                        <select
                            value={filtroTipoExame}
                            onChange={(e) =>
                                setFiltroTipoExame(e.target.value as FiltroTipoExame)
                            }
                            className="h-9 min-w-[170px] appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 pr-8 text-[10px] font-bold uppercase tracking-wide text-slate-200 outline-none transition-all cursor-pointer hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                        >
                            <option value="todos">Todos os exames</option>
                            <option value="clinico">Exames clínicos</option>
                            <option value="complementar">Exames complementares</option>
                        </select>

                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>

                {/* TABS + IMPORTAR */}
                <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
                    <Tabs
                        value={view}
                        onValueChange={(v) => setView(v as ViewType)}
                        className="bg-slate-800 p-1 rounded-lg border border-slate-700"
                    >
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger
                                value="geral"
                                className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger
                                value="pendencias"
                                className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Exames Pendentes
                            </TabsTrigger>
                            <TabsTrigger
                                value="concluidos"
                                className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Exames Concluídos
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap gap-2 text-sm items-center w-full lg:w-auto justify-end">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSubmit}
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                        />

                        <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            className="h-10 font-bold uppercase text-[10px] gap-2 tracking-wider bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white transition-all"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {loading ? "Processando..." : "Importar Excel"}
                        </Button>
                    </div>
                </div>
            </header>

            {/* LOADING */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                        Processando dados...
                    </p>
                    <p className="text-red-400 text-xs font-medium uppercase">
                        Como estamos consultando o SOC, este processamento pode demorar um pouco. Por favor, aguarde!
                    </p>
                </div>
            ) : (
                <>
                    {/* CARDS PRINCIPAIS */}
                    <div className="grid gap-4 my-4 grid-cols-1 md:grid-cols-3">
                        {/* TOTAL */}
                        <CardIndicador
                            titulo="Total ASO'S"
                            valor={totalFuncionarios}
                            subtitulo={
                                filtroTipoExame === "todos"
                                    ? "Todos os ASO's"
                                    : filtroTipoExame === "clinico"
                                        ? "Exames clínicos"
                                        : "Exames complementares"
                            }
                            icon={<Users size={24} className="text-blue-500" />}
                        />

                        {/* CONCLUÍDOS */}
                        <CardIndicador
                            titulo="ASO's Concluídos"
                            valor={funcionariosConcluidos}
                            subtitulo="Prontos para montagem"
                            icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                        />

                        {/* PENDENTES */}
                        <CardIndicador
                            titulo="ASO's Pendentes"
                            valor={funcionariosPendentes}
                            subtitulo="Possuem exames pendentes"
                            icon={<AlertCircle size={24} className="text-amber-500" />}
                        />
                    </div>

                    {/* VIEW PENDÊNCIAS */}
                    {view === "pendencias" && (
                        <ViewExamesPendentes
                            analytics={dadosGraficos}
                            todosFuncionarios={dadosRelatorio}
                            filtroTipoExame={filtroTipoExame}
                        />
                    )}

                    {/* VIEW CONCLUÍDOS */}
                    {view === "concluidos" && (
                        <ViewExamesConcluidos
                            todosFuncionarios={dadosRelatorio}
                            funcionariosSalvos={funcionariosSalvos}
                            onFuncionariosSalvos={(cpfs) => {
                                setFuncionariosSalvos((prev) => {
                                    const novoSet = new Set(prev);
                                    cpfs.forEach((cpf) => novoSet.add(cpf));
                                    return novoSet;
                                });
                            }}
                            filtroTipoExame={filtroTipoExame}
                            unidadeId={unidadeId}
                        />
                    )}

                    {/* VIEW DASHBOARD */}
                    {view === "geral" && (
                        <ViewDashboard
                            analytics={dadosGraficos}
                            todosFuncionarios={dadosRelatorio}
                            filtroTipoExame={filtroTipoExame}
                            prazosMap={prazosMap}
                        />
                    )}
                </>
            )}
        </div>
    );
}
