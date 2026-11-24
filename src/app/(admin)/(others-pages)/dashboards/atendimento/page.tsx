"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, addDays } from "date-fns"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Icons
import {
    Activity,
    Layers,
    RefreshCcw,
} from "lucide-react"

// Importe seus gráficos aqui (assumindo que foram criados anteriormente)
import { GraficoPizza } from "@/components/atendimento/dashboards/diario/GraficoPizza"
import { resolveDashboardAnalytics } from "@/lib/dashboard-analytics"
import { FiltroPeriodoDashboard } from "./components/FiltroPeriodoDashboard"
import { CardIndicadorDashboard } from "./components/CardIndicadorDashboard"
import { PainelGruposEspecialidade } from "./components/PainelGruposEspecialidade"
import type { DashboardView } from "./types"
import type { DashboardPayload, RecepcaoItem, SalaEspecialidadeItem } from "@/lib/dashboard-analytics"
import { montarCardsPorGrupo, type CardGrupoDashboard, type EspecialidadeDashboard, type LinhaExameDashboard } from "@/lib/dashboard-grupos"
import { normalizarEspecialidade, type GrupoRegra } from "@/lib/grupos-especialidades"

const TAMANHO_PAGINA = 1000

interface ConfigGruposDashboard {
    grupos: GrupoRegra[]
    especialidades: EspecialidadeDashboard[]
}

/**
 * Grupos marcados para o dashboard (com especialidade da fila) e especialidades.
 * Consulta leve: define quais cards gerais ganham o botão de expandir.
 */
async function carregarConfigGrupos(unidadeId: string): Promise<ConfigGruposDashboard> {
    const { data: grupos, error: erroGrupos } = await supabase
        .from("grupos_especialidades")
        .select(`
            id,
            nome,
            tipo_filtro,
            exibir_dashboard,
            especialidade_fila_id,
            grupo_especialidade_itens(
                especialidade_id,
                obrigatoria,
                excludente,
                especialidades(id, nome)
            )
        `)
        .eq("unidade_id", unidadeId)
        .eq("ativo", true)
        .eq("exibir_dashboard", true)
        .not("especialidade_fila_id", "is", null)

    if (erroGrupos) throw erroGrupos
    if (!grupos?.length) return { grupos: [], especialidades: [] }

    const { data: especialidades, error: erroEsp } = await supabase
        .from("especialidades")
        .select("id, nome, tempo_finalizacao_segundos")
        .eq("unidade_id", unidadeId)

    if (erroEsp) throw erroEsp

    return {
        grupos: grupos as unknown as GrupoRegra[],
        especialidades: (especialidades || []) as EspecialidadeDashboard[],
    }
}

async function carregarLinhasExames(unidadeId: string, dataInicio: Date, dataFim: Date): Promise<LinhaExameDashboard[]> {
    const inicio = format(dataInicio, "yyyy-MM-dd")
    const fimExclusivo = format(addDays(dataFim, 1), "yyyy-MM-dd")
    const linhas: LinhaExameDashboard[] = []

    for (let pagina = 0; ; pagina++) {
        const { data, error } = await supabase
            .from("atendimento_exames")
            .select("id, atendimento_id, sala, num_sala, status, profissional, iniciado_em, finalizado_em, atendimentos!inner(created_at)")
            .eq("unidade_id", unidadeId)
            .gte("atendimentos.created_at", inicio)
            .lt("atendimentos.created_at", fimExclusivo)
            .order("id")
            .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)

        if (error) throw error

        for (const item of data || []) {
            linhas.push({
                atendimento_id: item.atendimento_id,
                sala: item.sala,
                num_sala: item.num_sala,
                status: item.status,
                profissional: item.profissional,
                iniciado_em: item.iniciado_em,
                finalizado_em: item.finalizado_em,
            })
        }

        if (!data || data.length < TAMANHO_PAGINA) break
    }

    return linhas
}

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

    // Especialidade cujo painel de grupos está aberto (nome normalizado).
    const [especialidadeAberta, setEspecialidadeAberta] = useState<string | null>(null)

    // Configuração dos grupos (leve): decide quais cards gerais mostram o botão de grupos.
    const { data: configGrupos } = useQuery({
        queryKey: ['dashboard-config-grupos', unidadeId],
        queryFn: () => carregarConfigGrupos(unidadeId),
        enabled: !!unidadeId,
        staleTime: 60000,
        refetchOnWindowFocus: false,
    })

    // Exames do período: só quando o painel de grupos está aberto, em qualquer visão.
    // A chave começa com 'dashboard' para ser invalidada junto pelo SSE.
    const { data: linhasExames, isFetching: carregandoLinhas } = useQuery({
        queryKey: [
            'dashboard',
            'grupos-linhas',
            format(dataInicio, 'yyyy-MM-dd'),
            format(dataFim, 'yyyy-MM-dd'),
            unidadeId
        ],
        queryFn: () => carregarLinhasExames(unidadeId, dataInicio, dataFim),
        enabled: !!unidadeId && !!especialidadeAberta && !!configGrupos?.grupos.length,
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
            <ViewDiaria
                data={data}
                configGrupos={configGrupos}
                linhasExames={linhasExames}
                carregandoLinhas={carregandoLinhas}
                especialidadeAberta={especialidadeAberta}
                onAbrirGrupos={setEspecialidadeAberta}
                periodo={
                    format(dataInicio, 'dd/MM/yyyy') === format(dataFim, 'dd/MM/yyyy')
                        ? format(dataInicio, 'dd/MM/yyyy')
                        : `${format(dataInicio, 'dd/MM/yyyy')} a ${format(dataFim, 'dd/MM/yyyy')}`
                }
            />
        </div>
    )
}

/* ==========================================================================
   VIEW GERAL (A que já tínhamos, otimizada)
   ========================================================================== */
/* ==========================================================================
   VIEW DIÁRIA (Foco em Pizza e Senhas)
   ========================================================================== */
function ViewDiaria({
    data,
    configGrupos,
    linhasExames,
    carregandoLinhas,
    especialidadeAberta,
    onAbrirGrupos,
    periodo,
}: {
    data: DashboardPayload | null | undefined
    configGrupos?: ConfigGruposDashboard
    linhasExames?: LinhaExameDashboard[]
    carregandoLinhas: boolean
    especialidadeAberta: string | null
    onAbrirGrupos: (chave: string | null) => void
    periodo: string
}) {
    const analytics = resolveDashboardAnalytics(data)
    const cards = analytics.cards
    const distribuicao = analytics.distribuicoes.especialidades || []
    const especialidadesOrdenadas = [...distribuicao].sort((a, b) => (b.total || 0) - (a.total || 0))

    // Quantos grupos de dashboard cada especialidade tem (chave: nome normalizado).
    const gruposPorEspecialidade = new Map<string, number>()
    for (const especialidade of configGrupos?.especialidades ?? []) {
        const quantidade = (configGrupos?.grupos ?? []).filter(
            g => g.especialidade_fila_id === especialidade.id
        ).length
        if (quantidade > 0) gruposPorEspecialidade.set(normalizarEspecialidade(especialidade.nome), quantidade)
    }

    // Cards por grupo: calculados só quando há exames carregados (painel aberto).
    const cardsPorGrupo = configGrupos?.grupos.length && linhasExames
        ? montarCardsPorGrupo(configGrupos.grupos, configGrupos.especialidades, linhasExames, distribuicao)
        : new Map<string, CardGrupoDashboard[]>()

    const espAberta = especialidadeAberta
        ? distribuicao.find(e => normalizarEspecialidade(e.especialidade) === especialidadeAberta)
        : undefined

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
                {especialidadesOrdenadas.map(esp => {
                    const chave = normalizarEspecialidade(esp.especialidade)
                    const quantidadeGrupos = gruposPorEspecialidade.get(chave) ?? 0

                    const botaoGrupos = quantidadeGrupos > 0 ? (
                        <button
                            type="button"
                            onClick={() => onAbrirGrupos(chave)}
                            className="flex items-center gap-1 rounded-md border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 hover:bg-blue-500/10 dark:text-blue-300"
                        >
                            <Layers className="h-3 w-3" />
                            Grupos ({quantidadeGrupos})
                        </button>
                    ) : undefined

                    return (
                        <div key={esp.especialidade}>
                            <CardPizzaSmall
                                title={esp.especialidade}
                                data={esp.salas}
                                aguardando={esp.aguardando}
                                acao={botaoGrupos}
                            />
                        </div>
                    )
                })}
            </div>

            <PainelGruposEspecialidade
                aberto={!!espAberta}
                onAbertoChange={(aberto) => { if (!aberto) onAbrirGrupos(null) }}
                especialidade={espAberta?.especialidade ?? ""}
                periodo={periodo}
                geral={{
                    total: espAberta?.total ?? 0,
                    aguardando: espAberta?.aguardando ?? 0,
                    salas: espAberta?.salas ?? [],
                }}
                grupos={especialidadeAberta ? cardsPorGrupo.get(especialidadeAberta) ?? [] : []}
                carregando={carregandoLinhas}
            />
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
    acao,
}: {
    title: string;
    data: Array<RecepcaoItem | SalaEspecialidadeItem>;
    aguardando?: number;
    acao?: ReactNode;
}) {
    return (
        <Card className="w-full dark:bg-gray-900 border-gray-800">
            <CardHeader className="flex items-center justify-center p-1 border-b dark:border-gray-800">
                <CardTitle className="text-1xl font-black uppercase text-center text-gray-500 dark:text-gray-100">
                    {title}
                </CardTitle>
                {acao && (
                    <div className="flex justify-center">
                        {acao}
                    </div>
                )}
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
