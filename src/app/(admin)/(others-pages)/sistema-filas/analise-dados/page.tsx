"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { toast } from "sonner"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
        // const coresArray = Object.values(THEME_COLORS);
        const dadosEspecialidade = payload[0]?.payload || {};

        // Filtra as salas para listar no detalhamento
        const salasAtivas = Object.keys(dadosEspecialidade).filter(k =>
            k !== 'especialidade' &&
            k !== 'Sala Não Informada' &&
            typeof dadosEspecialidade[k] === 'number' &&
            dadosEspecialidade[k] > 0
        );

        // Calcula o total geral somando as salas
        const totalGeral = salasAtivas.reduce((sum, sala) => sum + dadosEspecialidade[sala], 0);

        return (
            <div className="p-3 rounded-md shadow-lg border border-gray-200 dark:border-gray-800" style={{ background: THEME_COLORS.legendBackground || '#0A2647' }}>
                <p className="text-xs font-black text-gray-200 mb-1 uppercase tracking-wider">{label}</p>
                <p className="text-xs font-medium text-slate-300 mb-3 border-b border-slate-700/50 pb-1.5">
                    Total Geral: <span className="text-white font-black text-sm">{totalGeral}</span>
                </p>

                <div className="flex flex-col gap-1.5">
                    {salasAtivas.map((salaKey, idx) => {
                        const valorSala = dadosEspecialidade[salaKey];
                        // const corItem = coresArray[idx % coresArray.length] || coresArray[0];

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

type ViewType = "atendimentos" | "exames"

export default function IndicadoresMensais() {
    const hoje = new Date();
    const [view, setView] = useState<ViewType>("atendimentos");
    const [unidadeId, setUnidadeId] = useState("")
    const [loading, setLoading] = useState(false)

    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([])
    const [dadosGraficos, setDadosGraficos] = useState<any>(null)

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
            executarChamadaN8N(buscaFiltros.dataInicio, buscaFiltros.dataFim, unidadeId);
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

    const executarChamadaN8N = async (inicio: string, fim: string, unidade: string) => {
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

            const start = await fetch("/api/indicadores", {
                method: "POST",
                body: formData
            });

            const { jobId } = await start.json();
            let terminou = false;

            while (!terminou) {
                await new Promise(r => setTimeout(r, 3000));

                const status = await fetch(`/api/consulta-relatorios/?id=${jobId}`);
                const resultado = await status.json();

                const respostaBruta = Array.isArray(resultado) ? resultado[0] : resultado;
                const resposta = respostaBruta.json ?? respostaBruta;

                if (resposta.status === "processing") {
                    continue;
                }

                if (resposta.status === "empty") {
                    toast.warning(`0 atendimentos encontrados`);
                    setDadosRelatorio([]);
                    setDadosGraficos(null);
                    terminou = true;
                }

                if (resposta.status === "done") {
                    terminou = true;
                    setDadosRelatorio(resposta.data?.listaRelatorios || []);
                    setDadosGraficos(resposta.charts || null);

                    const totalProcessados = resposta.charts?.view_atendimento?.total_atendimentos_mes ?? 0;
                    toast.success(`${totalProcessados} atendimentos processados`);
                }
            }
        } catch (error) {
            toast.error("Erro ao carregar dados.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const possuiAlteracoes = tempMes !== buscaFiltros.mes || tempAno !== buscaFiltros.ano;

    // Métricas dos Cards Principais alimentadas diretamente pela resposta do n8n
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
        <div className="min-h-screen rounded-xl bg-gray-500/20 p-2">

            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">Indicadores Mensais</h1>
                        <div className="flex items-center gap-1">
                            {/* <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"> —</p> */}
                            <Badge className="text-[10px] text-white uppercase bg-blue-600 border border-blue-500/20 font-bold tracking-widest">
                                {meses[buscaFiltros.mes]} de {buscaFiltros.ano}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
                    <Tabs value={view} onValueChange={(v) => setView(v as ViewType)} className="bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger value="atendimentos" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all">
                                Atendimentos (Recepção)
                            </TabsTrigger>
                            <TabsTrigger value="exames" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all">
                                Especialidades
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap gap-2 text-sm items-center w-full lg:w-auto justify-end">
                        <select className="h-10 bg-slate-800 p-2 rounded-lg border border-slate-700 text-white cursor-pointer focus:outline-none text-xs font-medium" value={tempMes} onChange={(e) => setTempMes(Number(e.target.value))}>
                            {meses.map((m, i) => (<option key={i} value={i}>{m}</option>))}
                        </select>
                        <select className="h-10 bg-slate-800 p-2 rounded-lg border border-slate-700 text-white cursor-pointer focus:outline-none text-xs font-medium" value={tempAno} onChange={(e) => setTempAno(Number(e.target.value))}>
                            {[2025, 2026].map(a => (<option key={a} value={a}>{a}</option>))}
                        </select>

                        <Button
                            onClick={handleFiltrar}
                            disabled={loading}
                            variant={possuiAlteracoes ? "default" : "secondary"}
                            className={`h-10 font-bold uppercase text-[10px] gap-2 tracking-wider border transition-all ${possuiAlteracoes
                                ? "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                                }`}
                        >
                            <Search className="w-3.5 h-3.5" />
                            {loading ? "Carregando..." : "Filtrar"}
                        </Button>
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
                    <div className="grid gap-5 my-4 grid-cols-2 lg:grid-cols-5">
                        <CardIndicador titulo="Total Mês" valor={totalSenhas} subtitulo="Atendimentos Concluídos" icon={<Ticket size={24} className="text-emerald-500" />} />
                        <CardIndicador titulo="Média Diária" valor={mediaDiaria} subtitulo="Atendimentos por dia" icon={<CalendarDays size={24} className="text-orange-500" />} />
                        <CardIndicador titulo="Acumulado de Atendimentos" valor={acumulado} subtitulo="Recepção + Especialidade" icon={<FileStack size={24} className="text-blue-500" />} />
                        <CardIndicador titulo="Tempo Permanência na Clínica" valor={tempoMedioPermanencia} subtitulo="Média (min)" icon={<Timer size={24} className="text-amber-500" />} />
                        <CardIndicador titulo="Espera Recepção" valor={tempoMedioEsperaRecepcao} subtitulo="Média até atendimento (min)" icon={<Clock size={24} className="text-violet-500" />} />
                    </div>

                    {view === "atendimentos" && <ViewAtendimentos charts={dadosGraficos?.view_atendimento} />}
                    {view === "exames" && <ViewExames charts={dadosGraficos?.view_exames} />}
                </>
            )}
        </div>
    )
}

/* ============================================================
    VIEW ATENDIMENTOS
============================================================ */
export function ViewAtendimentos({ charts }: { charts: any }) {
    if (!charts) {
        return (
            <div className="text-center py-12 text-xs font-mono text-slate-400 uppercase">
                Gere o filtro para carregar o painel volumétrico.
            </div>
        )
    }

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

                {/* Atendimentos por período mensal */}
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

                {/* Atendimento por tipo de exame (tipo_aso) - Gráfico Horizontal */}
                {(() => {
                    const maxTipoAso = tipoAsoData.length > 0 ? Math.max(...tipoAsoData.map((d: any) => d.total || 0)) : 100;
                    const limiteTipoAsoX = Math.ceil(maxTipoAso * 1.18); // Dá margem suficiente para os números à direita

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

            {/* Gráfico de Atendimento Diário por Período */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 shadow-sm mt-4">
                <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" /> Atendimento Diário por Período
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[350px] pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        {/* Aumentado a margem top para os números do topo não sumirem */}
                        <BarChart data={diarioData} margin={{ top: 25, right: 15, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                            <XAxis dataKey="dia" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                            {/* Impede que o topo do gráfico corte os números das barras mais altas */}
                            <YAxis tick={{ fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
                            <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" height={36} />

                            <Bar dataKey="manha" name="Manhã" fill={THEME_COLORS.primary} stackId="a" radius={[0, 0, 0, 0]}>
                                <LabelList dataKey="manha" position="inside" style={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                            </Bar>

                            <Bar dataKey="tarde" name="Tarde" fill={THEME_COLORS.secondary} stackId="a" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="tarde" position="inside" style={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Fluxo de Atendimentos por Hora */}
            <div className="grid grid-cols-1 gap-6">
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
                                {/* Margem superior para os rótulos de pico do fluxo em linha/área */}
                                <YAxis tick={{ fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                                <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                <Area type="monotone" dataKey="total" name="Pacientes" stroke={THEME_COLORS.secondary} fillOpacity={1} fill="url(#colorFluxo)">
                                    <LabelList dataKey="total" position="top" style={{ fill: THEME_COLORS.secondary, fontSize: 12, fontWeight: 'bold' }} offset={12} />
                                </Area>
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Top 10 Empresas */}
            {(() => {
                // Descobre dinamicamente o maior valor do gráfico para esticar o eixo X de forma segura
                const valorMaximo = topEmpresasData.length > 0
                    ? Math.max(...topEmpresasData.map((d: any) => d.total || 0))
                    : 100;

                // Adiciona 15% de margem no topo do gráfico para o número caber com folga
                const limiteEixoX = Math.ceil(valorMaximo * 1.15);

                return (
                    <div className="grid grid-cols-1 gap-6">
                        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                                <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <CircleStar className="w-4 h-4 text-blue-500" />Top 10 Clientes por Atendimento
                                </CardTitle>
                            </CardHeader>
                            {/* Corrigido h-100 para h-[350px] para evitar quebra de layout de altura */}
                            <CardContent className="h-[350px] pt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    {/* Adicionado uma margem à direita (right: 35) no BarChart para o texto não colar na borda externa */}
                                    <BarChart
                                        data={topEmpresasData}
                                        layout="vertical"
                                        margin={{ top: 10, right: 35, left: 10, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />

                                        {/* Definido o domínio dinâmico do eixo X com o limite calculado */}
                                        <XAxis
                                            type="number"
                                            domain={[0, limiteEixoX]}
                                            tick={{ fontSize: 12 }}
                                        />

                                        <YAxis dataKey="empresa" type="category" tick={{ fontSize: 12 }} width={240} />
                                        <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />

                                        <Bar dataKey="total" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={18} name="Atendimentos">
                                            {/* Adicionado offset para empurrar levemente o texto para o lado e evitar que ele toque na barra */}
                                            <LabelList
                                                dataKey="total"
                                                position="right"
                                                offset={10}
                                                style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                );
            })()}
        </div>
    )
}

/* ============================================================
    VIEW EXAMES
============================================================ */
function ViewExames({ charts }: { charts: any }) {
    if (!charts) {
        return (
            <div className="text-center py-12 text-xs font-mono text-slate-400 uppercase">
                Sem métricas de exames disponíveis para este período.
            </div>
        );
    }

    const especialidadesData = charts.total_atendimentos_por_especialidade
        ? Object.keys(charts.total_atendimentos_por_especialidade).map(key => ({
            especialidade: key,
            quantidade: charts.total_atendimentos_por_especialidade[key]
        }))
        : [];

    const temposEspecialidadeData = charts.tempo_medio_atendimento_por_especialidade
        ? Object.keys(charts.tempo_medio_atendimento_por_especialidade).map(key => ({
            especialidade: key,
            minutos: charts.tempo_medio_atendimento_por_especialidade[key]
        })).sort((a, b) => b.minutos - a.minutos)
        : [];

    const periodoEspecialidadeData = charts.periodo_por_especialidade
        ? Object.keys(charts.periodo_por_especialidade).map(key => ({
            especialidade: key,
            manha: charts.periodo_por_especialidade[key].manha_ate_13h || 0,
            tarde: charts.periodo_por_especialidade[key].tarde || 0
        }))
        : [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
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

                                {/* Uma única barra sólida calculando o total dinamicamente */}
                                <Bar
                                    name="Total"
                                    fill={THEME_COLORS.secondary}
                                    radius={[4, 4, 0, 0]}
                                    barSize={35}
                                    // A mágica: soma as propriedades numéricas da linha para obter o total da barra sólida
                                    dataKey={(entry) => {
                                        return Object.keys(entry)
                                            .filter(k => k !== 'especialidade' && k !== 'Sala Não Informada' && typeof entry[k] === 'number')
                                            .reduce((sum, k) => sum + (entry[k] || 0), 0);
                                    }}
                                >
                                    {/* Label simples e limpa posicionada no topo de cada barra sólida */}
                                    <LabelList
                                        position="top"
                                        offset={8}
                                        style={{ fill: THEME_COLORS.secondary, fontSize: 12, fontWeight: 'bold' }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            {/* Comparativo de Períodos por Especialidade */}
            <div className="grid grid-cols-1 gap-6">
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                    <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                        <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" /> Atendimento por Período nas Especialidades
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[280px] pt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            {/* Aumentada a margem superior (top: 25) para suportar as etiquetas das duas barras paralelas */}
                            <BarChart data={periodoEspecialidadeData} margin={{ top: 25, right: 10, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                                <XAxis dataKey="especialidade" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                                {/* 20% de área de escape dinâmica para o topo do eixo Y */}
                                <YAxis tick={{ fontSize: 12 }} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2)]} />
                                <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                <Legend />
                                <Bar dataKey="manha" name="Manhã (Até 13h)" fill={THEME_COLORS.primary} barSize={50} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="manha" position="top" offset={6} style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }} />
                                </Bar>
                                <Bar dataKey="tarde" name="Tarde" fill={THEME_COLORS.secondary} barSize={50} radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="tarde" position="top" offset={6} style={{ fill: THEME_COLORS.secondary, fontSize: 12, fontWeight: 'bold' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6 mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Tempo Médio de Atendimento da Sala */}
                    {(() => {
                        const maxMinutos = temposEspecialidadeData.length > 0
                            ? Math.max(...temposEspecialidadeData.map((d: any) => d.minutos || 0))
                            : 60;
                        const limiteMinutosX = Math.ceil(maxMinutos * 1.18); // 18% de folga para o sufixo "m" sumir da quebra

                        return (
                            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                                <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Timer className="w-4 h-4 text-amber-500" /> Tempo Médio por Especialidade (Minutos)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[400px] pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {/* right: 40 para garantir o texto estendido de minutos */}
                                        <BarChart data={temposEspecialidadeData} layout="vertical" margin={{ top: 10, right: 40, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                                            <XAxis type="number" domain={[0, limiteMinutosX]} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                                            <YAxis dataKey="especialidade" type="category" tick={{ fontSize: 12, fontWeight: 'bold' }} width={120} />
                                            <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                            <Bar dataKey="minutos" fill={THEME_COLORS.secondary} radius={[0, 4, 4, 0]} barSize={18} name="Tempo Médio (min)">
                                                <LabelList dataKey="minutos" position="right" offset={8} style={{ fill: THEME_COLORS.secondary, fontSize: 12, fontWeight: 'bold' }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        );
                    })()}

                    {/* Gráfico 2: Tempo Médio de Atendimento por Sala Física */}
                    {(() => {
                        const dadosTempoSala = charts.tempo_medio_por_sala || [];
                        const maxMinutosSala = dadosTempoSala.length > 0 ? Math.max(...dadosTempoSala.map((d: any) => d.minutos || 0)) : 30;
                        const limiteMinutosSalaX = Math.ceil(maxMinutosSala * 1.18); // 18% de folga no eixo horizontal para o "m"

                        return (
                            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
                                <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Timer className="w-4 h-4 text-blue-500" /> Tempo Médio por Sala (minutos)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[400px] pt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={dadosTempoSala}
                                            layout="vertical"
                                            margin={{ top: 10, right: 45, left: 10, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                                            <XAxis type="number" domain={[0, limiteMinutosSalaX]} tick={{ fontSize: 12 }} />
                                            <YAxis dataKey="sala" type="category" tick={{ fontSize: 12, fontWeight: 'bold' }} width={80} />
                                            <Tooltip contentStyle={{ background: THEME_COLORS.legendBackground, border: 'none', color: '#fff', borderRadius: 8 }} />
                                            <Bar dataKey="minutos" fill={THEME_COLORS.primary} radius={[0, 4, 4, 0]} barSize={18} name="Tempo Médio">
                                                <LabelList
                                                    dataKey="minutos"
                                                    position="right"
                                                    offset={10}
                                                    formatter={(v: any) => `${v}`}
                                                    style={{ fill: THEME_COLORS.primary, fontSize: 12, fontWeight: 'bold' }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        );
                    })()}

                </div>
            </div>
        </div>
    );
}