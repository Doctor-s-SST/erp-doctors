"use client"

import { MessagesSquare, X } from "lucide-react"
import ChatInput from "./ChatInput"
import ChatMessages from "./ChatMessages"
import ChatSidebar from "./ChatSidebar"

interface Props {
    open: boolean
    onClose: () => void

    mensagens: any[]

    usuarioId?: string

    onSend: (msg: string) => Promise<void>

    salas: any[]
    salaSelecionada: string
    onSalaChange: (id: string) => void
}

export default function ChatDrawer({
    open,
    onClose,
    mensagens,
    usuarioId,
    onSend,

    salas,
    salaSelecionada,
    onSalaChange
}: Props) {
    return (
        <>
            {open && (
                <div
                    className="
                        fixed
                        inset-0
                        bg-black/40
                        z-[998]
                    "
                    onClick={onClose}
                />
            )}

            <div
                className={`
                    fixed
                    right-0
                    top-0
                    h-screen
                    w-[80vw]
                    max-w-[950px]
                    bg-white
                    dark:bg-black
                    shadow-2xl
                    z-[999]

                    transition-transform

                    ${open
                        ? "translate-x-0"
                        : "translate-x-full"
                    }
                `}
            >
                <div
                    className="
                        h-14
                        border-b
                        border-gray-400
                        flex
                        items-center
                        justify-between
                        px-4
                    "
                >
                    <h2 className="font-bold">
                        <span className="flex flex-row gap-2 items-center"><MessagesSquare /> <span>Chat da Unidade</span></span>
                    </h2>

                    <button onClick={onClose}>
                        <X />
                    </button>
                </div>

                <div className="h-[calc(100vh-56px)] flex">

                    <ChatSidebar
                        salas={salas}
                        salaSelecionada={salaSelecionada}
                        onSelect={onSalaChange}
                        usuarioId={usuarioId || ""}
                    />

                    <div className="flex-1 flex flex-col">

                        <ChatMessages
                            mensagens={mensagens}
                            meuUsuarioId={usuarioId}
                        />

                        <ChatInput
                            onSend={onSend}
                        />

                    </div>

                </div>
            </div>
        </>
    )
}