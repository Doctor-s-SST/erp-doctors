"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

// Icons
import {
    Activity,
    Upload,
    Users,
    FileCheck,
    AlertCircle,
    CheckCircle2,
    Layers,
    Clock,
    FileText,
    Calendar,
    Building2,
    UserCheck,
    XCircle,
    Search
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

type ViewType = "geral" | "pendencias";

export default function IndicadoresSocged() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [view, setView] = useState<ViewType>("geral");
    const [unidadeId, setUnidadeId] = useState("");
    const [loading, setLoading] = useState(false);

    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [dadosGraficos, setDadosGraficos] = useState<any>(null);

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

    const totalFuncionarios = dadosGraficos?.totalFuncionarios ?? 0;
    const totalExames = dadosGraficos?.totalExames ?? 0;
    const totalExamesPendentes = dadosGraficos?.totalExamesPendentes ?? 0;
    const totalExamesConcluidos = dadosGraficos?.totalExamesConcluidos ?? 0;
    const mediaExamesPorFuncionario = dadosGraficos?.mediaExamesPorFuncionario ?? 0;

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
                    <div className="grid gap-5 my-4 grid-cols-2 lg:grid-cols-5">
                        <CardIndicador titulo="Total Funcionários" valor={totalFuncionarios} subtitulo="Cadastrados no Excel" icon={<Users size={24} className="text-blue-500" />} />
                        <CardIndicador titulo="Total Exames" valor={totalExames} subtitulo="Exames Solicitados" icon={<FileText size={24} className="text-orange-500" />} />
                        <CardIndicador titulo="Exames Concluídos" valor={totalExamesConcluidos} subtitulo="ASOs Emitidos / Prontos" icon={<CheckCircle2 size={24} className="text-emerald-500" />} />
                        <CardIndicador titulo="Exames Pendentes" valor={totalExamesPendentes} subtitulo="Aguardando Conclusão" icon={<AlertCircle size={24} className="text-red-500" />} />
                        <CardIndicador titulo="Média p/ Funcionário" valor={mediaExamesPorFuncionario} subtitulo="Exames por Pessoa" icon={<Activity size={24} className="text-violet-500" />} />
                    </div>

                    {view === "geral" && <ViewGeralSocged analytics={dadosGraficos} />}
                    {view === "pendencias" && (
                        <ViewExamesPendentes
                            analytics={dadosGraficos}
                            todosFuncionarios={dadosRelatorio}
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
function ViewExamesPendentes({ analytics, todosFuncionarios }: { analytics: any; todosFuncionarios: any[] }) {
    const pendencias = analytics?.funcionariosComExamesPendentes || [];
    const [prazosMap, setPrazosMap] = useState<Record<string, number>>({});
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Carrega de-para de prazos
    useEffect(() => {
        async function loadPrazos() {
            const { data } = await supabase.from("prazos_exames").select("nome_exame, prazo_dias");
            if (data) {
                const mapa: Record<string, number> = {};
                data.forEach((p) => {
                    mapa[p.nome_exame.trim().toLowerCase()] = p.prazo_dias;
                });
                setPrazosMap(mapa);
            }
        }
        loadPrazos();
    }, []);

    // Agrupa dados dos funcionários com base no retorno do n8n
    const funcionariosMapeados = useMemo(() => {
        const map = new Map<string, any>();

        todosFuncionarios.forEach((item) => {
            const res = item.socResumo || item;
            if (!res) return;

            const cpf = res.cpfFuncionario || res.cpf;
            if (!cpf) return;

            map.set(cpf, {
                nome: res.nomeFuncionario || res.nome,
                cpf: cpf,
                empresa: res.razaoSocial || res.empresa || "-",
                codigoEmpresa: res.codigoEmpresa || "-",
                codigoFuncionario: res.codigoFuncionario || "-",
                dataAso: res.dataAso || res.dataPedido || null,
                resultadoAsoSoc: res.resultadoAsoSoc || "Pendente",
                medico: res.medico || "Não informado",
                crmMedico: res.crmMedico || "-",
                totalExames: res.totalExames || 0,
                examesPendentes: res.examesPendentes || 0,
                examesConcluidos: res.examesConcluidos || 0,
                listaExamesResumida: res.listaExamesResumida || []
            });
        });

        return map;
    }, [todosFuncionarios]);

    // Totais sincronizados com base nos 17 pendentes
    const totalPendentes = pendencias.length;
    const totalGeralFuncionarios = analytics?.totalFuncionarios || funcionariosMapeados.size;

    // Cálculo exato: Se 17 estão pendentes, os demais (110 - 17 = 93) estão concluídos
    const totalFuncionariosConcluidos = Math.max(0, totalGeralFuncionarios - totalPendentes);

    // Helper para converter string de data (DD/MM/YYYY) em Objeto Date
    const parseDateBR = (dateStr: string | null) => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
        return null;
    };

    // Função de cálculo de Vencimento
    const calcularStatusVencimento = (dataAsoStr: string | null, prazoDias: number | null) => {
        if (!dataAsoStr || prazoDias === null) {
            return { label: "Sem Prazo", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", estaVencido: false };
        }

        const dataBase = parseDateBR(dataAsoStr);
        if (!dataBase) {
            return { label: "Data Inválida", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", estaVencido: false };
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
                estaVencido: true
            };
        } else if (diffDays <= 3) {
            return {
                label: `Vence em ${diffDays}d`,
                color: "bg-amber-500/20 text-amber-500 border-amber-500/30",
                estaVencido: false
            };
        } else {
            return {
                label: `No prazo (${diffDays}d)`,
                color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                estaVencido: false
            };
        }
    };

    const handleRowClick = (cpf: string, itemPendente: any) => {
        const fCompleto = funcionariosMapeados.get(cpf);
        if (fCompleto) {
            setSelectedFuncionario(fCompleto);
        } else {
            // Fallback com os dados básicos da pendência
            setSelectedFuncionario({
                nome: itemPendente.nomeFuncionario || itemPendente.nome,
                cpf: itemPendente.cpfFuncionario || itemPendente.cpf,
                empresa: itemPendente.empresa || "-",
                dataAso: itemPendente.dataAso || null,
                resultadoAsoSoc: "Pendente",
                totalExames: itemPendente.examesPendentes?.length || 0,
                examesPendentes: itemPendente.examesPendentes?.length || 0,
                examesConcluidos: 0,
                listaExamesResumida: (itemPendente.examesPendentes || []).map((e: string) => ({
                    descricaoExame: e,
                    isPendente: true,
                    dataExame: "-"
                }))
            });
        }
        setModalOpen(true);
    };

    if (!analytics || pendencias.length === 0) {
        return (
            <div className="text-center py-20 text-xs font-mono text-slate-400 uppercase bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-700">
                {analytics ? "Nenhum funcionário com exames pendentes!" : "Importe uma planilha Excel para ver os exames pendentes."}
            </div>
        );
    }

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" /> Funcionários com Exames Pendentes ({totalPendentes})
                </CardTitle>

                {/* MÉTRICA: TODOS OS EXAMES FEITOS */}
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Funcionários Concluídos: {totalFuncionariosConcluidos} / {totalGeralFuncionarios}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Funcionário</TableHead>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Empresa / Unidade</TableHead>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Data ASO / Pedido</TableHead>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Exames Pendentes</TableHead>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Maior Prazo</TableHead>
                            <TableHead className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">Status Vencimento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pendencias.map((item: any, idx: number) => {
                            const cpf = item.cpfFuncionario || item.cpf;
                            const fDados = funcionariosMapeados.get(cpf);

                            const nome = item.nomeFuncionario || item.nome || fDados?.nome || "Não Informado";
                            const empresa = fDados?.empresa || item.empresa || item.unidade || "-";
                            const dataAso = fDados?.dataAso || item.dataAso || null;

                            const examesList: string[] = Array.isArray(item.examesPendentes)
                                ? item.examesPendentes
                                : [item.examesPendentes || ""];

                            // Maior prazo
                            let maiorPrazo: number | null = null;
                            examesList.forEach((exame) => {
                                const prazo = prazosMap[exame.trim().toLowerCase()];
                                if (prazo !== undefined) {
                                    if (maiorPrazo === null || prazo > maiorPrazo) {
                                        maiorPrazo = prazo;
                                    }
                                }
                            });

                            const statusVencimento = calcularStatusVencimento(dataAso, maiorPrazo);

                            return (
                                <TableRow key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
                                    <TableCell className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => handleRowClick(cpf, item)}
                                            className="text-left font-bold flex items-center gap-1.5"
                                        >
                                            {nome}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                        {empresa}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                        {dataAso || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {examesList.map((exame: string, eIdx: number) => {
                                                const prazoExame = prazosMap[exame.trim().toLowerCase()];
                                                return (
                                                    <Badge key={eIdx} variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] gap-1">
                                                        {exame}
                                                        {prazoExame !== undefined && (
                                                            <span className="text-[9px] font-bold text-amber-500">({prazoExame}d)</span>
                                                        )}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {maiorPrazo !== null ? (
                                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                                                {maiorPrazo} dia(s)
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400 font-mono text-[10px]">Não definido</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`font-bold text-[10px] border ${statusVencimento.color}`}>
                                            {statusVencimento.label}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>

            {/* MODAL / DIALOG */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black uppercase text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-blue-500" /> Detalhes do Funcionário
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Ficha individual com os exames realizados e pendências ativas.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedFuncionario && (
                        <div className="space-y-4 text-xs mt-2">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Nome</span>
                                    <strong className="text-slate-800 dark:text-slate-200 text-sm">{selectedFuncionario.nome}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">CPF</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedFuncionario.cpf || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Empresa</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{selectedFuncionario.empresa}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Data ASO</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedFuncionario.dataAso || "Não emitida"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Médico Responsável</span>
                                    <span className="text-slate-700 dark:text-slate-300">{selectedFuncionario.medico} (CRM: {selectedFuncionario.crmMedico})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Resultado SOC</span>
                                    <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                                        {selectedFuncionario.resultadoAsoSoc || "Em andamento"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40">
                                    <span className="text-[10px] uppercase text-blue-600 dark:text-blue-400 font-bold block">Total Exames</span>
                                    <span className="text-lg font-black text-blue-700 dark:text-blue-300">{selectedFuncionario.totalExames}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                                    <span className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold block">Concluídos</span>
                                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{selectedFuncionario.examesConcluidos}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40">
                                    <span className="text-[10px] uppercase text-red-600 dark:text-red-400 font-bold block">Pendentes</span>
                                    <span className="text-lg font-black text-red-700 dark:text-red-300">{selectedFuncionario.examesPendentes}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                                    <FileCheck className="w-4 h-4 text-emerald-500" /> Lista de Exames Solicitados
                                </h4>
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-100 dark:bg-slate-800">
                                            <TableRow>
                                                <TableHead className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">Exame</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">Data Exame</TableHead>
                                                <TableHead className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300">Status / Resultado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedFuncionario.listaExamesResumida?.length > 0 ? (
                                                selectedFuncionario.listaExamesResumida.map((exame: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium text-xs text-slate-800 dark:text-slate-200">
                                                            {exame.descricaoExame || exame.descricao}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-slate-500">
                                                            {exame.dataExame || "-"}
                                                        </TableCell>
                                                        <TableCell>
                                                            {exame.isPendente ? (
                                                                <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] gap-1">
                                                                    <XCircle className="w-3 h-3" /> Pendente
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> {exame.resultadoAlteradoNormal || "Concluído"}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-slate-400 py-4">
                                                        Nenhum exame detalhado disponível.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}