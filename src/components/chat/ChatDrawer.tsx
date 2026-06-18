"use client"

import ChatInput from "./ChatInput"
import ChatMessages from "./ChatMessages"

interface Props {
    open: boolean
    onClose: () => void

    mensagens: any[]

    usuarioId?: string

    onSend: (msg: string) => Promise<void>
}

export default function ChatDrawer({
    open,
    onClose,
    mensagens,
    usuarioId,
    onSend
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
                    w-[400px]
                    bg-white
                    dark:bg-black
                    shadow-2xl
                    z-[999]

                    transition-transform

                    ${
                        open
                            ? "translate-x-0"
                            : "translate-x-full"
                    }
                `}
            >
                <div
                    className="
                        h-14
                        border-b
                        flex
                        items-center
                        justify-between
                        px-4
                    "
                >
                    <h2 className="font-bold">
                        Chat da Unidade
                    </h2>

                    <button onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="flex flex-col h-[calc(100vh-56px)]">
                    <ChatMessages
                        mensagens={mensagens}
                        meuUsuarioId={usuarioId}
                    />

                    <ChatInput
                        onSend={onSend}
                    />
                </div>
            </div>
        </>
    )
}