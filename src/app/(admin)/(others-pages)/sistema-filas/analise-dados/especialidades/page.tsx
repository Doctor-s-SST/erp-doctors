"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Icons
import {
    Activity,
    Ticket,
    Search,
    Layers,
    Clock,
    DoorOpen,
    CalendarDays,
    BarChart3,
    Timer,
    CircleStar,
    FileStack
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
    AreaChart,
    Area,
    LabelList
} from "recharts"

const THEME_COLORS = {
    primary: "#317bbd",
    secondary: "#ec801a",
    success: "#10b981",
    violet: "#6366f1",
    pink: "#ec4899",
    primaryLight: "#3b82f6",
    warning: "#f59e0b",
    slate: "#64748b",
    legendBackground: "#0A2647",
};

const CustomTooltipEspecialidades = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const dadosEspecialidade = payload[0]?.payload || {};

        const salasAtivas = Object.keys(dadosEspecialidade).filter(k =>
            k !== 'especialidade' &&
            k !== 'Sala Não Informada' &&
            typeof dadosEspecialidade[k] === 'number' &&
            dadosEspecialidade[k] > 0
        );

        const totalGeral = salasAtivas.reduce((sum, sala) => sum + dadosEspecialidade[sala], 0);

        return (
            <div className="p-3 rounded-md shadow-lg border border-gray-200 dark:border-gray-800" style={{ background: THEME_COLORS.legendBackground || '#0A2647' }}>
                <p className="text-xs font-black text-gray-200 mb-1 uppercase tracking-wider">{label}</p>
                <p className="text-xs font-medium text-slate-300 mb-3 border-b border-slate-700/50 pb-1.5">
                    Total Geral: <span className="text-white font-black text-sm">{totalGeral}</span>
                </p>

                <div className="flex flex-col gap-1.5">
                    {salasAtivas.map((salaKey) => {
                        const valorSala = dadosEspecialidade[salaKey];
                        return (
                            <div key={salaKey} className="flex items-center justify-between gap-6 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: THEME_COLORS.secondary }} />
                                    <span className="text-slate-300 font-medium">{salaKey}</span>
                                </div>
                                <span className="text-white font-bold">{valorSala}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

import { CardIndicador } from "@/components/atendimento/dashboards/CardIndicator"
import { aguardarJobRelatorio, iniciarJobRelatorio } from "../../shared/relatorios"

export default function IndicadoresMensais() {
    const hoje = new Date();
    const [unidadeId, setUnidadeId] = useState("")
    const [loading, setLoading] = useState(false)

    const [dadosGraficos, setDadosGraficos] = useState<any>(null)
    const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState<string[]>([])

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]

    const [tempMes, setTempMes] = useState(hoje.getMonth());
    const [tempAno, setTempAno] = useState(hoje.getFullYear());

    const [buscaFiltros, setBuscaFiltros] = useState({
        mes: hoje.getMonth(),
        ano: hoje.getFullYear(),
        dataInicio: format(startOfMonth(hoje), "yyyy-MM-dd"),
        dataFim: format(endOfMonth(hoje), "yyyy-MM-dd"),
    });

    // Extrai a lista de especialidades disponíveis no retorno para alimentar dinamicamente o select
    const listaEspecialidadesDisponiveis = dadosGraficos?.view_exames?.total_atendimentos_por_especialidade
        ? Object.keys(dadosGraficos.view_exames.total_atendimentos_por_especialidade)
        : [];

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

    useEffect(() => {
        if (unidadeId) {
            executarChamadaN8N(buscaFiltros.dataInicio, buscaFiltros.dataFim, unidadeId, especialidadesSelecionadas);
        }
    }, [unidadeId, buscaFiltros]);

    const handleFiltrar = () => {
        const inicio = startOfMonth(new Date(tempAno, tempMes, 1));
        const fim = endOfMonth(new Date(tempAno, tempMes, 1));

        setBuscaFiltros({
            mes: tempMes,
            ano: tempAno,
            dataInicio: format(inicio, "yyyy-MM-dd"),
            dataFim: format(fim, "yyyy-MM-dd")
        });
    };

    const handleSelectEspecialidade = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const options = e.target.options;
        const selecionadas: string[] = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selecionadas.push(options[i].value);
            }
        }
        setEspecialidadesSelecionadas(selecionadas);
    };

    const executarChamadaN8N = async (inicio: string, fim: string, unidade: string, especialidades: string[]) => {
        if (!inicio || !fim) {
            toast.warning("Selecione o período.");
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("dataInicio", inicio);
            formData.append("dataFim", fim);
            formData.append("unidadeId", unidade);
            formData.append("especialidades", JSON.stringify(especialidades));

            const jobId = await iniciarJobRelatorio("/api/indicadores-especialidades", formData);
            const resposta = await aguardarJobRelatorio(jobId);

            if (resposta.status === "empty") {
                toast.warning(`0 atendimentos encontrados`);
                setDadosGraficos(null);
            }

            if (resposta.status === "done") {
                const charts = resposta.charts || null;
                setDadosGraficos(charts);
                const totalProcessados = (charts?.view_atendimento as { total_atendimentos_mes?: number } | undefined)?.total_atendimentos_mes ?? 0;
                toast.success(`${totalProcessados} atendimentos processados`);
            }
        } catch (error) {
            toast.error("Erro ao carregar dados.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const possuiAlteracoes = tempMes !== buscaFiltros.mes || tempAno !== buscaFiltros.ano;

    const valoresEspecialidades = dadosGraficos?.view_exames?.total_atendimentos_por_especialidade
        ? Object.values(dadosGraficos.view_exames.total_atendimentos_por_especialidade)
        : [];
    const total_especialidades = valoresEspecialidades.reduce((acc: number, val: any) => acc + Number(val || 0), 0);
    const totalSenhas = dadosGraficos?.view_atendimento?.total_atendimentos_mes ?? 0;
    const mediaDiaria = dadosGraficos?.view_atendimento?.media_diaria_atendimento ?? 0;
    const acumulado = totalSenhas + total_especialidades;
    const tempoMedioPermanencia = dadosGraficos?.view_atendimento?.tempo_medio_permanencia_min ?? 0;
    const tempoMedioEsperaRecepcao = dadosGraficos?.view_atendimento?.tempo_medio_espera_recepcao_min ?? 0;

    return (
        <div className="min-h-screen rounded-xl bg-gray-500/20 p-2 space-y-4">

            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">Painel Unificado de Indicadores</h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <Badge className="text-[10px] text-white uppercase bg-blue-600 border border-blue-500/20 font-bold tracking-widest">
                                {meses[buscaFiltros.mes]} de {buscaFiltros.ano}
                            </Badge>
                            {especialidadesSelecionadas.length > 0 && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400 uppercase font-bold tracking-widest">
                                    {especialidadesSelecionadas.length} Filtrada(s)
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 items-center w-full lg:w-auto justify-end">
                    {/* SELECT DE MÚLTIPLAS ESPECIALIDADES */}
                    <div className="flex flex-col w-full lg:w-48">
                        <select
                            multiple
                            className="w-full h-11 bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-white focus:outline-none text-[11px] font-medium"
                            value={especialidadesSelecionadas}
                            onChange={handleSelectEspecialidade}
                            title="Segure Ctrl (ou Cmd) para selecionar múltiplas"
                        >
                            <option value="" disabled className="text-slate-500 font-bold">Filtrar Especialidade (Ctrl+Click):</option>
                            {listaEspecialidadesDisponiveis.map(esp => (
                                <option key={esp} value={esp} className="py-0.5 px-1 rounded bg-slate-900 my-0.5 checked:bg-blue-600">
                                    {esp}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2 text-sm items-center w-full lg:w-auto justify-end shrink-0">
                        <select className="h-11 bg-slate-800 p-2 rounded-lg border border-slate-700 text-white cursor-pointer focus:outline-none text-xs font-medium" value={tempMes} onChange={(e) => setTempMes(Number(e.target.value))}>
                            {meses.map((m, i) => (<option key={i} value={i}>{m}</option>))}
                        </select>
                        <select className="h-11 bg-slate-800 p-2 rounded-lg border border-slate-700 text-white cursor-pointer focus:outline-none text-xs font-medium" value={tempAno} onChange={(e) => setTempAno(Number(e.target.value))}>
                            {[2025, 2026].map(a => (<option key={a} value={a}>{a}</option>))}
                        </select>

                        <button
                            onClick={handleFiltrar}
                            disabled={loading}
                            className={`h-11 px-4 rounded-lg font-bold uppercase text-[10px] flex items-center gap-2 tracking-wider border transition-all ${possuiAlteracoes || especialidadesSelecionadas.length > 0
                                    ? "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
                                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                                }`}
                        >
                            <Search className="w-3.5 h-3.5" />
                            {loading ? "Carregando..." : "Filtrar"}
                        </button>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Processando dados...</p>
                </div>
            ) : (
                <>
                    {/* CARDS */}
                    <div className="grid gap-5 grid-cols-2 lg:grid-cols-5">
                        <CardIndicador titulo="Total Mês" valor={totalSenhas} subtitulo="Atendimentos Concluídos" icon={<Ticket size={24} className="text-emerald-500" />} />
                        <CardIndicador titulo="Média Diária" valor={mediaDiaria} subtitulo="Atendimentos por dia" icon={<CalendarDays size={24} className="text-orange-500" />} />
                        <CardIndicador titulo="Acumulado de Atendimentos" valor={acumulado} subtitulo="Recepção + Especialidade" icon={<FileStack size={24} className="text-blue-500" />} />
                        <CardIndicador titulo="Tempo Permanência na Clínica" valor={tempoMedioPermanencia} subtitulo="Média (min)" icon={<Timer size={24} className="text-amber-500" />} />
                        <CardIndicador titulo="Espera Recepção" valor={tempoMedioEsperaRecepcao} subtitulo="Média até atendimento (min)" icon={<Clock size={24} className="text-violet-500" />} />
                    </div>

                    {/* RENDERIZAÇÃO SEQUENCIAL DAS DUAS ANTIGAS VIEWS */}
                    <ViewAtendimentos charts={dadosGraficos?.view_atendimento} />
                    <ViewExames charts={dadosGraficos?.view_exames} />
                </>
            )}
        </div>
    )
}

/* ============================================================
    VIEW ATENDIMENTOS (RECEPÇÃO)
============================================================ */
export function ViewAtendimentos({ charts }: { charts: any }) {
    if (!charts) return null;

    const porPeriodoData = [
        { name: "Manhã (Até 13h)", total: charts.atendimentos_por_periodo?.manha_ate_13h || 0 },
        { name: "Tarde", total: charts.atendimentos_por_periodo?.tarde || 0 }
    ];

    const tipoAsoData = charts.atendimento_por_tipo_aso
        ? Object.keys(charts.atendimento_por_tipo_aso).map(key => ({
            tipo: key,
            total: charts.atendimento_por_tipo_aso[key]
        })).sort((a, b) => b.total - a.total)
        : [];

    const topEmpresasData = (charts.top_10_empresas || []).map((item: any) => ({
        empresa: item.empresa,
        total: item.quantidade
    }));

    const fluxoData = (charts.fluxo_atendimentos_por_hora || []).map((item: any) => ({
        hora: item.hora,
        total: item.quantidade
    }));

    const diarioData = charts.atendimento_diario_periodo || [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
                    <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                        <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" /> Atendimentos Mensal por Período
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={porPeriodoData} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label>
                                    {porPeriodoData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? THEME_COLORS.primary : THEME_COLORS.secondary} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {(() => {
                    const maxTipoAso = tipoAsoData.length > 0 ? Math.max(...tipoAsoData.map((d: any) => d.total || 0)) : 100;
                    const limiteTipoAsoX = Math.ceil(maxTipoAso * 1.18);

                    return (
                        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
                            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                                <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-orange-500" /> Atendimentos por Tipo de ASO
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[320px] pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={tipoAsoData} layout="vertical" margin={{ top: 10, right: 35, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                                        <XAxis type="number" domain={[0, limiteTipoAsoX]} tick={{ fontSize: 10 }} />
                                        <YAxis dataKey="tipo" type="category" tick={{ fontSize: 11 }} width={150} />
                                        <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                        <Bar dataKey="total" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={15} name="Quantidade">
                                            <LabelList dataKey="total" position="right" offset={10} style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    );
                })()}
            </div>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm">
                <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" /> Atendimento Diário por Período
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={diarioData} margin={{ top: 25, right: 15, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                            <XAxis dataKey="dia" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                            <YAxis tick={{ fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                            <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" height={36} />
                            <Bar dataKey="manha" name="Manhã" fill={THEME_COLORS.primary} stackId="a">
                                <LabelList dataKey="manha" position="inside" style={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                            </Bar>
                            <Bar dataKey="tarde" name="Tarde" fill={THEME_COLORS.secondary} stackId="a" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="tarde" position="inside" style={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-orange-500" /> Fluxo Flutuante de Atendimento (Por Hora)
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[320px] pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fluxoData} margin={{ top: 25, right: 15, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorFluxo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={THEME_COLORS.secondary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={THEME_COLORS.secondary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                            <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                            <Area type="monotone" dataKey="total" name="Pacientes" stroke={THEME_COLORS.secondary} fillOpacity={1} fill="url(#colorFluxo)">
                                <LabelList dataKey="total" position="top" style={{ fill: THEME_COLORS.secondary, fontSize: 12, fontWeight: 'bold' }} offset={12} />
                            </Area>
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {(() => {
                const valorMaximo = topEmpresasData.length > 0 ? Math.max(...topEmpresasData.map((d: any) => d.total || 0)) : 100;
                const limiteEixoX = Math.ceil(valorMaximo * 1.15);

                return (
                    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                        <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                            <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <CircleStar className="w-4 h-4 text-blue-500" />Top 10 Clientes por Atendimento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[350px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topEmpresasData} layout="vertical" margin={{ top: 10, right: 35, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                                    <XAxis type="number" domain={[0, limiteEixoX]} tick={{ fontSize: 12 }} />
                                    <YAxis dataKey="empresa" type="category" tick={{ fontSize: 12 }} width={240} />
                                    <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                    <Bar dataKey="total" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={18} name="Atendimentos">
                                        <LabelList dataKey="total" position="right" offset={10} style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                );
            })()}
        </div>
    )
}

/* ============================================================
    VIEW EXAMES (ESPECIALIDADES)
============================================================ */
function ViewExames({ charts }: { charts: any }) {
    if (!charts) return null;

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-orange-500" /> Atendimentos por Especialidade
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[320px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={charts.volumetria_salas_especialidade}
                        margin={{ top: 25, right: 10, left: -10, bottom: 5 }}
                        barCategoryGap="30%"
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                        <XAxis dataKey="especialidade" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                        <Tooltip content={<CustomTooltipEspecialidades />} />
                        <Bar
                            name="Total"
                            fill={THEME_COLORS.secondary}
                            radius={[4, 4, 0, 0]}
                            barSize={35}
                            dataKey={(entry) => {
                                return Object.keys(entry)
                                    .filter(k => k !== 'especialidade' && k !== 'Sala Não Informada' && typeof entry[k] === 'number')
                                    .reduce((sum, k) => sum + (entry[k] || 0), 0);
                            }}
                        >
                            <LabelList position="top" offset={8} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
