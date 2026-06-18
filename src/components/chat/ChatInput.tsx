"use client"

import { Send } from "lucide-react"
import { useState } from "react"

interface Props {
    onSend: (text: string) => Promise<void>
}

export default function ChatInput({ onSend }: Props) {
    const [message, setMessage] = useState("")

    async function handleSend() {
        const text = message.trim()

        if (!text) return

        await onSend(text)

        setMessage("")
    }

    return (
        <div className="border-t p-3 flex gap-2">
            <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        handleSend()
                    }
                }}
                placeholder="Digite uma mensagem..."
                className="
                    flex-1
                    border
                    rounded-lg
                    px-3
                    py-2
                    text-sm
                "
            />

            <button
                onClick={handleSend}
                className="
                    h-10
                    w-10
                    rounded-lg
                    bg-emerald-600
                    text-white
                    flex
                    items-center
                    justify-center
                "
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
    )
}