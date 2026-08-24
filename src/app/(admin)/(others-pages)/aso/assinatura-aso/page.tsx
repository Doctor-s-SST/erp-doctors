"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    RefreshCw,
    FilePenLine,
    MessageCircleWarning,
    Signature,
    Search,
    ArrowUpDown,
    Loader2,
    CheckCircle2,
    AlertTriangle
} from "lucide-react"
import { Label } from "@/components/ui/label"

interface Pacientes {
    id?: string
    unidade_id?: string
    nome_paciente: string
    sequencial_ficha: string
    created_at?: string
    acao?: "ASSINADO" | "PENDENCIA" | null
    observacao?: string | null
}

type ConfigOrdenacao = {
    coluna: keyof Pacientes
    direcao: "asc" | "desc"
}

export default function AssinaturaAsoPage() {
    const [pacientes, setPacientes] = useState<Pacientes[]>([])
    const [loading, setLoading] = useState(false)
    const [unidadeId, setUnidadeId] = useState<string | null>(null)

    const [busca, setBusca] = useState("")
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({
        coluna: "created_at",
        direcao: "desc"
    })

    // Confirmação de assinatura
    const [confirmAssinaturaOpen, setConfirmAssinaturaOpen] = useState(false)

    // Pendência (com justificativa)
    const [pendenciaOpen, setPendenciaOpen] = useState(false)
    const [justificativa, setJustificativa] = useState("")

    const [itemSelecionado, setItemSelecionado] = useState<Pacientes | null>(null)
    const [enviando, setEnviando] = useState(false)

    // Carrega o contexto do usuário (unidade_id)
    useEffect(() => {
        const fetchUserContext = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('unidade_id')
                    .eq('id', user.id)
                    .single()

                if (profile?.unidade_id) {
                    setUnidadeId(profile.unidade_id)
                }
            }
        }
        fetchUserContext()
    }, [])

    const fetchPacientes = useCallback(async () => {
        if (!unidadeId) return

        setLoading(true)
        const { data, error } = await supabase
            .from("pacientes_assinatura")
            .select("*")
            .eq("unidade_id", unidadeId)
            .order("nome_paciente", { ascending: true })

        if (error) {
            toast.error("Erro ao carregar pacientes.")
        } else {
            setPacientes(data || [])
        }
        setLoading(false)
    }, [unidadeId])

    useEffect(() => {
        if (unidadeId) {
            fetchPacientes()
        }
    }, [unidadeId, fetchPacientes])

    // ============================================================
    // AÇÕES: ASSINADO / PENDÊNCIA
    // ============================================================

    const abrirConfirmarAssinatura = (item: Pacientes) => {
        setItemSelecionado(item)
        setConfirmAssinaturaOpen(true)
    }

    const abrirPendencia = (item: Pacientes) => {
        setItemSelecionado(item)
        setJustificativa("")
        setPendenciaOpen(true)
    }

    // Chamada de API
    async function enviarAcaoAso(
        paciente: Pacientes,
        acao: "ASSINADO" | "PENDENCIA",
        observacao?: string
    ) {
        const response = await fetch("/api/enviar-asos-concluidos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                selecionados: [{
                    paciente,
                    acao,
                    observacao: observacao || null
                }]
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("Erro na API:", errorText)
            throw new Error("Falha ao notificar a API")
        }

        return response.json()
    }

    const confirmarAssinatura = async () => {
        if (!itemSelecionado?.id) return

        setEnviando(true)
        try {
            await enviarAcaoAso(itemSelecionado, "ASSINADO")

            const { error } = await supabase
                .from("pacientes_assinatura")
                .update({ acao: "ASSINADO" })
                .eq("id", itemSelecionado.id)

            if (error) throw error

            setPacientes(prev =>
                prev.map(p =>
                    p.id === itemSelecionado.id
                        ? { ...p, acao: "ASSINADO" }
                        : p
                )
            )

            toast.success("ASO marcado como assinado.")
            setConfirmAssinaturaOpen(false)
            setItemSelecionado(null)
        } catch (err) {
            console.error(err)
            toast.error("Erro ao registrar a assinatura do ASO.")
        } finally {
            setEnviando(false)
        }
    }

    const confirmarPendencia = async () => {
        if (!itemSelecionado?.id) return

        if (!justificativa.trim()) {
            toast.warning("Informe a justificativa da pendência.")
            return
        }

        setEnviando(true)
        try {
            await enviarAcaoAso(itemSelecionado, "PENDENCIA", justificativa.trim())

            const { error } = await supabase
                .from("pacientes_assinatura")
                .update({
                    acao: "PENDENCIA",
                    observacao: justificativa.trim()
                })
                .eq("id", itemSelecionado.id)

            if (error) throw error

            setPacientes(prev =>
                prev.map(p =>
                    p.id === itemSelecionado.id
                        ? { ...p, acao: "PENDENCIA", observacao: justificativa.trim() }
                        : p
                )
            )

            toast.success("Pendência registrada.")
            setPendenciaOpen(false)
            setItemSelecionado(null)
            setJustificativa("")
        } catch (err) {
            console.error(err)
            toast.error("Erro ao registrar a pendência do ASO.")
        } finally {
            setEnviando(false)
        }
    }

    //Copiar
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Copiado!")
    }

    // ============================================================
    // BUSCA + ORDENAÇÃO
    // ============================================================

    const handleSort = (coluna: keyof Pacientes) => {
        setOrdenacao(prev => ({
            coluna,
            direcao: prev.coluna === coluna && prev.direcao === "asc" ? "desc" : "asc"
        }))
    }

    const dadosProcessados = useMemo(() => {
        let lista = [...pacientes]

        if (busca.trim()) {
            const f = busca.toLowerCase().trim()
            lista = lista.filter(p =>
                (p.nome_paciente || "").toLowerCase().includes(f) ||
                (p.sequencial_ficha || "").toLowerCase().includes(f)
            )
        }

        return lista.sort((a, b) => {
            // Não-acionados sempre primeiro; acionados (histórico) vão pro final
            const pesoAcao = (item: Pacientes) => (item.acao ? 1 : 0)

            const pA = pesoAcao(a)
            const pB = pesoAcao(b)
            if (pA !== pB) return pA - pB

            let valA: any = a[ordenacao.coluna] ?? ""
            let valB: any = b[ordenacao.coluna] ?? ""

            if (typeof valA === "string") valA = valA.toLowerCase()
            if (typeof valB === "string") valB = valB.toLowerCase()

            if (valA < valB) return ordenacao.direcao === "asc" ? -1 : 1
            if (valA > valB) return ordenacao.direcao === "asc" ? 1 : -1
            return 0
        })
    }, [pacientes, busca, ordenacao])

    const ThOrdenavel = ({ label, coluna }: { label: string, coluna: keyof Pacientes }) => {
        const isAtivo = ordenacao.coluna === coluna

        return (
            <TableHead
                className={`font-bold text-xs uppercase cursor-pointer select-none transition-colors ${isAtivo ? "text-blue-600" : ""
                    }`}
                onClick={() => handleSort(coluna)}
            >
                <div className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown className={`w-3 h-3 ${isAtivo ? "opacity-100" : "opacity-30"}`} />
                </div>
            </TableHead>
        )
    }

    return (
        <div className="min-h-fit mt-2 space-y-4 bg-gray-500/20 rounded-xl p-2">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20 text-blue-400">
                        <Signature className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">Assinatura de ASO</h1>
                        <p className="text-xs text-slate-400 font-mono">Controle de assinatura ou pendência de ASOs</p>
                    </div>
                </div>
            </header>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-1">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                        <p> ASO's para assinar ({dadosProcessados.filter(p => !p.acao).length})</p>
                    </CardTitle>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 h-8 w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <Input
                                placeholder="Buscar por nome ou sequencial..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="h-7 border-none shadow-none px-0 text-xs focus-visible:ring-0"
                            />
                        </div>

                        <Button variant="ghost" size="icon" onClick={fetchPacientes} className="h-8 w-8 shrink-0">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow>
                                <ThOrdenavel label="Nome" coluna="nome_paciente" />
                                <ThOrdenavel label="Sequencial da Ficha" coluna="sequencial_ficha" />
                                <ThOrdenavel label="Data de Liberação" coluna="created_at" />
                                <TableHead className="font-bold text-xs uppercase">Observação</TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dadosProcessados.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-xs text-slate-400 font-mono">
                                        Nenhum ASO para assinar.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dadosProcessados.map((item) => {
                                    const isAcionado = !!item.acao

                                    return (
                                        <TableRow
                                            key={item.id}
                                            className={`transition-all ${isAcionado
                                                ? "opacity-40 bg-slate-50/60 dark:bg-slate-900/40"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                }`}
                                        >
                                            <TableCell
                                                className="font-medium text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
                                                onClick={() => handleCopy(item.nome_paciente || "")}
                                            >
                                                {item.nome_paciente}
                                            </TableCell>

                                            <TableCell
                                                className="text-sm text-left font-bold text-blue-500 cursor-pointer"
                                                onClick={() => handleCopy(item.sequencial_ficha || "")}
                                            >
                                                {item.sequencial_ficha}
                                            </TableCell>

                                            <TableCell className="text-sm text-left font-bold text-blue-500">
                                                {item.created_at
                                                    ? new Date(item.created_at).toLocaleDateString("pt-BR")
                                                    : "--"}
                                            </TableCell>

                                            <TableCell className="text-xs text-slate-500 italic max-w-60 truncate">
                                                {item.observacao || (isAcionado ? "" : "")}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                {isAcionado ? (
                                                    <Badge
                                                        className={`uppercase text-[10px] font-bold tracking-wider border-none ${item.acao === "ASSINADO"
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-red-600 text-white"
                                                            }`}
                                                    >
                                                        {item.acao === "ASSINADO" ? "Assinado" : "Pendência"}
                                                    </Badge>
                                                ) : (
                                                    <div className="flex flex-row items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => abrirConfirmarAssinatura(item)}
                                                            className="w-fit px-2 flex gap-2 font-medium text-green-600 bg-green-500/10 hover:bg-green-500/20 hover:text-green-600 border border-green-500/30"
                                                        >
                                                            <FilePenLine className="w-4 h-4" />
                                                            <span>ASO Assinado</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => abrirPendencia(item)}
                                                            className="w-fit px-2 flex gap-2 font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 hover:text-red-600 border border-red-500/30"
                                                        >
                                                            <MessageCircleWarning className="w-4 h-4" />
                                                            <span>ASO com pendência</span>
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* MODAL: CONFIRMAR ASSINATURA */}
            <Dialog open={confirmAssinaturaOpen} onOpenChange={(open) => !enviando && setConfirmAssinaturaOpen(open)}>
                <DialogContent className="sm:max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-base font-bold">
                                Confirmar assinatura do ASO
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500 pt-2">
                            Confirma que o ASO de{" "}
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                {itemSelecionado?.nome_paciente}
                            </span>{" "}
                            (ficha {itemSelecionado?.sequencial_ficha}) foi assinado?
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={enviando}
                            onClick={() => setConfirmAssinaturaOpen(false)}
                            className="h-9 text-xs uppercase"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={enviando}
                            onClick={confirmarAssinatura}
                            className="h-9 text-xs uppercase bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL: PENDÊNCIA COM JUSTIFICATIVA */}
            <Dialog open={pendenciaOpen} onOpenChange={(open) => !enviando && setPendenciaOpen(open)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="bg-red-500/10 p-2 rounded-lg text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-base font-bold">
                                Registrar pendência do ASO
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500 pt-2">
                            {itemSelecionado?.nome_paciente} (ficha {itemSelecionado?.sequencial_ficha})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5 py-2">
                        <Label htmlFor="justificativa" className="text-xs font-bold uppercase">
                            Justificativa
                        </Label>
                        <Textarea
                            id="justificativa"
                            placeholder="Descreva o motivo da pendência..."
                            value={justificativa}
                            onChange={(e) => setJustificativa(e.target.value)}
                            className="min-h-24 text-sm"
                            autoFocus
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={enviando}
                            onClick={() => setPendenciaOpen(false)}
                            className="h-9 text-xs uppercase"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={enviando}
                            onClick={confirmarPendencia}
                            className="h-9 text-xs uppercase bg-red-600 hover:bg-red-700 text-white"
                        >
                            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}