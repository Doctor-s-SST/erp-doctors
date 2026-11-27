"use client"

/**
 * Busca de agendado na ficha da recepção: digita CPF, nome ou empresa e escolhe
 * na lista de agendados de hoje. Quem escolhe decide o que fazer (importar pelo
 * sequencial ou preencher os dados).
 */

import { useEffect, useState } from "react"
import { CalendarClock, Loader2, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { mascararCPF } from "@/lib/mascaras"
import { filtrarAgendados, formatarHorario, listarAgendadosDoDia, rotuloTipoCompromisso, type Agendamento } from "@/lib/agendamentos"

const MAX_RESULTADOS = 6

export function BuscaAgendado({
    unidadeId,
    onSelecionar,
    desabilitado,
}: {
    unidadeId: string | null
    onSelecionar: (agendamento: Agendamento) => void
    desabilitado?: boolean
}) {
    const [lista, setLista] = useState<Agendamento[] | null>(null)
    const [termo, setTermo] = useState("")
    const [aberto, setAberto] = useState(false)

    useEffect(() => {
        if (!unidadeId) return
        let ativo = true
        listarAgendadosDoDia(unidadeId)
            .then((dados) => { if (ativo) setLista(dados.filter((a) => !a.removido_soc_em)) })
            .catch(() => { if (ativo) setLista([]) })
        return () => { ativo = false }
    }, [unidadeId])

    const resultados = termo.trim().length >= 3 ? filtrarAgendados(lista ?? [], termo).slice(0, MAX_RESULTADOS) : []

    return (
        <div className="relative">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
                <CalendarClock className="ml-1 h-5 w-5 shrink-0 text-blue-600" />
                <Input
                    value={termo}
                    disabled={desabilitado}
                    onChange={(e) => { setTermo(e.target.value); setAberto(true) }}
                    onFocus={() => setAberto(true)}
                    onBlur={() => setTimeout(() => setAberto(false), 150)}
                    placeholder="Agendado: CPF, nome ou empresa..."
                    className="h-11 font-bold"
                />
                {lista === null ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Search className="h-4 w-4 text-slate-400" />}
            </div>

            {aberto && termo.trim().length >= 3 && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    {resultados.length === 0 ? (
                        <p className="p-3 text-xs text-slate-500">Nenhum agendado hoje com esse CPF, nome ou empresa.</p>
                    ) : (
                        resultados.map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onSelecionar(a)
                                    setTermo("")
                                    setAberto(false)
                                }}
                                className="flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-500/10"
                            >
                                <span className="w-12 shrink-0 font-black tabular-nums text-blue-600">{formatarHorario(a.horario)}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{a.nome ?? "—"}</span>
                                    <span className="block truncate text-[11px] text-slate-500">
                                        {a.cpf ? mascararCPF(a.cpf) : "sem CPF"} · {a.nome_empresa ?? a.codigo_empresa} · {rotuloTipoCompromisso(a.tipo_compromisso)}
                                    </span>
                                </span>
                                <span className="shrink-0 text-right text-[10px]">
                                    {a.atendimento_id ? (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">já chegou</span>
                                    ) : a.sequencial_ficha ? (
                                        <span className="font-mono text-slate-500">seq. {a.sequencial_ficha}</span>
                                    ) : (
                                        <span className="text-amber-600">sem sequencial</span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
