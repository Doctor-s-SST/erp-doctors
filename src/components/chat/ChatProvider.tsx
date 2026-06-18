"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

import ChatButton from "./ChatButton"
import ChatDrawer from "./ChatDrawer"

interface ChatMensagem {
    id?: string
    unidade_id?: string
    usuario_id?: string
    usuario_nome?: string
    mensagem?: string
    created_at?: string
}

export default function ChatProvider() {
    const [open, setOpen] = useState(false)
    const [mensagens, setMensagens] = useState<ChatMensagem[]>([])

    const [usuarioId, setUsuarioId] = useState("")
    const [usuarioNome, setUsuarioNome] = useState("")
    const [unidadeId, setUnidadeId] = useState("")
    const [ultimaLeitura, setUltimaLeitura] =
        useState<string | null>(null)

    const unread = open
        ? 0
        : mensagens.filter(m => {
            if (!ultimaLeitura) return true

            return (
                new Date(m.created_at!) >
                new Date(ultimaLeitura)
            )
        }).length

    const ultimaMensagem =
        mensagens[mensagens.length - 1]

    async function carregarMensagens() {
        if (!unidadeId) return

        const { data: mensagensData } = await supabase
            .from("chat_mensagens")
            .select("*")
            .eq("unidade_id", unidadeId)
            .order("created_at", {
                ascending: true
            })

        setMensagens(mensagensData || [])

        const { data: leituraData } = await supabase
            .from("chat_ultima_leitura")
            .select("ultima_mensagem_lida")
            .eq("usuario_id", usuarioId)
            .single()

        setUltimaLeitura(
            leituraData?.ultima_mensagem_lida ?? null
        )

    }

    async function enviarMensagem(texto: string) {
        await supabase
            .from("chat_mensagens")
            .insert({
                unidade_id: unidadeId,
                usuario_id: usuarioId,
                usuario_nome: usuarioNome,
                mensagem: texto
            })

        await carregarMensagens()

        if (open) {
            await marcarComoLido()
        }
    }

    useEffect(() => {
        async function init() {
            const {
                data: { user }
            } = await supabase.auth.getUser()

            if (!user) return

            const { data: profile } =
                await supabase
                    .from("profiles")
                    .select(`
                        *
                    `)
                    .eq("id", user.id)
                    .single()

            if (!profile) return

            setUsuarioId(user.id)
            setUsuarioNome(profile.first_name)
            setUnidadeId(profile.unidade_id)
        }

        init()
    }, [])

    useEffect(() => {
        carregarMensagens()

        const interval = setInterval(
            carregarMensagens,
            3000
        )

        return () =>
            clearInterval(interval)

    }, [unidadeId, usuarioId])

    useEffect(() => {
        if (!open || !ultimaMensagem) return

        marcarComoLido()
    }, [ultimaMensagem?.id, open])

    useEffect(() => {
        if (open) {
            marcarComoLido()
        }
    }, [open])

    async function marcarComoLido() {
        const agora = new Date().toISOString()

        setUltimaLeitura(agora)

        await supabase
            .from("chat_ultima_leitura")
            .upsert({
                usuario_id: usuarioId,
                ultima_mensagem_lida: agora
            })
    }

    return (
        <>
            <ChatButton
                onClick={() => setOpen(true)}
                unread={unread}
            />

            <ChatDrawer
                open={open}
                onClose={() => setOpen(false)}
                mensagens={mensagens}
                usuarioId={usuarioId}
                onSend={enviarMensagem}
            />
        </>
    )
}