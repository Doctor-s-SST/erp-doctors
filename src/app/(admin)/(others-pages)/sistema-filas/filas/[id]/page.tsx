"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

// ================= TYPES =================

type ItemFila = {
    id: string
    senha: string
    nome: string
    status: string
    created_at: string
    observacao?: string
    bloqueado?: boolean
}

// ================= HELPERS =================

function formatTempo(data: string) {
    const diff = Math.floor((Date.now() - new Date(data).getTime()) / 1000)

    const min = Math.floor(diff / 60)
    const h = Math.floor(min / 60)

    if (h > 0) return `${h}h ${min % 60}m`
    return `${min}m`
}

function StatusBadge({ status, bloqueado }: any) {
    if (bloqueado) {
        return <Badge variant="destructive">Bloqueado</Badge>
    }

    if (status === "EM_ATENDIMENTO") {
        return <Badge className="bg-blue-500 text-white">Em atendimento</Badge>
    }

    if (status === "FINALIZADO") {
        return <Badge variant="secondary">Finalizado</Badge>
    }

    return <Badge variant="outline">Aguardando</Badge>
}

// ================= PAGE =================

export default function FilaPage() {
    const { id } = useParams()

    const [fila, setFila] = useState<ItemFila[]>([])
    const [loading, setLoading] = useState(true)

    const [openModal, setOpenModal] = useState(false)
    const [session, setSession] = useState<any>(null)

    // ================= SESSION =================

    useEffect(() => {
        const saved = localStorage.getItem("fila_session")

        if (!saved) {
            setOpenModal(true)
            return
        }

        setSession(JSON.parse(saved))
    }, [])

    function salvarSessao() {
        if (!session?.sala || !session?.profissional) {
            return toast.warning("Preencha tudo")
        }

        localStorage.setItem("fila_session", JSON.stringify(session))
        setOpenModal(false)
        toast.success("Atualizado")
    }

    // ================= FETCH =================

    async function fetchFila() {
        const { data, error } = await supabase.rpc("get_fila_especialidade", {
            especialidade_id: id,
        })

        if (error) {
            toast.error("Erro ao carregar fila")
            return
        }

        setFila(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchFila()

        const channel = supabase
            .channel("fila-realtime")
            .on(
                "postgres_changes",
                {
                    event: "*", // INSERT, UPDATE, DELETE
                    schema: "public",
                    table: "atendimento_exames",
                },
                () => {
                    fetchFila()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // ================= ACTIONS =================

    async function chamar(item: ItemFila) {
        await supabase.rpc("chamar_paciente", {
            atendimento_exame_id: item.id,
            sala: session.sala,
            profissional: session.profissional,
        })

        toast.success("Chamando paciente")
        fetchFila()
    }

    async function finalizar(item: ItemFila) {
        await supabase.rpc("finalizar_atendimento", {
            atendimento_exame_id: item.id,
        })

        toast.success("Finalizado")
        fetchFila()
    }

    async function cancelar(item: ItemFila) {
        await supabase
            .from("atendimento_exames")
            .update({ status: "CANCELADO" })
            .eq("id", item.id)

        toast.success("Cancelado")
        fetchFila()
    }

    if (loading) {
        return <div className="p-6">Carregando...</div>
    }

    return (
        <>
            {/* HEADER */}
            <div className="p-6">
                <Card>
                    <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-4">
                        <div>
                            <h1 className="text-xl font-bold">
                                Fila por Especialidade
                            </h1>

                            <p className="text-sm text-gray-500">
                                Atendimento em tempo real
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-sm">
                                <div><b>Sala:</b> {session?.sala}</div>
                                <div><b>Profissional:</b> {session?.profissional}</div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => setOpenModal(true)}
                            >
                                Alterar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* TABELA */}
            <div className="px-6 pb-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th className="p-3 text-left">Senha</th>
                                <th className="p-3 text-left">Nome</th>
                                <th className="p-3 text-left">Tempo</th>
                                <th className="p-3 text-left">Status</th>
                                <th className="p-3 text-left">Observação</th>
                                <th className="p-3 text-left">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {fila.map((item) => (
                                <tr key={item.id} className="border-t">
                                    <td className="p-3 font-bold">
                                        {item.senha}
                                    </td>

                                    <td className="p-3">
                                        {item.nome}
                                    </td>

                                    <td className="p-3">
                                        {formatTempo(item.created_at)}
                                    </td>

                                    <td className="p-3">
                                        <StatusBadge
                                            status={item.status}
                                            bloqueado={item.bloqueado}
                                        />
                                    </td>

                                    <td className="p-3 text-gray-500">
                                        {item.observacao || "-"}
                                    </td>

                                    <td className="p-3 flex gap-2">
                                        {!item.bloqueado && (
                                            <Button size="sm" onClick={() => chamar(item)}>
                                                Chamar
                                            </Button>
                                        )}

                                        {item.status === "EM_ATENDIMENTO" && (
                                            <Button size="sm" variant="secondary" onClick={() => finalizar(item)}>
                                                Finalizar
                                            </Button>
                                        )}

                                        <Button size="sm" variant="destructive" onClick={() => cancelar(item)}>
                                            Cancelar
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL IDENTIFICAÇÃO */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Identificação da Sala
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-3">
                        <Input
                            placeholder="Sala"
                            value={session?.sala || ""}
                            onChange={(e) =>
                                setSession({ ...session, sala: e.target.value })
                            }
                        />

                        <Input
                            placeholder="Profissional"
                            value={session?.profissional || ""}
                            onChange={(e) =>
                                setSession({ ...session, profissional: e.target.value })
                            }
                        />

                        <Button onClick={salvarSessao}>
                            Salvar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}