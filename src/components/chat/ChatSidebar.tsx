"use client"

import { MessageSquare, Building2, Stethoscope } from "lucide-react"

interface Sala {
    ultimoUsuarioId: any
    usuarioNome: any
    id: string
    nome: string
    ultimaMensagem?: string
    naoLida?: boolean
}

interface Props {
    salaSelecionada: string
    onSelect: (id: string) => void
    salas: Sala[]
    usuarioId: string
}
export default function ChatSidebar({
    salaSelecionada,
    onSelect,
    salas,
    usuarioId
}: Props) {

    return (
        <div className="w-[280px] border-r-1 border-gray-400 bg-white dark:bg-black">


            <div className="overflow-y-auto">
                {salas.map((sala) => (
                    <button
                        key={sala.id}
                        onClick={() => onSelect(sala.id)}
                        className={`
                            w-full
                            px-4
                            py-3
                            flex
                            gap-3
                            text-left
                            hover:bg-gray-100
                            dark:hover:bg-gray-800

                            ${salaSelecionada === sala.id
                                ? `
                                    bg-emerald-100
                                    dark:bg-emerald-900/30
                                    border-l-4
                                    border-emerald-600
                                `
                                : ""
                            }
                        `}
                    >
                        <div
                            className="
                                h-10
                                w-10
                                rounded-full
                                bg-emerald-600
                                text-white
                                flex
                                items-center
                                justify-center
                                shrink-0
                            "
                        >
                            {sala.id === "geral"
                                ? <Building2 size={18} />
                                : <Stethoscope size={18} />
                            }
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <div className={`font-semibold text-sm truncate ${sala.naoLida ? "flex flex-row gap-2 items-center" : ""
                                }`}>
                                {sala.nome}

                                {sala.naoLida && (
                                    <div
                                        className="
                                        w-2.5 h-2.5
                                        rounded-full
                                        bg-emerald-600
                                    "
                                    />
                                )}
                            </div>

                            <div
                                className={`
                                    text-xs
                                    truncate
                                    ${sala.naoLida ? "font-bold text-black dark:text-white" : "text-slate-500 dark:text-200"}
                                `}
                            >
                                {sala.ultimaMensagem
                                    ? sala.ultimoUsuarioId === usuarioId
                                        ? `Você: ${sala.ultimaMensagem}`
                                        : `${sala.usuarioNome}: ${sala.ultimaMensagem}`
                                    : "Nenhuma mensagem"
                                }
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}