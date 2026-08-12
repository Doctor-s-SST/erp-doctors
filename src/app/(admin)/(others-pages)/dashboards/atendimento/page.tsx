"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
    FileText,
    Hash
} from "lucide-react"

// Importe seus gráficos aqui (assumindo que foram criados anteriormente)
import { GraficoAtendimentosHora } from "@/components/atendimento/dashboards/GraficoAtendimentosHora"
import { GraficoAtendimentosPorRecep } from "@/components/atendimento/dashboards/GraficoAtendimentosPorRecep"
import { GraficoAtendimentosPorEsp } from "@/components/atendimento/dashboards/GraficoAtendimentosPorEsp"
import { GraficoAtendimentosPorSala } from "@/components/atendimento/dashboards/GraficoAtendimentosPorSala"
import { GraficoTempoMedioEsp } from "@/components/atendimento/dashboards/GraficoTempoMedioEsp"
import { GraficoTopEmpresas } from "@/components/atendimento/dashboards/GraficoTopEmpresas"
import { GraficoTipoAtendimentoPaciente } from "@/components/atendimento/dashboards/GraficoTipoAtendimentoPaciente"
import { GraficoPizza } from "@/components/atendimento/dashboards/diario/GraficoPizza"
import { resolveDashboardAnalytics } from "@/lib/dashboard-analytics"

type ViewType = "geral" | "diario" | "mensal"

export default function DashboardPage() {
    const [view, setView] = useState<ViewType>("diario")
    const [unidadeId, setUnidadeId] = useState("")
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Estados de Filtro
    const [dataInicio, setDataInicio] = useState<Date>(new Date())
    const [dataFim, setDataFim] = useState<Date>(new Date())


    useEffect(() => {
        const fetchUserContext = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, unidade_id')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    let idFinal = profile.unidade_id;
                    setUnidadeId(idFinal);
                }
            }
        };

        fetchUserContext();
    }, []);

    // Determina se deve fazer polling (apenas se for visão geral/diário e a data for hoje)
    const isHoje = format(dataInicio, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const pollingActive = isHoje && view !== "mensal"

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]

    const { data, isLoading, isFetching } = useQuery({
        queryKey: [
            'dashboard',
            view,
            format(dataInicio, 'yyyy-MM-dd'),
            format(dataFim, 'yyyy-MM-dd'),
            unidadeId
        ],

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

        // O polling cego SAI daqui!
        refetchInterval: false,

        enabled: !!unidadeId,
        placeholderData: (previousData) => previousData,
        staleTime: 2000,
        refetchOnWindowFocus: false,
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

    const queryClient = useQueryClient();

    useEffect(() => {

        if (!unidadeId || !pollingActive) return;

        const eventSource = new EventSource(
            `https://doctors-distribuidor-sse.cgalnz.easypanel.host/stream-fila?unidadeId=${unidadeId}&tipo=recepcao`
        );

        eventSource.onmessage = () => {

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => {

                queryClient.invalidateQueries({
                    queryKey: ['dashboard'],
                    refetchType: 'active'
                });

            }, 500);

        };

        eventSource.onerror = (err) => {
            console.error(
                "Erro ou desconexão no SSE do Dashboard:",
                err
            );
        };

        return () => {

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            eventSource.close();

        };

    }, [unidadeId, pollingActive, queryClient]);

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
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">Dashboard diário</h1>
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
                            {/* <TabsTrigger value="geral" className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold">Geral</TabsTrigger> */}
                            <TabsTrigger value="diario" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold">Diário</TabsTrigger>
                            {/* <TabsTrigger value="mensal" className="data-[state=active]:bg-purple-600 text-[10px] uppercase text-white font-bold">Mensal</TabsTrigger> */}
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
                                        className={cn(
                                            "p-3 bg-gray-950 text-white rounded-xl border border-gray-800",
                                            "[&_.rdp-day]:font-semi-bold",
                                            "[&_.rdp-day_selected]:bg-emerald-600",
                                            "[&_.rdp-day:hover]:bg-gray-800",
                                            "[&_.rdp-caption]:text-white",
                                            "[&_.rdp-head_cell]:text-gray-400"
                                        )}
                                    />
                                )}

                                {view === "diario" && (
                                    <Calendar
                                        mode="single"
                                        selected={dataInicio}
                                        onSelect={(value: any) => {
                                            if (value) {
                                                setDataInicio(value)
                                                setDataFim(value)
                                            }
                                        }}
                                        locale={ptBR}
                                        numberOfMonths={1}

                                        className={cn(
                                            "p-3 bg-gray-950 text-white rounded-xl border border-gray-800",
                                            "[&_.rdp-day]:font-semi-bold",
                                            "[&_.rdp-day_selected]:bg-emerald-600",
                                            "[&_.rdp-day:hover]:bg-gray-800",
                                            "[&_.rdp-caption]:text-white",
                                            "[&_.rdp-head_cell]:text-gray-400"
                                        )}
                                    />
                                )}

                            </PopoverContent>
                        </Popover>
                        {isFetching && <RefreshCcw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
                    </div>
                </div>
            </header>

            {/* CONTEÚDO DINÂMICO BASEADO NA VIEW */}
            {/* {view === "geral" && <ViewGeral data={data} />} */}
            {view === "diario" && <ViewDiaria data={data} />}
            {/* {view === "mensal" && <ViewMensal data={data} />} */}
        </div>
    )
}

/* ==========================================================================
   VIEW GERAL (A que já tínhamos, otimizada)
   ========================================================================== */
function formatMinutos(min: number | null | undefined): string {
    if (!min || min <= 0) return "—"
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

/* ==========================================================================
   VIEW DIÁRIA (Foco em Pizza e Senhas)
   ========================================================================== */
function ViewDiaria({ data }: any) {
    const analytics = resolveDashboardAnalytics(data)
    const cards = analytics.cards
    const especialidadesOrdenadas = [
        ...(analytics.distribuicoes.especialidades || [])
    ].sort((a: any, b: any) => (b.total || 0) - (a.total || 0))

    return (
        <div className="space-y-6">
            <div className="w-full grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-4">
                        <div className="w-full flex flex-col items-center gap-1">
                            <p className="text-1xl font-black text-gray-700 dark:text-gray-400 uppercase tracking-widest mb-1">
                                Senhas Geradas
                            </p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tight leading-none">
                                {cards.geradas ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-4">
                        <div className="w-full flex flex-col items-center gap-1">
                            <p className="text-1xl font-black text-gray-700 dark:text-gray-400 uppercase tracking-widest mb-1">
                                Em Atendimento
                            </p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tight leading-none">
                                {cards.em_atendimento ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-4">
                        <div className="w-full flex flex-col items-center gap-1">
                            <p className="text-1xl font-black text-gray-700 dark:text-gray-400 uppercase tracking-widest mb-1">
                                Aguardando
                            </p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tight leading-none">
                                {cards.aguardando ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-4">
                        <div className="w-full flex flex-col items-center gap-1">
                            <p className="text-1xl font-black text-gray-700 dark:text-gray-400 uppercase tracking-widest mb-1">
                                Finalizadas
                            </p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tight leading-none">
                                {cards.finalizadas ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="p-4">
                        <div className="w-full flex flex-col items-center gap-1">
                            <p className="text-1xl font-black text-gray-700 dark:text-gray-400 uppercase tracking-widest mb-1">
                                Canceladas
                            </p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tight leading-none">
                                {cards.cancelados ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* RECEPÇÃO */}
                <div className="md:col-span-2 lg:col-span-2">
                    <CardPizzaSmall
                        title="Recepção"
                        data={analytics.distribuicoes.recepcao || []}
                    />
                </div>

                {/* ESPECIALIDADES */}
                {especialidadesOrdenadas.map((esp: any, index: number) => (
                    <div
                        key={esp.especialidade}

                    >
                        <CardPizzaSmall
                            title={esp.especialidade}
                            data={esp.salas}
                            aguardando={esp.aguardando}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ==========================================================================
   HELPERS / SUBCOMPONENTS
   ========================================================================== */

interface BadgeProps {
    label: string
    color: string
}

function CardMetric({
    title,
    value,
    sub,
    icon,
    color,
    badge,
}: {
    title: string
    value: string | number
    sub?: string
    icon: React.ReactNode
    color: "emerald" | "blue" | "amber" | "purple"
    badge?: BadgeProps
}) {
    const colorMap = {
        emerald: {
            bg: "bg-emerald-500/10 dark:bg-emerald-500/10",
            icon: "text-emerald-500",
            ring: "ring-emerald-500/20",
        },
        blue: {
            bg: "bg-blue-500/10",
            icon: "text-blue-400",
            ring: "ring-blue-500/20",
        },
        amber: {
            bg: "bg-amber-500/10",
            icon: "text-amber-400",
            ring: "ring-amber-500/20",
        },
        purple: {
            bg: "bg-purple-500/10",
            icon: "text-purple-400",
            ring: "ring-purple-500/20",
        },
    }
    const c = colorMap[color]

    return (
        <Card className="dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest mb-1">
                            {title}
                        </p>
                        <p className="text-3xl font-black dark:text-white italic tracking-tight leading-none">
                            {value}
                        </p>
                        {sub && (
                            <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                                {sub}
                            </p>
                        )}
                        {badge && (
                            <p className={`text-[10px] font-bold mt-1 ${badge.color}`}>
                                {badge.label}
                            </p>
                        )}
                    </div>
                    <div className={`p-2.5 rounded-xl ring-1 flex-shrink-0 ${c.bg} ${c.ring}`}>
                        <span className={c.icon}>{icon}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function CardViewSimple({ title, chart }: { title: string; chart: React.ReactNode }) {
    return (
        <Card className="dark:bg-gray-900 border-gray-800">
            <CardHeader className="pb-2 border-b dark:border-gray-800 mb-4">
                <CardTitle className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-100">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>{chart}</CardContent>
        </Card>
    )
}
function CardPizzaSmall({ title, data, aguardando = 0 }: any) {
    return (
        <Card className={`w-full dark:bg-gray-900 border-gray-800`}>
            <CardHeader className="p-1 border-b dark:border-gray-800">
                <CardTitle className="text-1xl font-black uppercase text-center text-gray-500 dark:text-gray-100">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-1 flex flex-col items-center">
                <div className="h-fit w-full">
                    <GraficoPizza
                        data={data || []}
                        aguardandoExterno={aguardando}
                        mode={title == "Recepção" ? "recepcao" : "especialidade"}
                    />
                </div>

                {/* <div className="text-[12px] text-gray-500 text-center mt-2">
                    {title != "Recepção"
                        ? `${data.length} Salas`
                        : `${data.length} Recepcionistas`}
                </div> */}
            </CardContent>
        </Card>
    )
}