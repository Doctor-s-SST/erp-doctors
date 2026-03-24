"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type Atendimento = {
    id: string
    senha_codigo: string
    tipo_senha: string
    nome: string
    ficha_sequencial: string
    created_at: string
    status: string
    guiche: string
}

export default function RecepcaoPage() {
    const [data, setData] = useState<Atendimento[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingAction, setLoadingAction] = useState<string | null>(null)

    const [session, setSession] = useState<any>(null)
    const [openModal, setOpenModal] = useState(false)

    // ================= TEMPO =================

    const [, forceUpdate] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            forceUpdate((v) => v + 1)
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    function getTempoEspera(date: string) {
    const diff = Math.max(
        0,
        Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    )

    const min = Math.floor(diff / 60)
    const sec = diff % 60

    return `${min}m ${sec}s`
}

    function getHora(date: string) {
        return new Date(date).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
    }

    function getStatusColor(status: string) {
        switch (status) {
            case "AGUARDANDO_RECEPCAO":
                return "bg-yellow-500 text-white"
            case "EM_RECEPCAO":
                return "bg-blue-500 text-white"
            case "AGUARDANDO_EXAMES":
                return "bg-green-600 text-white"
            case "CANCELADO":
                return "bg-red-500 text-white"
            default:
                return ""
        }
    }

    // ================= SESSION =================

    useEffect(() => {
        const saved = localStorage.getItem("recepcao_session")
        if (!saved) return setOpenModal(true)
        setSession(JSON.parse(saved))
    }, [])

    function salvarSessao() {
        if (!session?.guiche || !session?.nome) {
            return toast.warning("Preencha tudo")
        }
        localStorage.setItem("recepcao_session", JSON.stringify(session))
        setOpenModal(false)
    }

    // ================= FETCH =================

    async function fetchData() {
        setLoading(true)
        const { data } = await supabase.rpc("get_painel_recepcao")
        setData(data || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    // ================= AÇÕES =================
    function handlePromise({ promise }: { promise: any }) {
        return promise.then((res: any) => {
            if (res.error) throw res.error
            return res
        })
    }

    async function gerarSenha(tipo: "NORMAL" | "PREFERENCIAL") {
    if (loadingAction) return

    setLoadingAction(tipo)

    const promise = supabase.rpc("gerar_senha", {
        tipo_param: tipo,
    })

    toast.promise(handlePromise({ promise }), {
        loading: "Gerando...",
        success: "Senha gerada",
        error: "Erro",
    })

    await promise
    setLoadingAction(null)
    fetchData()
}

    async function chamar(id: string) {
        setLoadingAction(id)
        await supabase.rpc("chamar_recepcao", {
            atendimento_id: id,
            guiche_param: session.guiche,
            atendente_param: session.nome,
        })
        setLoadingAction(null)
        fetchData()
    }

    async function finalizar(id: string) {
        setLoadingAction(id)
        await supabase.rpc("finalizar_recepcao", { atendimento_id: id })
        setLoadingAction(null)
        fetchData()
    }

    async function cancelar(id: string) {
        setLoadingAction(id)
        await supabase.rpc("cancelar_atendimento", {
            p_atendimento_id: id,
        })
        setLoadingAction(null)
        fetchData()
    }

    async function rechamar(id: string) {
        await supabase.rpc("rechamar_recepcao", {
            atendimento_id: id,
            guiche_param: session.guiche,
        })
    }

    // ================= UI =================

    return (
        <>
            {/* HEADER */}
            <div className="p-6">
                <Card>
                    <CardContent className="p-6 flex justify-between">
                        <div>
                            <h1 className="text-xl font-bold">Recepção</h1>
                            <p className="text-sm text-gray-500">Controle de senhas</p>
                        </div>

                        <div className="text-right">
                            <div className="text-sm">Guichê: {session?.guiche}</div>
                            <div className="text-sm">Atendente: {session?.nome}</div>
                            <Button size="sm" onClick={() => setOpenModal(true)}>
                                Alterar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* AÇÕES */}
            <div className="px-6 flex gap-3">
                <Button
                    disabled={loadingAction === "NORMAL"}
                    onClick={() => gerarSenha("NORMAL")}
                >
                    {loadingAction === "NORMAL" ? "..." : "+ Normal"}
                </Button>

                <Button
                    variant="secondary"
                    disabled={loadingAction === "PREFERENCIAL"}
                    onClick={() => gerarSenha("PREFERENCIAL")}
                >
                    {loadingAction === "PREFERENCIAL" ? "..." : "+ Preferencial"}
                </Button>

                <Button variant="outline" onClick={fetchData}>
                    Atualizar
                </Button>
            </div>

            {/* TABELA */}
            <div className="p-6 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="text-gray-500 border-b">
                        <tr>
                            <th className="text-left p-3">Categoria</th>
                            <th className="text-left p-3">Senha</th>
                            <th className="text-left p-3">Nome</th>
                            <th className="text-left p-3">Ficha</th>
                            <th className="text-left p-3">Chegada</th>
                            <th className="text-left p-3">Tempo de Espera</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Guichê</th>
                            <th className="text-left p-3">Ações</th>
                        </tr>
                    </thead>

                    <tbody>
                        {data.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="p-2">
                                    <Badge variant="outline">{item.tipo_senha}</Badge>
                                </td>

                                <td className="font-bold p-2">{item.senha_codigo}</td>

                                <td className="p-2">{item.nome || "--"}</td>

                                <td className="p-2">{item.ficha_sequencial || "--"}</td>

                                <td className="p-2">{getHora(item.created_at)}</td>

                                <td className="p-2">{getTempoEspera(item.created_at)}</td>

                                <td className="p-2">
                                    <Badge className={getStatusColor(item.status)}>
                                        {item.status}
                                    </Badge>
                                </td>

                                <td className="p-2">{item.guiche || "--"}</td>

                                <td className="flex gap-2 flex-wrap p-2">
                                    {item.status === "AGUARDANDO_RECEPCAO" && (
                                        <>
                                            <Button size="sm" onClick={() => chamar(item.id)}>
                                                Chamar
                                            </Button>

                                            <Button size="sm" variant="destructive" onClick={() => cancelar(item.id)}>
                                                Cancelar
                                            </Button>
                                        </>
                                    )}

                                    {item.status === "EM_ATENDIMENTO" && (
                                        <>
                                            <Button size="sm" variant="secondary" onClick={() => finalizar(item.id)}>
                                                Finalizar
                                            </Button>

                                            <Button size="sm" variant="outline" onClick={() => rechamar(item.id)}>
                                                Rechamar
                                            </Button>

                                            <Button size="sm" variant="destructive" onClick={() => cancelar(item.id)}>
                                                Cancelar
                                            </Button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Identificação</DialogTitle>
                    </DialogHeader>

                    <Input
                        placeholder="Guichê"
                        value={session?.guiche || ""}
                        onChange={(e) =>
                            setSession({ ...session, guiche: e.target.value })
                        }
                    />

                    <Input
                        placeholder="Nome"
                        value={session?.nome || ""}
                        onChange={(e) =>
                            setSession({ ...session, nome: e.target.value })
                        }
                    />

                    <Button onClick={salvarSessao}>Salvar</Button>
                </DialogContent>
            </Dialog>
        </>
    )
}