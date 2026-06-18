import { CheckCheck } from "lucide-react"
import { useEffect, useRef } from "react"

interface Mensagem {
    id: string
    mensagem: string
    created_at: string
    usuario_nome: string
    usuario_id: string
}

interface Props {
    mensagens: Mensagem[]
    meuUsuarioId?: string
}

export default function ChatMessages({
    mensagens,
    meuUsuarioId
}: Props) {

    const bottomRef = useRef<HTMLDivElement | null>(null)

    const ultimoId = useRef<string | null>(null)

    useEffect(() => {
        const ultimaMensagem =
            mensagens[mensagens.length - 1]

        if (!ultimaMensagem) return

        if (
            ultimoId.current &&
            ultimoId.current !== ultimaMensagem.id
        ) {
            bottomRef.current?.scrollIntoView({
                behavior: "smooth"
            })
        }

        ultimoId.current = ultimaMensagem.id
    }, [mensagens])

    const formatarHora = (data: string) =>
        new Date(data).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        })

    const formatarData = (data: string) => {
        const hoje = new Date()
        const msgDate = new Date(data)

        const hojeStr = hoje.toDateString()
        const msgStr = msgDate.toDateString()

        if (msgStr === hojeStr) {
            return "Hoje"
        }

        const ontem = new Date()
        ontem.setDate(hoje.getDate() - 1)

        if (msgStr === ontem.toDateString()) {
            return "Ontem"
        }

        return msgDate.toLocaleDateString("pt-BR")
    }

    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {mensagens.map((msg, index) => {

                const minhaMensagem =
                    msg.usuario_id === meuUsuarioId

                const dataAtual = formatarData(
                    msg.created_at
                )

                const mensagemAnterior =
                    mensagens[index - 1]

                const mesmoUsuario =
                    mensagemAnterior?.usuario_id ===
                    msg.usuario_id

                const dataAnterior =
                    index > 0
                        ? formatarData(
                            mensagens[index - 1].created_at
                        )
                        : null

                const mostrarData =
                    dataAtual !== dataAnterior

                return (
                    <div key={msg.id}>
                        {mostrarData && (
                            <div className="flex justify-center my-3">
                                <span
                                    className="
                                        bg-gray-200
                                        dark:bg-gray-700
                                        text-gray-600
                                        dark:text-gray-300
                                        text-[11px]
                                        px-3
                                        py-1
                                        rounded-full
                                    "
                                >
                                    {dataAtual}
                                </span>
                            </div>
                        )}

                        <div
                            className={`
                                flex
                                ${minhaMensagem
                                    ? "justify-end"
                                    : "justify-start"
                                }
                            `}
                        >
                            <div
                                className={`
                                    max-w-[80%]
                                    rounded-2xl
                                    px-3
                                    py-2
                                    shadow-sm
                                    ${mesmoUsuario ? "" : "mt-1"}
                                    ${minhaMensagem
                                        ? "bg-emerald-600 text-white"
                                        : "bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-white"
                                    }
                                `}
                            >
                                {!minhaMensagem && !mesmoUsuario && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <div
                                            className="
                                                w-5 h-5
                                                rounded-full
                                                bg-emerald-600
                                                text-white
                                                text-[9px]
                                                font-bold
                                                flex
                                                items-center
                                                justify-center
                                            "
                                        >
                                            {msg.usuario_nome
                                                ?.split(" ")
                                                .map(n => n[0])
                                                .slice(0, 2)
                                                .join("")}
                                        </div>

                                        <span className="text-[11px] font-bold">
                                            {msg.usuario_nome}
                                        </span>
                                    </div>
                                )}

                                <div className="break-words">
                                    {msg.mensagem}
                                </div>

                                <div
                                    className={`
                                        text-[10px]
                                        mt-1
                                        text-right

                                        ${minhaMensagem
                                            ? "text-emerald-100"
                                            : "text-gray-500"
                                        }
                                    `}
                                >
                                    <div className="flex justify-end gap-1 items-center">
                                        <span className={`text-gray-900 dark:text-white ${minhaMensagem ? "text-white": ""}`}>{formatarHora(msg.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

            <div ref={bottomRef} />
        </div>
    )
}