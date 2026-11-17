"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { addDays, format } from "date-fns"
import { BarChart3, Download, RefreshCcw, Table2 } from "lucide-react"
import { toast } from "sonner"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    calcularGestaoTempo,
    classificarFarol,
    formatarDuracao,
    type EspecialidadeMeta,
    type Farol,
    type LinhaTempo,
    type ResumoEspecialidade,
} from "@/lib/gestao-tempo"
import { exportarGestaoTempo } from "@/lib/exportar-gestao-tempo"

const TAMANHO_PAGINA = 1000
const TAMANHO_LOTE_IDS = 150

/** Nome da "especialidade" que representa a recepção na Gestão de Tempo. */
const NOME_RECEPCAO = "RECEPÇÃO"

const COR_FAROL: Record<Farol, string> = {
    verde: "#10b981",
    amarelo: "#f59e0b",
    vermelho: "#ef4444",
    sem_meta: "#94a3b8",
}

const ROTULO_FAROL: Record<Farol, string> = {
    verde: "Dentro da meta",
    amarelo: "Na tolerância",
    vermelho: "Acima da meta",
    sem_meta: "Sem meta",
}

interface Props {
    unidadeId: string
    dataInicio: Date
    dataFim: Date
    periodo: string
}

interface DadosGestaoTempo {
    especialidades: EspecialidadeMeta[]
    linhas: LinhaTempo[]
}

/** Etapas finalizadas dos atendimentos do período (mesmo recorte de data do dashboard). */
async function carregarDadosGestaoTempo(unidadeId: string, dataInicio: Date, dataFim: Date): Promise<DadosGestaoTempo> {
    const { data: especialidades, error: erroEsp } = await supabase
        .from("especialidades")
        .select("id, nome, tempo_finalizacao_segundos, tempo_meta_minutos, tolerancia_meta_percentual")
        .eq("unidade_id", unidadeId)

    if (erroEsp) throw erroEsp

    const inicio = format(dataInicio, "yyyy-MM-dd")
    const fimExclusivo = format(addDays(dataFim, 1), "yyyy-MM-dd")
    const linhas: LinhaTempo[] = []

    const recepcao = await carregarRecepcao(unidadeId, inicio, fimExclusivo)

    for (let pagina = 0; ; pagina++) {
        const { data, error } = await supabase
            .from("atendimento_exames")
            .select("id, atendimento_id, sala, num_sala, profissional, iniciado_em, finalizado_em, atendimentos!inner(created_at, senha_codigo, pacientes(nome))")
            .eq("unidade_id", unidadeId)
            .eq("status", "FINALIZADO")
            .not("iniciado_em", "is", null)
            .not("finalizado_em", "is", null)
            .gte("atendimentos.created_at", inicio)
            .lt("atendimentos.created_at", fimExclusivo)
            .order("id")
            .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)

        if (error) throw error

        for (const item of data || []) {
            const atendimento = (Array.isArray(item.atendimentos) ? item.atendimentos[0] : item.atendimentos) as
                | { senha_codigo?: string | null; pacientes?: { nome?: string | null } | { nome?: string | null }[] | null }
                | null
            const paciente = Array.isArray(atendimento?.pacientes) ? atendimento?.pacientes[0] : atendimento?.pacientes

            linhas.push({
                id: item.id,
                atendimento_id: item.atendimento_id,
                especialidade: item.sala ?? "",
                num_sala: item.num_sala,
                profissional: item.profissional,
                iniciado_em: item.iniciado_em as string,
                finalizado_em: item.finalizado_em as string,
                senha: atendimento?.senha_codigo ?? null,
                paciente: paciente?.nome ?? null,
            })
        }

        if (!data || data.length < TAMANHO_PAGINA) break
    }

    return {
        especialidades: [...((especialidades || []) as EspecialidadeMeta[]), recepcao.meta],
        linhas: [...recepcao.linhas, ...linhas],
    }
}

/**
 * Recepção: tempo de cada recepcionista, da primeira entrada em EM_RECEPCAO
 * (log_status_atendimento) até atendimentos.finalizado_recepcao — a mesma conta
 * do card de recepção da get_dashboard_completo. Meta e tolerância vêm da unidade.
 */
async function carregarRecepcao(
    unidadeId: string,
    inicio: string,
    fimExclusivo: string
): Promise<{ meta: EspecialidadeMeta; linhas: LinhaTempo[] }> {
    // select("*"): funciona mesmo antes do SQL das colunas de meta da recepção.
    const { data: unidade } = await supabase.from("unidades").select("*").eq("id", unidadeId).single()

    const meta: EspecialidadeMeta = {
        id: "recepcao",
        nome: NOME_RECEPCAO,
        tempo_finalizacao_segundos: 0,
        tempo_meta_minutos: unidade?.tempo_meta_recepcao_minutos ?? null,
        tolerancia_meta_percentual: unidade?.tolerancia_meta_recepcao_percentual ?? 20,
    }

    type AtendimentoRecepcao = {
        id: string
        atendente: string | null
        guiche: string | null
        senha_codigo: string | null
        finalizado_recepcao: string
        pacientes: { nome?: string | null } | { nome?: string | null }[] | null
    }

    const atendimentos: AtendimentoRecepcao[] = []
    for (let pagina = 0; ; pagina++) {
        const { data, error } = await supabase
            .from("atendimentos")
            .select("id, atendente, guiche, senha_codigo, finalizado_recepcao, pacientes(nome)")
            .eq("unidade_id", unidadeId)
            .gte("created_at", inicio)
            .lt("created_at", fimExclusivo)
            .not("finalizado_recepcao", "is", null)
            .order("id")
            .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)

        if (error) throw error
        atendimentos.push(...((data || []) as AtendimentoRecepcao[]))
        if (!data || data.length < TAMANHO_PAGINA) break
    }

    // Primeira entrada em EM_RECEPCAO de cada atendimento, em lotes de ids.
    const entrada = new Map<string, string>()
    for (let i = 0; i < atendimentos.length; i += TAMANHO_LOTE_IDS) {
        const ids = atendimentos.slice(i, i + TAMANHO_LOTE_IDS).map((a) => a.id)
        const { data, error } = await supabase
            .from("log_status_atendimento")
            .select("atendimento_id, data_hora")
            .in("atendimento_id", ids)
            .eq("status_novo", "EM_RECEPCAO")

        if (error) throw error
        for (const log of data || []) {
            if (!log.data_hora) continue
            const atual = entrada.get(log.atendimento_id)
            if (!atual || log.data_hora < atual) entrada.set(log.atendimento_id, log.data_hora)
        }
    }

    const linhas: LinhaTempo[] = []
    for (const a of atendimentos) {
        const iniciado = entrada.get(a.id)
        if (!iniciado) continue
        const paciente = Array.isArray(a.pacientes) ? a.pacientes[0] : a.pacientes

        linhas.push({
            id: `recepcao-${a.id}`,
            atendimento_id: a.id,
            especialidade: NOME_RECEPCAO,
            num_sala: a.guiche,
            profissional: a.atendente,
            iniciado_em: iniciado,
            finalizado_em: a.finalizado_recepcao,
            senha: a.senha_codigo,
            paciente: paciente?.nome ?? null,
        })
    }

    return { meta, linhas }
}

/**
 * Aba Gestão de Tempo do dashboard: tempo médio por profissional, farol contra
 * a meta da especialidade e exportação dos tempos individuais.
 */
export function GestaoTempoDashboard({ unidadeId, dataInicio, dataFim, periodo }: Props) {
    const [especialidadeFiltro, setEspecialidadeFiltro] = useState("todas")
    const [modo, setModo] = useState<"tabelas" | "graficos">("tabelas")

    // Chave começando com 'dashboard': o SSE do dia atual também atualiza esta aba.
    const { data, isFetching, error } = useQuery({
        queryKey: ["dashboard", "gestao-tempo", format(dataInicio, "yyyy-MM-dd"), format(dataFim, "yyyy-MM-dd"), unidadeId],
        queryFn: () => carregarDadosGestaoTempo(unidadeId, dataInicio, dataFim),
        enabled: !!unidadeId,
        placeholderData: (anterior) => anterior,
        staleTime: 2000,
        refetchOnWindowFocus: false,
    })

    const calculado = calcularGestaoTempo(data?.linhas ?? [], data?.especialidades ?? [])
    // Recepção primeiro, depois as especialidades em ordem alfabética.
    const resultado = {
        ...calculado,
        especialidades: [
            ...calculado.especialidades.filter((e) => e.especialidade === NOME_RECEPCAO),
            ...calculado.especialidades.filter((e) => e.especialidade !== NOME_RECEPCAO),
        ],
    }
    const especialidadesVisiveis = resultado.especialidades.filter(
        (e) => especialidadeFiltro === "todas" || e.especialidade === especialidadeFiltro
    )
    const atendimentosVisiveis = resultado.atendimentos.filter(
        (a) => especialidadeFiltro === "todas" || a.especialidade === especialidadeFiltro
    )
    const profissionaisVisiveis = especialidadesVisiveis.flatMap((e) => e.profissionais)

    const total = atendimentosVisiveis.length
    const comMeta = atendimentosVisiveis.filter((a) => a.farol !== "sem_meta")
    const mediaGeral = total ? atendimentosVisiveis.reduce((acc, a) => acc + a.minutos, 0) / total : 0
    const pct = (farol: Farol) =>
        comMeta.length ? Math.round((comMeta.filter((a) => a.farol === farol).length / comMeta.length) * 100) : null

    const exportar = () => {
        if (!atendimentosVisiveis.length) {
            toast.warning("Não há atendimentos finalizados no período")
            return
        }
        const sufixo = especialidadeFiltro === "todas" ? "" : `_${especialidadeFiltro.replace(/\s+/g, "-")}`
        exportarGestaoTempo(
            profissionaisVisiveis,
            atendimentosVisiveis,
            periodo,
            `gestao-tempo_${format(dataInicio, "yyyy-MM-dd")}_${format(dataFim, "yyyy-MM-dd")}${sufixo}.xlsx`
        )
    }

    const especialidadeGrafico = especialidadeFiltro !== "todas" ? especialidadesVisiveis[0] : undefined

    return (
        <div className="space-y-6">
            {/* FILTRO E EXPORTAÇÃO */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Select value={especialidadeFiltro} onValueChange={setEspecialidadeFiltro}>
                        <SelectTrigger className="h-9 w-64 bg-white text-xs font-bold uppercase dark:bg-gray-900">
                            <SelectValue placeholder="Especialidade" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas" className="text-xs font-bold uppercase">Todas as especialidades</SelectItem>
                            {resultado.especialidades.map((e) => (
                                <SelectItem key={e.especialidade} value={e.especialidade} className="text-xs font-bold uppercase">
                                    {e.especialidade}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* MODO DE VISUALIZAÇÃO */}
                    <div className="flex h-9 items-center rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-800 dark:bg-gray-900" role="group" aria-label="Modo de visualização">
                        {([
                            ["tabelas", "Tabelas", Table2],
                            ["graficos", "Gráficos", BarChart3],
                        ] as const).map(([valor, rotulo, Icone]) => (
                            <button
                                key={valor}
                                type="button"
                                onClick={() => setModo(valor)}
                                aria-pressed={modo === valor}
                                className={cn(
                                    "flex h-full items-center gap-1.5 rounded-md px-3 text-[11px] font-bold uppercase tracking-wide transition-colors",
                                    modo === valor
                                        ? "bg-amber-600 text-white"
                                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                )}
                            >
                                <Icone className="h-3.5 w-3.5" />
                                {rotulo}
                            </button>
                        ))}
                    </div>

                    {isFetching && <RefreshCcw className="h-3.5 w-3.5 animate-spin text-emerald-500" />}
                </div>

                <Button size="sm" onClick={exportar} className="bg-emerald-600 text-xs font-bold hover:bg-emerald-700">
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Exportar Excel
                </Button>
            </div>

            {error && (
                <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Não foi possível carregar os tempos. Confira se o SQL da meta por especialidade já foi aplicado.
                </p>
            )}

            {/* RESUMO */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Indicador titulo="Atendimentos finalizados" valor={String(total)} />
                <Indicador titulo="Tempo médio" valor={total ? formatarDuracao(mediaGeral) : "—"} />
                <Indicador titulo="Dentro da meta" valor={pct("verde") === null ? "—" : `${pct("verde")}%`} cor={COR_FAROL.verde} />
                <Indicador titulo="Na tolerância" valor={pct("amarelo") === null ? "—" : `${pct("amarelo")}%`} cor={COR_FAROL.amarelo} />
                <Indicador titulo="Acima da meta" valor={pct("vermelho") === null ? "—" : `${pct("vermelho")}%`} cor={COR_FAROL.vermelho} />
            </div>

            {/* GRÁFICO DA ESPECIALIDADE SELECIONADA (modo tabelas) */}
            {modo === "tabelas" && especialidadeGrafico && especialidadeGrafico.profissionais.length > 0 && (
                <Card className="dark:border-gray-800 dark:bg-gray-900">
                    <CardHeader className="border-b p-3 dark:border-gray-800">
                        <CardTitle className="text-sm font-black uppercase text-gray-600 dark:text-gray-100">
                            Tempo médio por profissional
                            {especialidadeGrafico.meta ? ` · meta ${formatarDuracao(especialidadeGrafico.meta)}` : ""}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        <GraficoTempoMedio especialidade={especialidadeGrafico} />
                    </CardContent>
                </Card>
            )}

            {/* MODO GRÁFICOS */}
            {modo === "graficos" && especialidadeFiltro === "todas" && especialidadesVisiveis.length > 1 && (
                <Card className="dark:border-gray-800 dark:bg-gray-900">
                    <CardHeader className="border-b p-3 dark:border-gray-800">
                        <CardTitle className="text-sm font-black uppercase text-gray-600 dark:text-gray-100">
                            Tempo médio por especialidade
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                        <GraficoEspecialidades especialidades={especialidadesVisiveis} />
                    </CardContent>
                </Card>
            )}

            {modo === "graficos" && especialidadesVisiveis.map((esp) => (
                <Card key={esp.especialidade} className="overflow-hidden dark:border-gray-800 dark:bg-gray-900">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b p-3 dark:border-gray-800">
                        <CardTitle className="text-sm font-black uppercase text-gray-600 dark:text-gray-100">
                            {esp.especialidade}
                        </CardTitle>
                        <span className="text-[11px] text-gray-500">
                            {esp.meta
                                ? `Meta ${formatarDuracao(esp.meta)} · tolerância ${esp.tolerancia}% · `
                                : "Sem meta definida · "}
                            média {formatarDuracao(esp.media)} em {esp.quantidade} atendimentos
                        </span>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 p-3 xl:grid-cols-2">
                        <div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Tempo médio por profissional</p>
                            <GraficoTempoMedio especialidade={esp} />
                        </div>
                        <div>
                            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Atendimentos por faixa do farol</p>
                            {esp.meta ? (
                                <GraficoDistribuicao especialidade={esp} />
                            ) : (
                                <p className="flex h-40 items-center justify-center text-[11px] text-gray-400">
                                    {esp.especialidade === NOME_RECEPCAO
                                        ? "Defina a meta da recepção em Configurações > Unidade > Atendimento para ver o farol."
                                        : "Defina a meta da especialidade no Kanban para ver o farol."}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* TABELAS POR ESPECIALIDADE */}
            {especialidadesVisiveis.length === 0 && !isFetching && (
                <p className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    Nenhum atendimento finalizado no período
                </p>
            )}

            {modo === "tabelas" && especialidadesVisiveis.map((esp) => (
                <Card key={esp.especialidade} className="overflow-hidden dark:border-gray-800 dark:bg-gray-900">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b p-3 dark:border-gray-800">
                        <CardTitle className="text-sm font-black uppercase text-gray-600 dark:text-gray-100">
                            {esp.especialidade}
                        </CardTitle>
                        <span className="text-[11px] text-gray-500">
                            {esp.meta
                                ? `Meta ${formatarDuracao(esp.meta)} · tolerância ${esp.tolerancia}% · `
                                : "Sem meta definida · "}
                            média {formatarDuracao(esp.media)} em {esp.quantidade} atendimentos
                        </span>
                    </CardHeader>
                    <CardContent className="overflow-x-auto p-0">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                <tr>
                                    <th className="p-2.5 text-left font-bold">Profissional</th>
                                    <th className="p-2.5 text-right font-bold">Atendimentos</th>
                                    <th className="p-2.5 text-right font-bold">Tempo médio</th>
                                    <th className="p-2.5 text-right font-bold">Mínimo</th>
                                    <th className="p-2.5 text-right font-bold">Máximo</th>
                                    <th className="p-2.5 text-left font-bold">Distribuição</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {esp.profissionais.map((p) => (
                                    <tr key={p.chave}>
                                        <td className="p-2.5 font-bold text-gray-800 dark:text-gray-100">{p.profissional}</td>
                                        <td className="p-2.5 text-right tabular-nums">{p.quantidade}</td>
                                        <td className="p-2.5 text-right">
                                            <span
                                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold tabular-nums"
                                                style={{ backgroundColor: `${COR_FAROL[p.farol]}22`, color: COR_FAROL[p.farol] }}
                                                title={ROTULO_FAROL[p.farol]}
                                            >
                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_FAROL[p.farol] }} />
                                                {formatarDuracao(p.media)}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-right tabular-nums text-gray-500">{formatarDuracao(p.minimo)}</td>
                                        <td className="p-2.5 text-right tabular-nums text-gray-500">{formatarDuracao(p.maximo)}</td>
                                        <td className="p-2.5">
                                            {p.meta ? <BarraDistribuicao verde={p.verde} amarelo={p.amarelo} vermelho={p.vermelho} /> : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function Indicador({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
    return (
        <Card className="dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{titulo}</p>
                <p className={cn("text-2xl font-black tabular-nums text-gray-900 dark:text-white")} style={cor ? { color: cor } : undefined}>
                    {valor}
                </p>
            </CardContent>
        </Card>
    )
}

function BarraDistribuicao({ verde, amarelo, vermelho }: { verde: number; amarelo: number; vermelho: number }) {
    const total = verde + amarelo + vermelho
    if (!total) return <span className="text-gray-400">—</span>

    const partes: [Farol, number][] = [["verde", verde], ["amarelo", amarelo], ["vermelho", vermelho]]

    return (
        <div className="flex min-w-40 items-center gap-2">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                {partes.map(([farol, qtd]) =>
                    qtd > 0 ? (
                        <div key={farol} style={{ width: `${(qtd / total) * 100}%`, backgroundColor: COR_FAROL[farol] }} title={`${ROTULO_FAROL[farol]}: ${qtd}`} />
                    ) : null
                )}
            </div>
            <span className="whitespace-nowrap text-[10px] tabular-nums text-gray-500">
                {verde}/{amarelo}/{vermelho}
            </span>
        </div>
    )
}

function alturaGrafico(itens: number): number {
    return Math.max(160, itens * 42)
}

/** Barras horizontais: tempo médio de cada profissional, cor do farol e linha da meta. */
function GraficoTempoMedio({ especialidade }: { especialidade: ResumoEspecialidade }) {
    return (
        <div style={{ height: alturaGrafico(especialidade.profissionais.length) }}>
            <ResponsiveContainer>
                <BarChart data={especialidade.profissionais} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.3} />
                    <XAxis type="number" tickFormatter={(v) => `${v}min`} fontSize={11} />
                    <YAxis type="category" dataKey="profissional" width={170} fontSize={11} />
                    <Tooltip
                        formatter={(valor) => [formatarDuracao(Number(valor)), "Tempo médio"]}
                        cursor={{ fillOpacity: 0.08 }}
                    />
                    {especialidade.meta && (
                        <ReferenceLine
                            x={especialidade.meta}
                            stroke={COR_FAROL.vermelho}
                            strokeDasharray="4 4"
                            label={{ value: "Meta", position: "top", fontSize: 10, fill: COR_FAROL.vermelho }}
                        />
                    )}
                    <Bar dataKey="media" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                        {especialidade.profissionais.map((p) => (
                            <Cell key={p.chave} fill={COR_FAROL[p.farol]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Barras empilhadas: quantos atendimentos de cada profissional ficaram em cada faixa do farol. */
function GraficoDistribuicao({ especialidade }: { especialidade: ResumoEspecialidade }) {
    return (
        <div style={{ height: alturaGrafico(especialidade.profissionais.length) + 24 }}>
            <ResponsiveContainer>
                <BarChart data={especialidade.profissionais} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.3} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis type="category" dataKey="profissional" width={170} fontSize={11} />
                    <Tooltip cursor={{ fillOpacity: 0.08 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="verde" name={ROTULO_FAROL.verde} stackId="farol" fill={COR_FAROL.verde} isAnimationActive={false} />
                    <Bar dataKey="amarelo" name={ROTULO_FAROL.amarelo} stackId="farol" fill={COR_FAROL.amarelo} isAnimationActive={false} />
                    <Bar dataKey="vermelho" name={ROTULO_FAROL.vermelho} stackId="farol" fill={COR_FAROL.vermelho} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

/** Barras verticais: tempo médio de cada especialidade, com a cor do farol contra a meta dela. */
function GraficoEspecialidades({ especialidades }: { especialidades: ResumoEspecialidade[] }) {
    const dados = especialidades.map((e) => ({
        especialidade: e.especialidade,
        media: e.media,
        meta: e.meta,
        farol: classificarFarol(e.media, e.meta, e.tolerancia),
    }))

    return (
        <div className="h-72">
            <ResponsiveContainer>
                <BarChart data={dados} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="especialidade" fontSize={10} interval={0} tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${v}min`} fontSize={11} />
                    <Tooltip
                        formatter={(valor, nome) => [formatarDuracao(Number(valor)), nome === "meta" ? "Meta" : "Tempo médio"]}
                        cursor={{ fillOpacity: 0.08 }}
                    />
                    <Bar dataKey="media" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {dados.map((d) => (
                            <Cell key={d.especialidade} fill={COR_FAROL[d.farol]} />
                        ))}
                    </Bar>
                    <Bar dataKey="meta" fill="none" stroke={COR_FAROL.vermelho} strokeDasharray="4 4" isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
