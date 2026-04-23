"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { ptBR } from "date-fns/locale"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Icons
import {
    Calendar as CalendarIcon,
    Activity,
    BarChart3,
    Clock,
    Users,
    RefreshCcw,
    LayoutDashboard,
    Search,
    CalendarDays,
    FileText
} from "lucide-react"

// Importe seus gráficos aqui (assumindo que foram criados anteriormente)
import { GraficoAtendimentosHora } from "@/components/atendimento/dashboards/GraficoAtendimentosHora"
import { GraficoAtendimentosPorRecep } from "@/components/atendimento/dashboards/GraficoAtendimentosPorRecep"
import { GraficoAtendimentosPorEsp } from "@/components/atendimento/dashboards/GraficoAtendimentosPorEsp"
import { GraficoTempoMedioEsp } from "@/components/atendimento/dashboards/GraficoTempoMedioEsp"
import { GraficoPizza } from "@/components/atendimento/dashboards/diario/GraficoPizza"

type ViewType = "geral" | "diario" | "mensal"

export default function DashboardPage() {
    const [view, setView] = useState<ViewType>("geral")
    const [unidadeId, setUnidadeId] = useState("")

    // Estados de Filtro
    const [dataInicio, setDataInicio] = useState<Date>(new Date())
    const [dataFim, setDataFim] = useState<Date>(new Date())

    useEffect(() => {
        const unidadeSalva = localStorage.getItem('unidade_ativa_id');
        if (unidadeSalva) setUnidadeId(unidadeSalva);
    }, []);

    // Determina se deve fazer polling (apenas se for visão geral/diário e a data for hoje)
    const isHoje = format(dataInicio, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const pollingActive = isHoje && view !== "mensal"

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['dashboard', view, format(dataInicio, 'yyyy-MM-dd'), format(dataFim, 'yyyy-MM-dd'), unidadeId],
        queryFn: async () => {
            if (!unidadeId) return null;

            const { data, error } = await supabase.rpc('get_dashboard_completo', {
                p_unidade_id: unidadeId,
                p_data_inicio: format(dataInicio, 'yyyy-MM-dd'),
                p_data_fim: format(dataFim, 'yyyy-MM-dd')
            })
            if (error) throw error
            return data
        },
        refetchInterval: pollingActive ? 3000 : false,
        enabled: !!unidadeId
    })

    // Handler para troca de visão (ajusta as datas automaticamente)
    const handleViewChange = (newView: ViewType) => {
        setView(newView)

        const hoje = new Date()

        if (newView === "mensal") {
            setDataInicio(startOfMonth(hoje))
            setDataFim(endOfMonth(hoje))
        }

        if (newView === "diario") {
            setDataInicio(hoje)
            setDataFim(hoje)
        }

        if (newView === "geral") {
            // mantém range atual (NÃO resetar)
        }
    }
    // if (isLoading) return <LoadingScreen />

    return (
        <div className="min-h-screen p-4 md:p-6 space-y-6 bg-slate-50 dark:bg-[#020617]">

            {/* HEADER COM SELETOR DE VIEW */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-800 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
                        <Activity className={cn("w-5 h-5", pollingActive && "animate-pulse")} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">Dashboard - Depto. Atendimento</h1>
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Atualizado em tempo real</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* TABS DE VISUALIZAÇÃO */}
                    <Tabs value={view} onValueChange={(v) => handleViewChange(v as ViewType)} className="bg-gray-800 p-1 rounded-lg border border-gray-700">
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger value="geral" className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold">Geral</TabsTrigger>
                            <TabsTrigger value="diario" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold">Diário</TabsTrigger>
                            <TabsTrigger value="mensal" className="data-[state=active]:bg-purple-600 text-[10px] uppercase text-white font-bold">Mensal</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* SELETOR DE DATA ADAPTATIVO */}
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-gray-700">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="h-7 text-[10px] font-black text-white uppercase hover:bg-gray-800">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                    {view === 'geral' ? `${format(dataInicio, 'dd/MM')} - ${format(dataFim, 'dd/MM')}` : format(dataInicio, 'MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="end">
                                {view === "mensal" && (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={dataInicio.getMonth()}
                                            onChange={(e) => {
                                                const newDate = new Date(dataInicio)
                                                newDate.setMonth(Number(e.target.value))
                                                setDataInicio(startOfMonth(newDate))
                                                setDataFim(endOfMonth(newDate))
                                            }}
                                            className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md border border-gray-700"
                                        >
                                            {meses.map((m, i) => (
                                                <option key={i} value={i}>{m}</option>
                                            ))}
                                        </select>

                                        <select
                                            value={dataInicio.getFullYear()}
                                            onChange={(e) => {
                                                const newDate = new Date(dataInicio)
                                                newDate.setFullYear(Number(e.target.value))
                                                setDataInicio(startOfMonth(newDate))
                                                setDataFim(endOfMonth(newDate))
                                            }}
                                            className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md border border-gray-700"
                                        >
                                            {[2024, 2025, 2026, 2027].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {view == "geral" && (
                                    <Calendar
                                        mode="range"
                                        selected={{
                                            from: dataInicio,
                                            to: dataFim
                                        }}
                                        onSelect={(value: any) => {
                                            if (value?.from) setDataInicio(value.from)
                                            if (value?.to) setDataFim(value.to)
                                        }}
                                        locale={ptBR}
                                        numberOfMonths={2}
                                    // className={cn(
                                    //     "p-3 bg-gray-950 text-white rounded-xl border border-gray-800",
                                    //     "[&_.rdp-day]:text-white",
                                    //     "[&_.rdp-day_selected]:bg-emerald-600",
                                    //     "[&_.rdp-day_today]:border border-emerald-500",
                                    //     "[&_.rdp-day:hover]:bg-gray-800",
                                    //     "[&_.rdp-caption]:text-white",
                                    //     "[&_.rdp-head_cell]:text-gray-400"
                                    // )}
                                    />
                                )}

                                {view === "diario" && (
                                    <Calendar
                                        mode="single"
                                        selected={dataInicio}
                                        onSelect={(value: any) => {
                                            if (value) setDataInicio(value)
                                        }}
                                        locale={ptBR}
                                        numberOfMonths={1}
                                    // className={cn(
                                    //     "p-3 bg-gray-950 text-white rounded-xl border border-gray-800",
                                    //     "[&_.rdp-day]:text-white",
                                    //     "[&_.rdp-day_selected]:bg-emerald-600",
                                    //     "[&_.rdp-day_today]:border border-emerald-500",
                                    //     "[&_.rdp-day:hover]:bg-gray-800",
                                    //     "[&_.rdp-caption]:text-white",
                                    //     "[&_.rdp-head_cell]:text-gray-400"
                                    // )}
                                    />
                                )}

                            </PopoverContent>
                        </Popover>
                        {isFetching && <RefreshCcw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
                    </div>
                </div>
            </header>

            {/* CONTEÚDO DINÂMICO BASEADO NA VIEW */}
            {view === "geral" && <ViewGeral data={data} />}
            {view === "diario" && <ViewDiaria data={data} />}
            {view === "mensal" && <ViewMensal data={data} />}
        </div>
    )
}

/* ==========================================================================
   VIEW GERAL (A que já tínhamos, otimizada)
   ========================================================================== */
function ViewGeral({ data }: any) {
    const total = data?.especialidades?.reduce((acc: number, curr: any) => acc + curr.total, 0) || 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CardMetric title="Volume Período" value={total} icon={<Users />} color="emerald" label="Total Atendimentos" />
                <CardMetric title="Conversão Médica" value="94%" icon={<Activity />} color="blue" label="Efetividade de Triagem" />
                <CardMetric title="SLA de Espera" value="12m" icon={<Clock />} color="amber" label="Média Geral da Unidade" />
            </div>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-white/[0.02] border-b dark:border-gray-800">
                    <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" /> Fluxo de Atendimento por Horário
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[350px]"><GraficoAtendimentosHora data={data?.fluxoHora} /></div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <CardViewSimple title="Recepção" chart={<GraficoAtendimentosPorRecep data={data?.recepcao} />} />
                <CardViewSimple title="Especialidades" chart={<GraficoAtendimentosPorEsp data={data?.especialidades} />} />
                <CardViewSimple title="Tempo Médio" chart={<GraficoTempoMedioEsp data={data?.tempoEspecialidade} />} />
            </div>
        </div>
    )
}

/* ==========================================================================
   VIEW DIÁRIA / GARGALOS (Foco em Pizza e Senhas)
   ========================================================================== */
function ViewDiaria({ data }: any) {
    const cards = data?.cards || {}

    return (
        <div className="space-y-6">
            <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4">

                <Card className="bg-emerald-600 border-none text-white shadow-lg">
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase opacity-80">
                            Senhas Geradas
                        </p>
                        <p className="text-4xl font-black italic">
                            {cards.geradas ?? 0}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-600 border-none text-white shadow-lg">
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase opacity-80">
                            Em Atendimento
                        </p>
                        <p className="text-4xl font-black italic">
                            {cards.em_atendimento ?? 0}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500 border-none text-white shadow-lg">
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase opacity-80">
                            Aguardando
                        </p>
                        <p className="text-4xl font-black italic">
                            {cards.aguardando ?? 0}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-600 border-none text-white shadow-lg">
                    <CardContent className="p-4 text-center">
                        <p className="text-[10px] font-black uppercase opacity-80">
                            Finalizadas
                        </p>
                        <p className="text-4xl font-black italic">
                            {cards.finalizadas ?? 0}
                        </p>
                    </CardContent>
                </Card>

            </div>

            <CardPizzaSmall
                title="Recepção"
                data={data?.recepcao || []}
            />

            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* ESPECIALIDADES POR SALA */}
                {(data?.especialidadesDetalhado || []).map((esp: any) => (
                    <CardPizzaSmall
                        key={esp.especialidade}
                        title={esp.especialidade}
                        data={esp.salas}
                    />
                ))}

            </div>
        </div>
    )
}

/* ==========================================================================
   VIEW MENSAL
   ========================================================================== */
function ViewMensal({ data }: any) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2 dark:bg-gray-900 border-gray-800">
                <CardHeader>
                    <CardTitle className="text-xs font-black uppercase">Volume Mensal Consolidado</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    {/* Aqui entraria um gráfico de Barras por Dia do Mês */}
                    <div className="flex items-center justify-center h-full text-gray-600 font-mono text-[10px] uppercase tracking-widest">
                        <GraficoAtendimentosHora data={data?.volumeDiario} />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

/* ==========================================================================
   HELPERS / SUBCOMPONENTS
   ========================================================================== */

function CardMetric({ title, value, icon, color, label }: any) {
    const colors: any = {
        emerald: "bg-emerald-500/10 text-emerald-500",
        blue: "bg-blue-500/10 text-blue-500",
        amber: "bg-amber-500/10 text-amber-500"
    }
    return (
        <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardContent className="p-5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</p>
                    <p className="text-2xl font-black dark:text-white mt-1 italic">{value}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">{label}</p>
                </div>
                <div className={cn("p-3 rounded-xl", colors[color])}>{icon}</div>
            </CardContent>
        </Card>
    )
}

function CardViewSimple({ title, chart }: any) {
    return (
        <Card className="dark:bg-gray-900 border-gray-800">
            <CardHeader className="pb-2 border-b dark:border-gray-800 mb-4">
                <CardTitle className="text-[10px] font-black uppercase text-gray-500">{title}</CardTitle>
            </CardHeader>
            <CardContent>{chart}</CardContent>
        </Card>
    )
}

function CardPizzaSmall({ title, data }: any) {
    return (
        <Card className="w-full dark:bg-gray-900 border-gray-800">
            <CardHeader className="p-3 border-b dark:border-gray-800">
                <CardTitle className="text-[10px] font-black uppercase text-center text-gray-400">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-3 flex flex-col items-center">
                <div className="h-fit w-full">
                    <GraficoPizza data={data || []} />
                </div>

                {/* detalhe */}
                <div className="text-[10px] text-gray-400 text-center">
                    {data?.length || 0} salas
                </div>
            </CardContent>
        </Card>
    )
}

function LoadingScreen() {
    return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-950 gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-[10px] text-emerald-500 animate-pulse tracking-[0.3em]">RECONSTRUINDO AMBIENTE DE DADOS...</p>
        </div>
    )
}