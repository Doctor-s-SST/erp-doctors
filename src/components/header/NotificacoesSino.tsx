"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Bell, CheckCheck, Clock, Hourglass, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { Dropdown } from "@/components/ui/dropdown/Dropdown"
import { cn } from "@/lib/utils"
import {
    gerarAlertasTempo,
    listarNotificacoes,
    marcarComoLidas,
    type Notificacao,
} from "@/lib/notificacoes"

const INTERVALO_MS = 60_000
const DURACAO_AVISO_MS = 20_000

/** Tela onde o atendimento é aberto ao clicar na notificação. */
const ROTA_ATENDIMENTO = "/sistema-filas/senhas-recepcao"

/** "agora", "há 5 min", "há 2 h", "há 3 dias". */
function tempoDecorrido(data: string): string {
    const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60_000))
    if (minutos < 1) return "agora"
    if (minutos < 60) return `há ${minutos} min`
    const horas = Math.floor(minutos / 60)
    if (horas < 24) return `há ${horas} h`
    const dias = Math.floor(horas / 24)
    return `há ${dias} ${dias === 1 ? "dia" : "dias"}`
}

interface EstiloTipo {
    icone: typeof Bell
    rotulo: string
    /** Faixa lateral e ícone do aviso. */
    faixa: string
    iconeFundo: string
}

const ESTILO_TIPO: Record<string, EstiloTipo> = {
    PACIENTE_PARADO: {
        icone: Clock,
        rotulo: "Paciente parado",
        faixa: "bg-amber-500",
        iconeFundo: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    },
    ATENDIMENTO_PROLONGADO: {
        icone: Hourglass,
        rotulo: "Atendimento prolongado",
        faixa: "bg-red-500",
        iconeFundo: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    },
    RECEPCAO_PROLONGADA: {
        icone: UserRound,
        rotulo: "Recepção prolongada",
        faixa: "bg-orange-500",
        iconeFundo: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
    },
}

const ESTILO_PADRAO: EstiloTipo = {
    icone: Bell,
    rotulo: "Notificação",
    faixa: "bg-blue-500",
    iconeFundo: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
}

function estiloDo(tipo: string): EstiloTipo {
    return ESTILO_TIPO[tipo] ?? ESTILO_PADRAO
}

/** Aviso que aparece no canto da tela quando surge uma notificação nova. */
function AvisoNotificacao({
    notificacao,
    onAbrir,
    onFechar,
}: {
    notificacao: Notificacao
    onAbrir: () => void
    onFechar: () => void
}) {
    const estilo = estiloDo(notificacao.tipo)
    const Icone = estilo.icone

    return (
        <div
            role="alert"
            className="relative flex w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
        >
            <span className={cn("w-1.5 shrink-0", estilo.faixa)} aria-hidden />

            <div className="flex min-w-0 flex-1 gap-3 p-3.5">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", estilo.iconeFundo)}>
                    <Icone className="h-4.5 w-4.5" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{estilo.rotulo}</p>
                    <p className="text-sm font-bold leading-snug text-gray-900 dark:text-white">{notificacao.titulo}</p>
                    {notificacao.mensagem && (
                        <p className="mt-1 text-xs leading-snug text-gray-600 dark:text-gray-300">{notificacao.mensagem}</p>
                    )}

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400">{tempoDecorrido(notificacao.created_at)}</span>
                        {notificacao.atendimento_id && (
                            <button
                                type="button"
                                onClick={onAbrir}
                                className="flex items-center gap-1 rounded-md bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                            >
                                Ver atendimento
                                <ArrowRight className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onFechar}
                    aria-label="Fechar aviso"
                    className="-mr-1 -mt-1 h-6 w-6 shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

interface Props {
    usuarioId: string
    unidadeId: string
    /** Admin também gera os alertas de tempo; os demais só leem. */
    geraAlertas: boolean
}

/**
 * Sino de notificações do cabeçalho. A cada minuto gera os alertas de tempo
 * (admin) e lê as notificações da unidade. Notificação nova aparece como aviso
 * no canto da tela, em qualquer página, e fica guardada no sino até ser lida.
 * Clicar no aviso ou no item do sino abre o atendimento na Chamada de Senhas.
 */
export function NotificacoesSino({ usuarioId, unidadeId, geraAlertas }: Props) {
    const router = useRouter()
    const [aberto, setAberto] = useState(false)
    const [itens, setItens] = useState<Notificacao[]>([])
    const conhecidas = useRef<Set<string> | null>(null)
    const funcaoDisponivel = useRef(true)

    const marcar = useCallback(
        async (ids: string[]) => {
            setItens((atual) => atual.map((n) => (ids.includes(n.id) ? { ...n, lida: true } : n)))
            await marcarComoLidas(usuarioId, ids)
        },
        [usuarioId]
    )

    /** Marca como lida e, se houver atendimento, abre na Chamada de Senhas. */
    const abrir = useCallback(
        (n: Notificacao) => {
            setAberto(false)
            if (!n.lida) void marcar([n.id])
            if (n.atendimento_id) {
                router.push(`${ROTA_ATENDIMENTO}?atendimento=${encodeURIComponent(n.atendimento_id)}`)
            }
        },
        [marcar, router]
    )

    const atualizar = useCallback(async () => {
        if (geraAlertas && funcaoDisponivel.current) {
            funcaoDisponivel.current = await gerarAlertasTempo(unidadeId)
        }

        const lista = await listarNotificacoes(usuarioId)
        if (!lista) return

        // Na primeira carga só registra o que já existe; depois, avisa as novas.
        if (conhecidas.current) {
            const novas = lista.filter((n) => !n.lida && !conhecidas.current!.has(n.id))
            for (const n of novas.slice(0, 5).reverse()) {
                toast.custom(
                    (id) => (
                        <AvisoNotificacao
                            notificacao={n}
                            onAbrir={() => {
                                toast.dismiss(id)
                                abrir(n)
                            }}
                            onFechar={() => toast.dismiss(id)}
                        />
                    ),
                    { id: `notificacao-${n.id}`, duration: DURACAO_AVISO_MS }
                )
            }
        }
        conhecidas.current = new Set(lista.map((n) => n.id))
        setItens(lista)
    }, [abrir, geraAlertas, unidadeId, usuarioId])

    useEffect(() => {
        if (!usuarioId || !unidadeId) return
        queueMicrotask(() => void atualizar())
        const timer = setInterval(() => void atualizar(), INTERVALO_MS)
        return () => clearInterval(timer)
    }, [atualizar, usuarioId, unidadeId])

    const naoLidas = itens.filter((n) => !n.lida)

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-label={naoLidas.length ? `Notificações: ${naoLidas.length} não lidas` : "Notificações"}
                className="dropdown-toggle relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
                <Bell className="h-4.5 w-4.5" />
                {naoLidas.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {naoLidas.length > 9 ? "9+" : naoLidas.length}
                    </span>
                )}
            </button>

            <Dropdown
                isOpen={aberto}
                onClose={() => setAberto(false)}
                className="flex max-h-[480px] w-[380px] max-w-[calc(100vw-2rem)] flex-col p-3"
            >
                <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
                    <h5 className="text-sm font-black uppercase tracking-wide text-gray-800 dark:text-gray-100">
                        Notificações
                    </h5>
                    {naoLidas.length > 0 && (
                        <button
                            type="button"
                            onClick={() => void marcar(naoLidas.map((n) => n.id))}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Marcar todas como lidas
                        </button>
                    )}
                </div>

                {itens.length === 0 ? (
                    <p className="py-10 text-center text-xs text-gray-500">Nenhuma notificação.</p>
                ) : (
                    <ul className="custom-scrollbar flex flex-col gap-1 overflow-y-auto">
                        {itens.map((n) => {
                            const estilo = estiloDo(n.tipo)
                            const Icone = estilo.icone
                            return (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrir(n)}
                                        title={n.atendimento_id ? "Abrir o atendimento na Chamada de Senhas" : undefined}
                                        className={cn(
                                            "group relative flex w-full gap-3 overflow-hidden rounded-lg p-3 pl-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/5",
                                            !n.lida && "bg-gray-50 dark:bg-white/[0.03]"
                                        )}
                                    >
                                        {!n.lida && <span className={cn("absolute inset-y-0 left-0 w-1", estilo.faixa)} aria-hidden />}
                                        <span
                                            className={cn(
                                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                                n.lida ? "bg-gray-100 text-gray-400 dark:bg-gray-800" : estilo.iconeFundo
                                            )}
                                        >
                                            <Icone className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className={cn("truncate text-xs text-gray-800 dark:text-gray-100", n.lida ? "font-medium" : "font-bold")}>
                                                    {n.titulo}
                                                </span>
                                                {!n.lida && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="Não lida" />}
                                            </span>
                                            {n.mensagem && (
                                                <span className="mt-0.5 block text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                                                    {n.mensagem}
                                                </span>
                                            )}
                                            <span className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                                                <span>{tempoDecorrido(n.created_at)}</span>
                                                {n.atendimento_id && (
                                                    <span className="flex items-center gap-0.5 font-bold text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-300">
                                                        Ver atendimento
                                                        <ArrowRight className="h-3 w-3" />
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </Dropdown>
        </div>
    )
}
