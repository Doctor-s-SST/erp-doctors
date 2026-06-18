"use client"

import { MessageCircle } from "lucide-react"

interface Props {
    onClick: () => void
    unread?: number
}

export default function ChatButton({
    onClick,
    unread = 0
}: Props) {
    return (
        <button
            onClick={onClick}
            className="
                fixed
                bottom-5
                right-5
                z-[999]
                h-14
                w-14
                rounded-full
                bg-emerald-600
                text-white
                shadow-xl
                hover:bg-emerald-700
                transition
            "
        >
            <MessageCircle className="w-6 h-6 mx-auto" />

            {unread > 0 && (
                <span
                    className="
                        absolute
                        -top-1
                        -right-1
                        bg-red-500
                        text-white
                        text-[10px]
                        rounded-full
                        min-w-5
                        h-5
                        flex
                        items-center
                        justify-center
                        px-1
                        animate-pulse
                    "
                >
                    {unread}
                </span>
            )}
        </button>
    )
}