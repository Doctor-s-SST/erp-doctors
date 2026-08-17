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

type ViewType = "geral" | "pendencias" | "concluidos";

function possuiAsoMontado(observacao?: string): boolean {
    if (!observacao) return false;
    return observacao.toLowerCase().includes("aso montado") || observacao.toLowerCase().includes("aso emitido") || observacao.toLowerCase().includes("montado");
}

const compararValores = (a: any, b: any, key: string) => {
    let valA = a[key];
    let valB = b[key];

    if (key === "statusVencimento") {
        valA = a.statusVencimento?.label || "";
        valB = b.statusVencimento?.label || "";
    } else if (key === "examesList") {
        valA = Array.isArray(a.examesList) ? a.examesList.join(", ") : "";
        valB = Array.isArray(b.examesList) ? b.examesList.join(", ") : "";
    }

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === "string") {
        return valA.localeCompare(String(valB));
    }

    return valA > valB ? 1 : valA < valB ? -1 : 0;
};

export default function IndicadoresSocged() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [view, setView] = useState<ViewType>("geral");
    const [unidadeId, setUnidadeId] = useState("");
    const [loading, setLoading] = useState(false);

    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [dadosGraficos, setDadosGraficos] = useState<any>(null);

    // Funcionários que já foram enviados/salvos durante esta importação.
    // Não é persistido no banco; existe somente enquanto a página estiver aberta.
    const [funcionariosSalvos, setFuncionariosSalvos] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchUserContext = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('unidade_id')
                    .eq('id', user.id)
                    .single();

                if (profile?.unidade_id) {
                    setUnidadeId(profile.unidade_id);
                }
            }
        };
        fetchUserContext();
    }, []);

    // Função de Upload disparando para o N8N via API Route
    async function handleFileSubmit(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        setFuncionariosSalvos(new Set());
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('unidadeId', unidadeId);

        try {
            const start = await fetch('/api/importar-excel-asos', {
                method: 'POST',
                body: formData,
            });

            if (!start.ok) {
                toast.error('Erro ao enviar arquivo Excel.');
                setLoading(false);
                return;
            }

            const data = await start.json();
            const jobId = data.jobId;

            if (!jobId) {
                toast.error('Não foi possível iniciar o processamento.');
                setLoading(false);
                return;
            }

            toast.info('Arquivo enviado. Processando dados...');

            let terminou = false;

            while (!terminou) {
                await new Promise((r) => setTimeout(r, 3000));

                const status = await fetch(`/api/consulta-relatorios/?id=${jobId}`);
                if (!status.ok) continue;

                const resultado = await status.json();
                const respostaBruta = Array.isArray(resultado) ? resultado[0] : resultado;
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

                    setDadosRelatorio(funcionariosList);
                    setDadosGraficos(analyticsData);

                    const total = analyticsData?.totalFuncionarios ?? funcionariosList.length;
                    toast.success(`${total} funcionários processados com sucesso!`);
                }
            }
        } catch (error) {
            console.error("Erro no processamento:", error);
            toast.error("Erro ao importar e processar o arquivo.");
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }

    const totalFuncionarios = Number(dadosGraficos?.totalFuncionarios ?? dadosRelatorio.length ?? 0);

    const totalExames = Number(
        dadosGraficos?.totalExames ?? 0
    );

    const totalExamesPendentes = Number(
        dadosGraficos?.totalExamesPendentes ?? 0
    );

    const totalExamesConcluidos = Number(
        dadosGraficos?.totalExamesConcluidos ?? 0
    );

    // Quantidade de FUNCIONÁRIOS que possuem pelo menos 1 exame pendente
    const funcionariosComPendencias = useMemo(() => {
        return dadosRelatorio.filter((item) => {
            const res = item.socResumo || item;

            if (!res) return false;

            const pendentes = Number(
                Array.isArray(res.examesPendentes)
                    ? res.examesPendentes.length
                    : res.examesPendentes ?? 0
            );

            return pendentes > 0;
        }).length;
    }, [dadosRelatorio]);

    // Média sempre apresentada como número inteiro
    const mediaExamesPorFuncionario = Math.round(
        Number(dadosGraficos?.mediaExamesPorFuncionario ?? 0)
    );

    return (
        <div className="min-h-fit mt-2 bg-gray-500/20 rounded-xl p-2">
            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">Gestão de ASOs</h1>
                        <p className="text-xs text-slate-400 font-mono">Importe o relatório SOCGED para análise</p>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
                    <Tabs value={view} onValueChange={(v) => setView(v as ViewType)} className="bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger value="geral" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all">
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger value="pendencias" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all">
                                Exames Pendentes
                            </TabsTrigger>
                            <TabsTrigger value="concluidos" className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold transition-all">
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

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Processando dados...</p>
                    <p className="text-red-400 text-xs font-medium uppercase">Como estamos consultando o SOC, este processamento pode demorar um pouco. Por favor, aguarde!</p>
                </div>
            ) : (
                <>
                    {/* CARDS INDICADORES */}
                    <div className="grid gap-4 my-4 grid-cols-2 md:grid-cols-5 lg:grid-cols-6">

                        <CardIndicador
                            titulo="Total Funcionários"
                            valor={totalFuncionarios}
                            subtitulo="No Excel importado"
                            icon={
                                <Users size={24} className="text-blue-500" />
                            }
                        />

                        {/* NOVO CARD */}
                        <CardIndicador
                            titulo="Funcionários Pendentes"
                            valor={funcionariosComPendencias}
                            subtitulo="Possuem exames pendentes"
                            icon={
                                <UserCheck size={24} className="text-amber-500" />
                            }
                        />

                        {/* <CardIndicador
                            titulo="Total Exames"
                            valor={totalExames}
                            subtitulo="Exames solicitados"
                            icon={
                                <FileText size={24} className="text-orange-500" />
                            }
                        /> */}

                        <CardIndicador
                            titulo="Exames Concluídos"
                            valor={totalExamesConcluidos}
                            subtitulo="Exames realizados"
                            icon={
                                <CheckCircle2 size={24} className="text-emerald-500" />
                            }
                        />

                        <CardIndicador
                            titulo="Exames Pendentes"
                            valor={totalExamesPendentes}
                            subtitulo="Exames aguardando"
                            icon={
                                <AlertCircle size={24} className="text-red-500" />
                            }
                        />

                        <CardIndicador
                            titulo="Média p/ Funcionário"
                            valor={mediaExamesPorFuncionario}
                            subtitulo="Exames por pessoa"
                            icon={
                                <Activity size={24} className="text-violet-500" />
                            }
                        />

                    </div>

                    {view === "geral" && <ViewGeralSocged analytics={dadosGraficos} />}
                    {view === "pendencias" && (
                        <ViewExamesPendentes
                            analytics={dadosGraficos}
                            todosFuncionarios={dadosRelatorio}
                        />
                    )}
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
                        />
                    )}
                </>
            )}
        </div>
    )
}

/* ============================================================
    VIEW ANALYTICS & GRÁFICOS (GERAL)
============================================================ */
function ViewGeralSocged({ analytics }: { analytics: any }) {
    if (!analytics) {
        return (
            <div className="text-center py-20 text-xs font-mono text-slate-400 uppercase bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-700">
                Importe uma planilha Excel para visualizar o Dashboard.
            </div>
        );
    }

    const tiposExameData = Object.entries(analytics.quantidadePorTipoExame || {}).map(([tipo, qtd]) => ({
        tipo,
        total: Number(qtd) || 0
    })).sort((a, b) => b.total - a.total);

    const statusAsoData = Object.entries(analytics.distribuicaoStatusAso || {}).map(([status, qtd]) => ({
        name: status,
        total: Number(qtd) || 0
    }));

    const maxVal = tiposExameData.length > 0 ? Math.max(...tiposExameData.map((d) => d.total || 0)) : 10;
    const limiteX = Math.ceil(maxVal * 1.2);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
                    <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                        <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-orange-500" /> Quantidade por Tipo de Exame
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tiposExameData} layout="vertical" margin={{ top: 10, right: 35, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                                <XAxis type="number" domain={[0, limiteX]} tick={{ fontSize: 10 }} />
                                <YAxis dataKey="tipo" type="category" tick={{ fontSize: 11 }} width={160} />
                                <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                <Bar dataKey="total" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={16} name="Quantidade">
                                    <LabelList dataKey="total" position="right" offset={10} style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
                    <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                        <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" /> Distribuição por Status do ASO
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusAsoData}
                                    dataKey="total"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {statusAsoData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.name.toLowerCase().includes("conclui") || entry.name.toLowerCase().includes("pronto") || entry.name.toLowerCase().includes("apto") ? THEME_COLORS.success : THEME_COLORS.secondary}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/* ============================================================
    VIEW FUNCIONÁRIOS COM EXAMES PENDENTES
============================================================ */
export function ViewExamesPendentes({
    analytics,
    todosFuncionarios,
}: {
    analytics: any;
    todosFuncionarios: any[];
}) {
    const pendencias = analytics?.funcionariosComExamesPendentes || [];

    const [prazosMap, setPrazosMap] = useState<Record<string, number>>({});
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [busca, setBusca] = useState("");
    const [sortKey, setSortKey] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    /* ============================================================
        ORDENAÇÃO
    ============================================================ */
    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
        DATAS / PRAZOS
    ============================================================ */
    const parseDateBR = (dateStr: string | null) => {
        if (!dateStr) return null;
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
        return null;
    };

    const calcularStatusVencimento = (dataFicha: string | null, prazoDias: number | null) => {
        if (!dataFicha || prazoDias === null) {
            return {
                label: "Sem Prazo",
                color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                estaVencido: false,
            };
        }

        const dataBase = parseDateBR(dataFicha);

        if (!dataBase) {
            return {
                label: "Data Inválida",
                color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
                estaVencido: false,
            };
        }

        const dataLimite = new Date(dataBase);
        dataLimite.setDate(dataLimite.getDate() + prazoDias);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const diffTime = dataLimite.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                label: `Vencido há ${Math.abs(diffDays)}d`,
                color: "bg-red-500/20 text-red-500 border-red-500/30",
                estaVencido: true,
            };
        }

        if (diffDays <= 3) {
            return {
                label: `Vence em ${diffDays}d`,
                color: "bg-amber-500/20 text-amber-500 border-amber-500/30",
                estaVencido: false,
            };
        }

        return {
            label: `No prazo (${diffDays}d)`,
            color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
            estaVencido: false,
        };
    };

    /* ============================================================
        CARREGA PRAZOS
    ============================================================ */
    useEffect(() => {
        async function loadPrazos() {
            // Certifique-se de importar o client 'supabase' na sua aplicação
            const { data } = await supabase.from("prazos_exames").select("nome_exame, prazo_dias");

            if (data) {
                const mapa: Record<string, number> = {};
                data.forEach((p) => {
                    if (p.nome_exame) {
                        mapa[p.nome_exame.trim().toLowerCase()] = p.prazo_dias;
                    }
                });
                setPrazosMap(mapa);
            }
        }

        loadPrazos();
    }, []);

    /* ============================================================
        MAPA DOS FUNCIONÁRIOS
    ============================================================ */
    const funcionariosMapeados = useMemo(() => {
        const map = new Map<string, any>();

        todosFuncionarios?.forEach((item) => {
            const res = item.socResumo || item;
            if (!res) return;

            const cpf = res.cpfFuncionario || res.cpf;
            if (!cpf) return;

            map.set(cpf, {
                nome: res.nomeFuncionario || res.nome,
                cpf,
                empresa: res.razaoSocial || res.empresa || "-",
                codigoEmpresa: res.codigoEmpresa || "-",
                codigoFuncionario: res.codigoFuncionario || "-",
                dataAso: res.dataAso || res.dataPedido || null,
                dataFicha: res.dataFicha || res.dataPedido || null,
                resultadoAsoSoc: res.resultadoAsoSoc || "Pendente",
                medico: res.medico || "Não informado",
                crmMedico: res.crmMedico || "-",
                totalExames: res.totalExames || 0,
                examesPendentes: res.examesPendentes || 0,
                examesConcluidos: res.examesConcluidos || 0,
                listaExamesResumida: res.listaExamesResumida || [],
            });
        });

        return map;
    }, [todosFuncionarios]);

    /* ============================================================
        PROCESSA + FILTRA + ORDENA
    ============================================================ */
    const pendenciasProcessadas = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const lista = pendencias.map((item: any) => {
            const cpf = item.cpfFuncionario || item.cpf;
            const fDados = funcionariosMapeados.get(cpf);

            const nome = item.nomeFuncionario || item.nome || fDados?.nome || "Não Informado";
            const empresa = fDados?.empresa || item.empresa || item.unidade || "-";
            const dataFicha = fDados?.dataFicha || item.dataFicha || null;

            const examesList: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            let maiorPrazo: number | null = null;

            examesList.forEach((exame) => {
                if (!exame) return;
                const prazo = prazosMap[exame.trim().toLowerCase()];

                if (prazo !== undefined && (maiorPrazo === null || prazo > maiorPrazo)) {
                    maiorPrazo = prazo;
                }
            });

            const statusVencimento = calcularStatusVencimento(dataFicha, maiorPrazo);

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
        });

        const filtrada = lista.filter((item: any) => {
            if (!termo) return true;
            return (
                String(item.nome).toLowerCase().includes(termo) ||
                String(item.empresa).toLowerCase().includes(termo)
            );
        });

        filtrada.sort((a: any, b: any) => {
            const resultado = compararValores(a, b, sortKey);
            return sortDirection === "asc" ? resultado : -resultado;
        });

        return filtrada;
    }, [pendencias, funcionariosMapeados, prazosMap, busca, sortKey, sortDirection]);

    const totalFuncionariosPendentes = pendencias.length;
    const totalGeralFuncionarios = analytics?.totalFuncionarios || funcionariosMapeados.size;

    const totalFuncionariosConcluidos = Math.max(
        0,
        totalGeralFuncionarios - totalFuncionariosPendentes
    );

    const handleRowClick = (cpf: string, itemPendente: any) => {
        const fCompleto = funcionariosMapeados.get(cpf);
        if (fCompleto) {
            setSelectedFuncionario(fCompleto);
        } else {
            setSelectedFuncionario({
                nome: itemPendente.nomeFuncionario || itemPendente.nome,
                cpf: itemPendente.cpfFuncionario || itemPendente.cpf,
                empresa: itemPendente.empresa || "-",
                dataAso: itemPendente.dataAso || null,
                dataFicha: itemPendente.dataFicha || null,
                resultadoAsoSoc: "Pendente",
                totalExames: itemPendente.examesPendentes?.length || 0,
                examesPendentes: itemPendente.examesPendentes?.length || 0,
                examesConcluidos: 0,
                listaExamesResumida: (itemPendente.examesPendentes || []).map((e: string) => ({
                    descricaoExame: e,
                    isPendente: true,
                    dataExame: "-",
                })),
            });
        }
        setModalOpen(true);
    };

    if (!analytics || pendencias.length === 0) {
        return (
            <div className="text-center py-20 text-xs font-mono text-slate-400 uppercase bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-700">
                {analytics
                    ? "Nenhum funcionário com exames pendentes!"
                    : "Importe uma planilha Excel para ver os exames pendentes."}
            </div>
        );
    }

    const SortHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: string }) => (
        <TableHead
            className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none"
            onClick={() => handleSort(sortKeyValue)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortKey === sortKeyValue ? (
                    sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                    ) : (
                        <ArrowDown className="w-3 h-3" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
            </div>
        </TableHead>
    );

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <CardTitle className="text-sm font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        Funcionários com Exames Pendentes
                        <Badge
                            variant="outline"
                            className="text-[10px] border-red-500/30 text-red-500 bg-red-500/5"
                        >
                            {pendenciasProcessadas.length}
                        </Badge>
                    </CardTitle>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar funcionário ou empresa..."
                                className="pl-9 h-9 text-xs"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                            <div>
                                <div className="text-[9px] uppercase font-bold text-slate-400">Progresso</div>
                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                    {totalFuncionariosConcluidos} de {totalGeralFuncionarios} concluídos
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                            <SortHeader label="Funcionário" sortKeyValue="nome" />
                            <SortHeader label="Empresa / Unidade" sortKeyValue="empresa" />
                            <SortHeader label="Data Ficha" sortKeyValue="dataFicha" />
                            <SortHeader label="Exames Pendentes" sortKeyValue="examesList" />
                            <SortHeader label="Maior Prazo" sortKeyValue="maiorPrazo" />
                            <SortHeader label="Status Vencimento" sortKeyValue="statusVencimento" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pendenciasProcessadas.map((item: any, idx: number) => {
                            return (
                                <TableRow
                                    key={idx}
                                    className="hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                                >
                                    <TableCell className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => handleRowClick(item.cpf, item)}
                                            className="text-left font-bold flex items-center gap-1.5"
                                        >
                                            {item.nome}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                        {item.empresa}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                        {item.dataFicha || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {item.examesList.map((exame: string, eIdx: number) => {
                                                const prazoExame = prazosMap[exame.trim().toLowerCase()];
                                                return (
                                                    <Badge
                                                        key={eIdx}
                                                        variant="outline"
                                                        className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] gap-1"
                                                    >
                                                        {exame}
                                                        {prazoExame !== undefined && (
                                                            <span className="text-[9px] font-bold text-amber-500">
                                                                ({prazoExame}d)
                                                            </span>
                                                        )}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {item.maiorPrazo !== null ? (
                                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                                                {item.maiorPrazo} dia(s)
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400 font-mono text-[10px]">
                                                Não definido
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={`font-bold text-[10px] border ${item.statusVencimento.color}`}
                                        >
                                            {item.statusVencimento.label}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>

            <FuncionarioModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                funcionario={selectedFuncionario}
            />
        </Card>
    );
}


interface ViewExamesConcluidosProps {
    todosFuncionarios: any[];
    funcionariosSalvos: Set<string>;
    onFuncionariosSalvos: (cpfs: string[]) => void;
}

/* ============================================================
    VIEW FUNCIONÁRIOS COM TODOS EXAMES CONCLUÍDOS
============================================================ */
export function ViewExamesConcluidos({
    todosFuncionarios,
    funcionariosSalvos,
    onFuncionariosSalvos,
}: ViewExamesConcluidosProps) {
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    const [busca, setBusca] = useState("");
    const [sortKey, setSortKey] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    /*
     * Funcionários que já chegaram da API com todos os exames concluídos.
     */
    const funcionariosConcluidos = useMemo(() => {
        const lista: any[] = [];

        todosFuncionarios.forEach((item) => {
            const res = item.socResumo || item;

            if (!res) return;

            const cpf = String(
                res.cpfFuncionario || res.cpf || ""
            ).trim();

            if (!cpf) return;

            const pendentesCount = Number(
                Array.isArray(res.examesPendentes)
                    ? res.examesPendentes.length
                    : res.examesPendentes ?? 0
            );

            if (pendentesCount === 0) {
                lista.push({
                    nome: res.nomeFuncionario || res.nome || "Não informado",
                    cpf,
                    empresa:
                        res.razaoSocial ||
                        res.empresa ||
                        "-",
                    codigoEmpresa: res.codigoEmpresa || "-",
                    codigoGed: res.codigoGed || "-",
                    codigoFuncionario: res.codigoFuncionario || "-",
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
                    crmMedico: res.crmMedico || "-",
                    totalExames: Number(res.totalExames || 0),
                    examesPendentes: 0,
                    observacao: res.observacao || res.observação || "",
                    examesConcluidos: Number(
                        res.examesConcluidos ||
                        res.totalExames ||
                        0
                    ),
                    listaExamesResumida: res.listaExamesResumida || [],
                });
            }
        });

        return lista;
    }, [todosFuncionarios]);

    const funcionariosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const lista = funcionariosConcluidos.filter((f) => {
            if (!termo) return true;

            return (
                f.nome.toLowerCase().includes(termo) ||
                f.empresa.toLowerCase().includes(termo) ||
                f.cpf.includes(termo)
            );
        });

        lista.sort((a, b) => {
            const av = a[sortKey] ?? "";
            const bv = b[sortKey] ?? "";

            const resultado =
                typeof av === "number" && typeof bv === "number"
                    ? av - bv
                    : String(av).localeCompare(String(bv), "pt-BR", {
                        numeric: true,
                    });

            return sortDirection === "asc" ? resultado : -resultado;
        });

        return lista;
    }, [
        funcionariosConcluidos,
        busca,
        sortKey,
        sortDirection,
    ]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) =>
                prev === "asc" ? "desc" : "asc"
            );
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /*
     * Limpa seleções quando a planilha muda.
     */
    useEffect(() => {
        setSelectedCpfs(new Set());
    }, [todosFuncionarios]);

    // Atualizado para considerar apenas os itens visíveis/filtrados
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const todosVisiveisDisponiveis = funcionariosFiltrados
                .filter(
                    (f) =>
                        !funcionariosSalvos.has(f.cpf) &&
                        !possuiAsoMontado(f.observacao)
                )
                .map((f) => f.cpf);

            setSelectedCpfs(new Set(todosVisiveisDisponiveis));
        } else {
            setSelectedCpfs(new Set());
        }
    };

    const handleSelectOne = (
        cpf: string,
        checked: boolean
    ) => {
        if (funcionariosSalvos.has(cpf)) {
            return;
        }

        const novoSet = new Set(selectedCpfs);

        if (checked) {
            novoSet.add(cpf);
        } else {
            novoSet.delete(cpf);
        }

        setSelectedCpfs(novoSet);
    };

    const handleSaveSelection = async () => {
        if (selectedCpfs.size === 0) {
            toast.warning(
                "Selecione ao menos um funcionário para salvar."
            );
            return;
        }

        setSaving(true);

        try {
            const selecionados = funcionariosConcluidos.filter((f) =>
                selectedCpfs.has(f.cpf)
            );

            if (selecionados.length === 0) {
                toast.warning(
                    "Nenhum funcionário válido foi selecionado."
                );
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
                throw new Error(
                    "Erro ao enviar funcionários."
                );
            }

            await response.json();

            const cpfsSalvos = selecionados.map((f) => f.cpf);

            onFuncionariosSalvos(cpfsSalvos);

            // Remove somente os que foram salvos da seleção atual
            setSelectedCpfs((prev) => {
                const novo = new Set(prev);
                cpfsSalvos.forEach((cpf) => novo.delete(cpf));
                return novo;
            });

            toast.success(
                `${selecionados.length} funcionário(s) salvo(s) com sucesso!`
            );
        } catch (error) {
            console.error(
                "Erro no processamento:",
                error
            );

            toast.error(
                "Não foi possível salvar os funcionários selecionados."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRowClick = (f: any) => {
        setSelectedFuncionario(f);
        setModalOpen(true);
    };

    if (funcionariosConcluidos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>

                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nenhum funcionário concluído
                </p>

                <p className="text-xs text-slate-400 mt-1 text-center">
                    Os funcionários com todos os exames concluídos
                    aparecerão aqui.
                </p>
            </div>
        );
    }

    /*
     * Quantos ainda podem ser selecionados (geral e filtrados).
     */
    const disponiveisParaSalvarFiltrados = funcionariosFiltrados.filter(
        (f) =>
            !funcionariosSalvos.has(f.cpf) &&
            !possuiAsoMontado(f.observacao)
    ).length;

    const allChecked =
        disponiveisParaSalvarFiltrados > 0 &&
        selectedCpfs.size === disponiveisParaSalvarFiltrados;

    const quantidadeSalvos = funcionariosConcluidos.filter(
        (f) =>
            funcionariosSalvos.has(f.cpf) ||
            possuiAsoMontado(f.observacao)
    ).length;

    const SortHeader = ({
        label,
        sortKeyValue,
    }: {
        label: string;
        sortKeyValue: string;
    }) => (
        <TableHead
            className="font-black text-[10px] uppercase text-slate-500 cursor-pointer select-none"
            onClick={() => handleSort(sortKeyValue)}
        >
            <div className="flex items-center gap-1">
                {label}

                {sortKey === sortKeyValue ? (
                    sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                    ) : (
                        <ArrowDown className="w-3 h-3" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
            </div>
        </TableHead>
    );

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* HEADER */}
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-sm font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Funcionários Concluídos
                            <Badge
                                variant="outline"
                                className="ml-1 text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                            >
                                {funcionariosConcluidos.length}
                            </Badge>
                        </CardTitle>

                        <p className="text-[11px] text-slate-400 mt-1">
                            Funcionários com todos os exames concluídos e aptos para envio.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {quantidadeSalvos > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    {quantidadeSalvos} salvo(s)
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {selectedCpfs.size} selecionado(s)
                            </span>
                        </div>

                        <div className="relative w-full lg:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar por funcionário, CPF ou empresa..."
                                className="pl-9 h-9 text-xs"
                            />
                        </div>

                        <Button
                            onClick={handleSaveSelection}
                            disabled={saving || selectedCpfs.size === 0}
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-wide gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    Salvar Selecionados
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {/* AVISO DE SALVOS */}
            {quantidadeSalvos > 0 && (
                <div className="px-4 py-2.5 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Os funcionários marcados como “Salvo” já foram enviados nesta sessão.
                    </span>
                </div>
            )}

            {/* TABELA */}
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center">
                                <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(checked) =>
                                        handleSelectAll(!!checked)
                                    }
                                    disabled={disponiveisParaSalvarFiltrados === 0}
                                />
                            </TableHead>
                            <SortHeader label="Funcionário" sortKeyValue="nome" />
                            <SortHeader label="CPF" sortKeyValue="cpf" />
                            <SortHeader label="Empresa / Unidade" sortKeyValue="empresa" />
                            <SortHeader label="Data Ficha" sortKeyValue="dataFicha" />
                            <SortHeader label="Exames" sortKeyValue="examesConcluidos" />
                            <SortHeader label="Status" sortKeyValue="resultadoAsoSoc" />
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {funcionariosFiltrados.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                                    Nenhum funcionário encontrado para a busca realizada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            funcionariosFiltrados.map((item) => {
                                const isSelected = selectedCpfs.has(item.cpf);
                                const isSalvo =
                                    funcionariosSalvos.has(item.cpf) ||
                                    possuiAsoMontado(item.observacao);

                                return (
                                    <TableRow
                                        key={item.cpf}
                                        className={`transition-all border-b dark:border-gray-800 ${isSalvo
                                            ? "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.10]"
                                            : isSelected
                                                ? "bg-blue-500/[0.06] hover:bg-blue-500/[0.09]"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            }`}
                                    >
                                        {/* CHECKBOX */}
                                        <TableCell className="text-center">
                                            {isSalvo ? (
                                                <div className="flex justify-center">
                                                    <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) =>
                                                        handleSelectOne(item.cpf, !!checked)
                                                    }
                                                />
                                            )}
                                        </TableCell>

                                        {/* FUNCIONÁRIO */}
                                        <TableCell>
                                            <button
                                                type="button"
                                                onClick={() => handleRowClick(item)}
                                                className="text-left group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${isSalvo
                                                            ? "bg-emerald-500/15 text-emerald-500"
                                                            : "bg-blue-500/10 text-blue-500"
                                                            }`}
                                                    >
                                                        {item.nome?.charAt(0)?.toUpperCase()}
                                                    </div>

                                                    <div>
                                                        <div
                                                            className={`text-xs font-bold group-hover:underline ${isSalvo
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-blue-600 dark:text-blue-400"
                                                                }`}
                                                        >
                                                            {item.nome}
                                                        </div>

                                                        {isSalvo && (
                                                            <div className="text-[9px] text-emerald-500 font-bold uppercase mt-0.5">
                                                                Processado nesta sessão
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        </TableCell>

                                        {/* CPF */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.cpf}
                                        </TableCell>

                                        {/* EMPRESA */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div className="max-w-[220px] truncate" title={item.empresa}>
                                                {item.empresa}
                                            </div>
                                        </TableCell>

                                        {/* DATA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.dataFicha || "-"}
                                        </TableCell>

                                        {/* EXAMES */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                            {item.examesConcluidos} / {item.totalExames}
                                        </TableCell>

                                        {/* STATUS */}
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                            >
                                                {item.resultadoAsoSoc}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
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