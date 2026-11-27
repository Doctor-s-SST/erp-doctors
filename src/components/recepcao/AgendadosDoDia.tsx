"use client"

/**
 * Recepção > Agendados do dia: agendados do SOC de hoje com a situação de cada
 * um (chegou, aguardando, atrasado, sem horário, saiu da agenda). Atualiza a cada
 * minuto. "Chegou" mostra a senha; clicar abre o atendimento na fila.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, Copy, Loader2, RefreshCw, Search } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { mascararCPF } from "@/lib/mascaras"
import {
    filtrarAgendados,
    formatarHorario,
    listarAgendadosDoDia,
    minutosAgoraSaoPaulo,
    minutosDoHorario,
    rotuloTipoCompromisso,
    situacaoAgendado,
    type Agendamento,
    type SituacaoAgendado,
} from "@/lib/agendamentos"

const INTERVALO_MS = 60_000

const SITUACOES: { valor: SituacaoAgendado | "todos"; rotulo: string; classe: string }[] = [
    { valor: "todos", rotulo: "Agendados", classe: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    { valor: "chegou", rotulo: "Chegaram", classe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
    { valor: "aguardando", rotulo: "Aguardando", classe: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
    { valor: "atrasado", rotulo: "Atrasados", classe: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
    { valor: "sem_horario", rotulo: "Sem horário", classe: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" },
    { valor: "cancelado", rotulo: "Saíram da agenda", classe: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
]
const ROTULO_SITUACAO: Record<SituacaoAgendado, string> = {
    chegou: "Chegou",
    aguardando: "Aguardando chegada",
    atrasado: "Atrasado",
    sem_horario: "Sem horário",
    cancelado: "Saiu da agenda",
}
const CLASSE_SITUACAO =Object.fromEntries(SITUACOES.map((s) => [s.valor, s.classe])) as Record<SituacaoAgendado | "todos", string>

function horaDe(iso: string | null | undefined): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function AgendadosDoDia({
    unidadeId,
    onAbrirAtendimento,
}: {
    unidadeId: string | null
    onAbrirAtendimento: (atendimentoId: string) => void
}) {
    const [lista, setLista] = useState<Agendamento[]>([])
    const [carregando, setCarregando] = useState(true)
    const [agora, setAgora] = useState<Date | null>(null)
    const [filtro, setFiltro] = useState<SituacaoAgendado | "todos">("todos")
    const [busca, setBusca] = useState("")

    const carregar = useCallback(async () => {
        if (!unidadeId) return
        try {
            setLista(await listarAgendadosDoDia(unidadeId))
            setAgora(new Date())
        } catch (error) {
            console.error(error)
            toast.error("Erro ao carregar os agendados do dia")
        } finally {
            setCarregando(false)
        }
    }, [unidadeId])

    useEffect(() => {
        queueMicrotask(() => void carregar())
        const timer = setInterval(() => void carregar(), INTERVALO_MS)
        return () => clearInterval(timer)
    }, [carregar])

    const comSituacao = useMemo(
        () => (agora ? lista.map((a) => ({ ...a, situacao: situacaoAgendado(a, agora) })) : []),
        [lista, agora]
    )
    const contagem = (s: SituacaoAgendado | "todos") =>
        s === "todos" ? comSituacao.filter((a) => a.situacao !== "cancelado").length : comSituacao.filter((a) => a.situacao === s).length
    const visiveis = filtrarAgendados(comSituacao, busca).filter((a) =>
        filtro === "todos" ? a.situacao !== "cancelado" : a.situacao === filtro
    )

    const ultimaSincronizacao = lista.reduce<string | null>((max, a) => (!max || a.sincronizado_em > max ? a.sincronizado_em : max), null)
    const minutosAgora = agora ? minutosAgoraSaoPaulo(agora) : 0

    const copiar = (texto: string) => {
        void navigator.clipboard.writeText(texto)
        toast.success(`Sequencial copiado: ${texto}`)
    }

    return (
        <Card className="border-none shadow-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 p-0">
            <CardContent className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {SITUACOES.map((s) => (
                            <button
                                key={s.valor}
                                type="button"
                                onClick={() => setFiltro(s.valor)}
                                className={cn(
                                    "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide transition-all",
                                    s.classe,
                                    filtro === s.valor ? "ring-2 ring-offset-1 ring-gray-500 dark:ring-offset-gray-900" : "opacity-80 hover:opacity-100"
                                )}
                            >
                                {s.rotulo}: {contagem(s.valor)}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border bg-white p-1.5 dark:border-gray-700 dark:bg-gray-950">
                            <Search className="ml-1 h-4 w-4 text-gray-400" />
                            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF, empresa ou sequencial" className="h-8 w-72 border-none shadow-none" />
                        </div>
                        <span className="text-[10px] text-slate-500">
                            {ultimaSincronizacao ? `SOC atualizado às ${horaDe(ultimaSincronizacao)}` : "Sem sincronização hoje"}
                        </span>
                        <button type="button" onClick={() => void carregar()} title="Atualizar" className="rounded-md p-1.5 text-slate-500 hover:bg-gray-200 dark:hover:bg-gray-800">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {carregando ? (
                    <div className="flex h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                ) : visiveis.length === 0 ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
                        <CalendarClock className="h-8 w-8" />
                        <p className="text-xs">{lista.length ? "Nenhum agendado neste filtro." : "Nenhum agendado para hoje."}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                        <table className="w-full text-[13px]">
                            <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50">
                                <tr>
                                    <th className="px-3 py-2">Horário</th>
                                    <th className="px-3 py-2">Funcionário</th>
                                    <th className="px-3 py-2">Empresa</th>
                                    <th className="px-3 py-2">Tipo</th>
                                    <th className="px-3 py-2">Sequencial</th>
                                    <th className="px-3 py-2">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visiveis.map((a) => {
                                    const minutos = minutosDoHorario(a.horario)
                                    const atraso = a.situacao === "atrasado" && minutos !== null ? minutosAgora - minutos : 0
                                    return (
                                        <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="px-3 py-2 font-black tabular-nums">{formatarHorario(a.horario)}</td>
                                            <td className="px-3 py-2">
                                                <p className="font-bold">{a.nome ?? "—"}</p>
                                                <p className="text-[11px] text-slate-500">{a.cpf ? mascararCPF(a.cpf) : "sem CPF"}</p>
                                            </td>
                                            <td className="px-3 py-2 text-xs">{a.nome_empresa ?? a.codigo_empresa}</td>
                                            <td className="px-3 py-2 text-xs">{rotuloTipoCompromisso(a.tipo_compromisso)}</td>
                                            <td className="px-3 py-2">
                                                {a.sequencial_ficha ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => copiar(a.sequencial_ficha!)}
                                                        title="Copiar sequencial"
                                                        className="flex items-center gap-1 rounded bg-gray-500/10 px-1.5 py-0.5 font-mono text-xs hover:bg-gray-500/25"
                                                    >
                                                        {a.sequencial_ficha} <Copy className="h-3 w-3" />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {a.situacao === "chegou" && a.atendimento_id ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onAbrirAtendimento(a.atendimento_id!)}
                                                        title="Ver na fila"
                                                        className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase hover:underline", CLASSE_SITUACAO.chegou)}
                                                    >
                                                        Chegou · senha {a.atendimentos?.senha_codigo ?? "—"} às {horaDe(a.atendimentos?.created_at)}
                                                    </button>
                                                ) : (
                                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase", CLASSE_SITUACAO[a.situacao])}>
                                                        {a.situacao === "atrasado"
                                                            ? `Atrasado ${atraso >= 60 ? `${Math.floor(atraso / 60)}h${String(atraso % 60).padStart(2, "0")}` : `${atraso} min`}`
                                                            : ROTULO_SITUACAO[a.situacao]}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
