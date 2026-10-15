"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth } from "date-fns"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Icons
import {
    Activity,
    RefreshCcw,
} from "lucide-react"

// Importe seus gráficos aqui (assumindo que foram criados anteriormente)
import { GraficoPizza } from "@/components/atendimento/dashboards/diario/GraficoPizza"
import { resolveDashboardAnalytics } from "@/lib/dashboard-analytics"
import { FiltroPeriodoDashboard } from "./components/FiltroPeriodoDashboard"
import { CardIndicadorDashboard } from "./components/CardIndicadorDashboard"
import type { DashboardView } from "./types"
import type { DashboardPayload, RecepcaoItem, SalaEspecialidadeItem } from "@/lib/dashboard-analytics"

export default function DashboardPage() {
    const [view, setView] = useState<DashboardView>("diario")
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
                    const idFinal = profile.unidade_id;
                    setUnidadeId(idFinal);
                }
            }
        };

        fetchUserContext();
    }, []);

    // Determina se deve fazer polling (apenas se for visão geral/diário e a data for hoje)
    const isHoje = format(dataInicio, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const pollingActive = isHoje && view !== "mensal"

    const { data, isFetching } = useQuery({
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
    const handleViewChange = (newView: DashboardView) => {
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
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">
                            Dashboard {view === "diario" ? "diário" : view === "mensal" ? "mensal" : "por período"}
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className={cn("h-1.5 w-1.5 rounded-full", pollingActive ? "animate-pulse bg-emerald-500" : "bg-gray-500")} />
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {pollingActive ? "Atualizado em tempo real" : "Período histórico"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* TABS DE VISUALIZAÇÃO */}
                    <Tabs value={view} onValueChange={(v) => handleViewChange(v as DashboardView)} className="bg-gray-800 p-1 rounded-lg border border-gray-700">
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger value="geral" className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold">Período</TabsTrigger>
                            <TabsTrigger value="diario" className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold">Diário</TabsTrigger>
                            <TabsTrigger value="mensal" className="data-[state=active]:bg-purple-600 text-[10px] uppercase text-white font-bold">Mensal</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* SELETOR DE DATA ADAPTATIVO */}
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-gray-700">
                        <FiltroPeriodoDashboard
                            view={view}
                            dataInicio={dataInicio}
                            dataFim={dataFim}
                            onChange={(inicio, fim) => {
                                setDataInicio(inicio)
                                setDataFim(fim)
                            }}
                        />
                        {isFetching && <RefreshCcw className="w-3.5 h-3.5 text-emerald-500 animate-spin" />}
                    </div>
                </div>
            </header>

            {/* CONTEÚDO DINÂMICO BASEADO NA VIEW */}
            <ViewDiaria data={data} />
        </div>
    )
}

/* ==========================================================================
   VIEW GERAL (A que já tínhamos, otimizada)
   ========================================================================== */
/* ==========================================================================
   VIEW DIÁRIA (Foco em Pizza e Senhas)
   ========================================================================== */
function ViewDiaria({ data }: { data: DashboardPayload | null | undefined }) {
    const analytics = resolveDashboardAnalytics(data)
    const cards = analytics.cards
    const especialidadesOrdenadas = [
        ...(analytics.distribuicoes.especialidades || [])
    ].sort((a, b) => (b.total || 0) - (a.total || 0))
    const indicadores = [
        { titulo: "Senhas Geradas", valor: cards.geradas ?? 0 },
        { titulo: "Em Atendimento", valor: cards.em_atendimento ?? 0 },
        { titulo: "Aguardando", valor: cards.aguardando ?? 0 },
        { titulo: "Finalizadas", valor: cards.finalizadas ?? 0 },
        { titulo: "Canceladas", valor: cards.cancelados ?? 0 },
    ]

    return (
        <div className="space-y-6">
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {indicadores.map(indicador => (
                    <CardIndicadorDashboard key={indicador.titulo} {...indicador} />
                ))}
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
                {especialidadesOrdenadas.map(esp => (
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

function CardPizzaSmall({
    title,
    data,
    aguardando = 0,
}: {
    title: string;
    data: Array<RecepcaoItem | SalaEspecialidadeItem>;
    aguardando?: number;
}) {
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
