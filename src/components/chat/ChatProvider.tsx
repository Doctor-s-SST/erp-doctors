"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { carregarSessaoFila } from "@/lib/fila-session"

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
    const [salas, setSalas] = useState<{ id: string; nome: string }[]>([])
    const [salaSelecionada, setSalaSelecionada] = useState("")

    const [profissionalAtivo, setProfissionalAtivo] =
        useState({ nome: "", sala: "" })

    const [unread, setUnread] = useState(0)


    const ultimaMensagem =
        mensagens[mensagens.length - 1]


    async function carregarNotificacoes() {

        if (!usuarioId) return

        let totalNaoLidas = 0

        for (const sala of salas) {


            const salaId =
                sala.id === "geral"
                    ? null
                    : sala.id

            let leituraQuery =
                supabase
                    .from("chat_ultima_leitura")
                    .select("ultima_mensagem_lida")
                    .eq("usuario_id", usuarioId)

            if (salaId) {

                leituraQuery =
                    leituraQuery.eq(
                        "sala_id",
                        salaId
                    )

            } else {

                leituraQuery =
                    leituraQuery.is(
                        "sala_id",
                        null
                    )

            }

            const { data: leitura } =
                await leituraQuery.maybeSingle()

            let query =
                supabase
                    .from("chat_mensagens")
                    .select("*", {
                        count: "exact",
                        head: true
                    })
                    .neq(
                        "usuario_id",
                        usuarioId
                    )

            if (salaId) {

                query =
                    query.eq(
                        "sala_id",
                        salaId
                    )

            } else {

                query =
                    query.is(
                        "sala_id",
                        null
                    )
                        .eq(
                            "unidade_id",
                            unidadeId
                        )

            }

            if (
                leitura?.ultima_mensagem_lida
            ) {

                query =
                    query.gt(
                        "created_at",
                        leitura.ultima_mensagem_lida
                    )

            }

            const { count } =
                await query

            totalNaoLidas += count || 0
        }

        setUnread(totalNaoLidas)
    }

    async function carregarMensagens() {
        if (!unidadeId) return

        let query = supabase
            .from("chat_mensagens")
            .select("*")
            .order("created_at", {
                ascending: true
            })

        if (salaSelecionada === "geral") {

            query = query
                .eq("unidade_id", unidadeId)
                .is("sala_id", null)

        } else {

            query = query
                .eq("sala_id", salaSelecionada)

        }

        const { data } = await query

        setMensagens(data || [])

        let leituraQuery =
            supabase
                .from("chat_ultima_leitura")
                .select("ultima_mensagem_lida")
                .eq("usuario_id", usuarioId)

        const salaId =
            salaSelecionada === "geral"
                ? null
                : salaSelecionada

        if (salaId) {

            leituraQuery =
                leituraQuery.eq(
                    "sala_id",
                    salaId
                )

        } else {

            leituraQuery =
                leituraQuery.is(
                    "sala_id",
                    null
                )

        }

        const { data: leituraData } =
            await leituraQuery.maybeSingle()

        setUltimaLeitura(
            leituraData?.ultima_mensagem_lida ?? null
        )

    }

    async function enviarMensagem(texto: string) {
        await supabase
            .from("chat_mensagens")
            .insert({
                unidade_id: unidadeId,

                sala_id:
                    salaSelecionada === "geral"
                        ? null
                        : salaSelecionada,

                usuario_id: usuarioId,
                usuario_nome:
                    profissionalAtivo.nome
                        ? `${profissionalAtivo.nome} (${profissionalAtivo.sala ? `Sala ${profissionalAtivo.sala}` : usuarioNome})`
                        : usuarioNome,
                mensagem: texto
            })

        await carregarMensagens()

        if (open) {
            await marcarComoLido()
        }
    }

    async function carregarSalas(userId: string) {

        const salas = [
            {
                id: "geral",
                nome: "Geral"
            }
        ]

        const dados = carregarSessaoFila(userId)

        if (dados) {

            if (dados.especialidade_id) {

                const { data } = await supabase
                    .from("especialidades")
                    .select("nome")
                    .eq("id", dados.especialidade_id)
                    .maybeSingle()

                salas.push({
                    id: dados.especialidade_id,
                    nome: data?.nome || "Especialidade"
                })
            }
        }

        setSalas(salas)
        await carregarUltimasMensagens(salas)
        setSalaSelecionada("geral")
    }

    async function carregarUltimasMensagens(salasBase: any[]) {

        const salasComMensagem = await Promise.all(

            salasBase.map(async sala => {

                let query = supabase
                    .from("chat_mensagens")
                    .select(`
                        mensagem,
                        usuario_id,
                        created_at,
                        usuario_nome
                    `)
                    .order("created_at", {
                        ascending: false
                    })
                    .limit(1)

                if (sala.id === "geral") {

                    query = query
                        .eq("unidade_id", unidadeId)
                        .is("sala_id", null)

                } else {

                    query = query.eq("sala_id", sala.id)

                }

                const { data } = await query

                const salaId =
                    sala.id === "geral"
                        ? null
                        : sala.id

                const ultimaLeituraAtual =
                    await obterUltimaLeitura(salaId)

                return {
                    ...sala,

                    ultimaMensagem: data?.[0]?.mensagem,
                    usuarioNome: data?.[0]?.usuario_nome,
                    ultimoUsuarioId: data?.[0]?.usuario_id,
                    naoLida:
                        data?.[0]?.usuario_id !== usuarioId &&
                        (
                            !ultimaLeituraAtual ||
                            new Date(data?.[0]?.created_at) >
                            new Date(ultimaLeituraAtual)
                        )
                }

            })
        )

        setSalas(salasComMensagem)
    }

    async function obterUltimaLeitura(salaId: string | null) {

        let query =
            supabase
                .from("chat_ultima_leitura")
                .select("ultima_mensagem_lida")
                .eq("usuario_id", usuarioId)

        if (salaId) {

            query =
                query.eq("sala_id", salaId)

        } else {

            query =
                query.is("sala_id", null)

        }

        const { data } =
            await query.maybeSingle()

        return data?.ultima_mensagem_lida ?? null
    }

    function carregarProfissionalAtivo(userId: string) {

        const dados = carregarSessaoFila(userId)

        if (!dados) {
            setProfissionalAtivo({ nome: "", sala: "" })
            return
        }

        setProfissionalAtivo(
            {
                nome: dados.profissional || "",
                sala: dados.sala || ""
            }
        )
    }

    async function marcarComoLido() {

        const agora = new Date().toISOString()

        const salaId =
            salaSelecionada === "geral"
                ? null
                : salaSelecionada

        if (salaId === null) {

            const { data } = await supabase
                .from("chat_ultima_leitura")
                .select("id")
                .eq("usuario_id", usuarioId)
                .is("sala_id", null)
                .maybeSingle()

            if (data) {

                await supabase
                    .from("chat_ultima_leitura")
                    .update({
                        ultima_mensagem_lida: agora
                    })
                    .eq("usuario_id", usuarioId)
                    .is("sala_id", null)

            } else {

                await supabase
                    .from("chat_ultima_leitura")
                    .insert({
                        usuario_id: usuarioId,
                        sala_id: null,
                        ultima_mensagem_lida: agora
                    })

            }

        } else {

            await supabase
                .from("chat_ultima_leitura")
                .upsert(
                    {
                        usuario_id: usuarioId,
                        sala_id: salaId,
                        ultima_mensagem_lida: agora
                    },
                    {
                        onConflict: "usuario_id,sala_id"
                    }
                )

        }

        await Promise.all([
            carregarUltimasMensagens(salas),
            carregarNotificacoes()
        ])
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
                    .maybeSingle()

            if (!profile) return

            setUsuarioId(user.id)
            setUsuarioNome(profile.first_name)
            setUnidadeId(profile.unidade_id)
            await carregarSalas(user.id)
            carregarProfissionalAtivo(user.id)
        }

        init()
    }, [])

    useEffect(() => {

        if (!unidadeId) return

        const evt = new EventSource(
            `https://doctors-distribuidor-sse.cgalnz.easypanel.host/stream-chat?unidadeId=${unidadeId}`
        )

        evt.onmessage = async (e) => {

            const payload = JSON.parse(e.data)

            const salaPayload =
                payload.sala_id ?? null

            const salaAtual =
                salaSelecionada === "geral"
                    ? null
                    : salaSelecionada

            const mesmaSala =
                salaPayload === salaAtual

            if (mesmaSala) {

                setMensagens(prev => {

                    const existe = prev.some(
                        m => m.id === payload.id
                    )

                    if (existe) return prev

                    return [...prev, payload]
                })

            }

            await carregarNotificacoes()

            await Promise.all([
                carregarUltimasMensagens(salas),
                carregarNotificacoes()
            ])

        }

        return () => evt.close()

    }, [unidadeId, usuarioId, salaSelecionada])

    useEffect(() => {

        if (!salas.length) return

        carregarUltimasMensagens(salas)

    }, [mensagens])

    useEffect(() => {
        if (open) {
            marcarComoLido()
        }
    }, [open])

    useEffect(() => {

        if (!open) return

        marcarComoLido()

    }, [salaSelecionada])

    useEffect(() => {

        const atualizarSalas = async () => {

            await carregarSalas(usuarioId)

            carregarProfissionalAtivo(usuarioId)

            setMensagens([])
        }

        window.addEventListener(
            "fila-changed",
            atualizarSalas
        )

        return () => {
            window.removeEventListener(
                "fila-changed",
                atualizarSalas
            )
        }

    }, [usuarioId])

    useEffect(() => {

        if (!unidadeId || !salaSelecionada) return

        carregarMensagens()

    }, [unidadeId, salaSelecionada])

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
                salas={salas}
                salaSelecionada={salaSelecionada}
                onSalaChange={setSalaSelecionada}
            />
        </>
    )
}
