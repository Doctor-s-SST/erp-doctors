"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import {
    CheckCircle2,
    User,
    XCircle,
    ArrowUpDown,
    Stethoscope,
    Volume2,
    DoorOpen,
    LayoutGrid,
    RefreshCw,
    Beaker
} from "lucide-react"

type ItemFila = {
    id: string
    senha: string
    nome: string
    status: string
    created_at: string
    sequencial_ficha: string
    guiche: string
    tempo_espera_inicial: number
    observacao?: string
    bloqueado?: boolean
    sala?: string
    profissional?: string
    especialidade_nome?: string
}

type ConfigOrdenacao = {
    coluna: keyof ItemFila | 'tempo_total'
    direcao: 'asc' | 'desc'
}

export default function FilaPage() {
    const { id } = useParams()
    const [especialidadeNome, setEspecialidadeNome] = useState("Carregando...")
    const [data, setData] = useState<ItemFila[]>([])
    const [dataTox, setDataTox] = useState<ItemFila[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [openModal, setOpenModal] = useState(false)
    const [session, setSession] = useState<any>(null)
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({ coluna: 'tempo_total', direcao: 'desc' })
    const [showToxicologico, setShowToxicologico] = useState(false)

    const TOX_ID = "eaae8f6a-924c-442c-bbd8-c108445dfc5c"

    const getTempoEsperaTotal = (item: ItemFila) => {
        if (!item.created_at) return 0
        const decorridoDesdeCriacao = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 1000 / 60)
        return (item.tempo_espera_inicial || 0) + decorridoDesdeCriacao
    }

    const getHora = (date: string) => {
        if (!date) return "--:--"
        return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    // Lógica de cores centralizada
    const getStatusStyles = (status: string, bloqueado?: boolean) => {
        if (bloqueado) return { color: "text-red-500", bg: "bg-red-500/10", label: "BLOQUEADO" }
        switch (status) {
            case "EM_ATENDIMENTO":
                return { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", label: "EM CONSULTA", animate: "animate-pulse" }
            case "FINALIZADO":
                return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "FINALIZADO" }
            case "AGUARDANDO":
            default:
                return { color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", label: "NA FILA" }
        }
    }

    async function fetchFila() {
        setIsRefreshing(true)
        try {
            const { data: esp } = await supabase.from('especialidades').select('nome').eq('id', id).single()
            if (esp) setEspecialidadeNome(esp.nome)

            const { data: result } = await supabase.rpc("get_fila_especialidade", { especialidade_id: id })
            if (result) setData(result)

            if (showToxicologico) {
                const { data: resultTox } = await supabase.rpc("get_fila_especialidade", { especialidade_id: TOX_ID })
                if (resultTox) setDataTox(resultTox)
            }
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        fetchFila()
        const interval = setInterval(fetchFila, 5000)
        const channel = supabase.channel(`fila-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "atendimento_exames" }, () => fetchFila()).subscribe()
        return () => { clearInterval(interval); supabase.removeChannel(channel) }
    }, [id, showToxicologico])

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const userKey = `fila_session_${user.id}`;
                const saved = localStorage.getItem(userKey);

                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Verifica se os campos obrigatórios existem no JSON salvo
                    if (parsed.sala && parsed.profissional) {
                        setSession(parsed);
                        setOpenModal(false); // Garante que fecha
                        return; // Sai da função, não abre o modal
                    }
                }

                // Se chegou aqui, não tem dado válido
                setSession({ sala: "", profissional: "" });
                setOpenModal(true);
            }
        };
        checkUser();
    }, [id]);

    async function executarAcao(rpcName: string, params: any, actionId: string) {
        setLoadingAction(actionId)
        const { error } = await supabase.rpc(rpcName, params)
        if (error) { toast.error("Erro na operação") }
        else { toast.success("Operação realizada!"); fetchFila() }
        setLoadingAction(null)
    }

    async function salvarSessao() {
        if (!session?.sala || !session?.profissional) return toast.warning("Preencha todos os campos")
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            localStorage.setItem(`fila_session_${user.id}`, JSON.stringify(session))
            setOpenModal(false)
            toast.success("Turno iniciado!")
        }
    }

    const dadosProcessados = useMemo(() => {
        const listaMesclada = showToxicologico ? [...data, ...dataTox] : [...data]
        return listaMesclada.sort((a, b) => {
            const pesoStatus = (s: string, bloq?: boolean) => {
                if (bloq) return 5
                if (s === "EM_ATENDIMENTO") return 1
                if (s === "AGUARDANDO") return 2
                return 3
            }
            const pA = pesoStatus(a.status, a.bloqueado)
            const pB = pesoStatus(b.status, b.bloqueado)
            if (pA !== pB) return pA - pB
            return ordenacao.direcao === 'asc' ? getTempoEsperaTotal(a) - getTempoEsperaTotal(b) : getTempoEsperaTotal(b) - getTempoEsperaTotal(a)
        })
    }, [data, dataTox, showToxicologico, ordenacao])

    const ThOrdenavel = ({ label, coluna }: { label: string, coluna: keyof ItemFila | 'tempo_total' }) => (
        <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setOrdenacao(prev => ({ coluna, direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc' }))}>
            <div className="flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
        </th>
    )

    if (loading) return <div className="flex h-screen items-center justify-center font-mono text-sm animate-pulse text-emerald-600 bg-slate-50 dark:bg-slate-950 uppercase tracking-widest">Sincronizando Fila...</div>

    return (
        <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* HEADER */}
                <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl"><Stethoscope className="w-6 h-6 text-emerald-400" /></div>
                        <div className="space-y-1">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">{especialidadeNome}</h1>
                            <p className="text-slate-400 text-[11px] font-bold tracking-[0.2em] uppercase">{new Date().toLocaleDateString("pt-BR")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
                            <User className="w-4 h-4 text-emerald-400" />
                            <div>
                                <p className="text-[9px] uppercase text-slate-500 font-black leading-none mb-1">Especialista</p>
                                <p className="text-sm font-bold text-slate-200">{session?.profissional || "NÃO IDENTIFICADO"}</p>
                            </div>
                        </div>
                        <div className="px-2 text-center">
                            <p className="text-[9px] uppercase text-slate-500 font-black leading-none mb-1">SALA</p>
                            <p className="text-lg font-black text-emerald-400 leading-none">{session?.sala || "--"}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setOpenModal(true)} className="ml-2 h-8 text-[9px] font-black uppercase tracking-widest bg-slate-700 hover:bg-emerald-600 text-white transition-colors">Alterar</Button>
                    </div>
                </div>

                {/* CONTROLES */}
                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={fetchFila} disabled={isRefreshing} variant="outline" className="h-9 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <RefreshCw className={`w-3 h-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar Lista
                    </Button>
                    {especialidadeNome === "Triagem" && (
                        <Button onClick={() => setShowToxicologico(!showToxicologico)} variant={showToxicologico ? "default" : "outline"} className={`h-9 text-[10px] font-black uppercase tracking-widest transition-all ${showToxicologico ? 'bg-orange-600 hover:bg-orange-700 text-white border-none' : 'border-orange-200 text-orange-600 hover:bg-orange-50'}`}>
                            <Beaker className="w-3 h-3 mr-2" /> {showToxicologico ? "Ocultar Toxicológico" : "Ver Toxicológico"}
                        </Button>
                    )}
                </div>

                {/* TABELA */}
                <Card className="border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <ThOrdenavel label="Senha" coluna="senha" />
                                        <ThOrdenavel label="Nome" coluna="nome" />
                                        <ThOrdenavel label="Sequencial Ficha" coluna="sequencial_ficha" />
                                        <ThOrdenavel label="Chegada" coluna="created_at" />
                                        <ThOrdenavel label="Tempo Espera" coluna="tempo_total" />
                                        <ThOrdenavel label="Status" coluna="status" />
                                        <ThOrdenavel label="Guichê" coluna="guiche" />
                                        <th className="text-right p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {dadosProcessados.map((item) => {
                                        const styles = getStatusStyles(item.status, item.bloqueado);
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="p-4">
                                                    {/* Cor do número da senha baseada no status */}
                                                    <span className={`text-lg font-black ${styles.color} ${styles.animate || ""}`}>
                                                        {item.senha}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                                                    <div className="flex flex-col">
                                                        {item.nome}
                                                        {showToxicologico && item.especialidade_nome && (
                                                            <span className="text-[9px] text-slate-400 uppercase font-black">{item.especialidade_nome}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-slate-500">{item.sequencial_ficha || "-"}</td>
                                                <td className="p-4 text-slate-500">{getHora(item.created_at)}</td>
                                                <td className={`p-4 font-bold ${item.status === "EM_ATENDIMENTO" ? "text-blue-500" : "text-amber-600"}`}>
                                                    {getTempoEsperaTotal(item)} min
                                                </td>
                                                <td className="p-4">
                                                    <Badge className={`${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider ${styles.animate || ""}`}>
                                                        {styles.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-slate-500 font-medium">{item.guiche || "-"}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {!item.bloqueado && item.status === "AGUARDANDO" && (
                                                            <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-[11px] font-bold" disabled={!!loadingAction}
                                                                onClick={() => executarAcao("chamar_paciente", { atendimento_exame_id: item.id, sala: session.sala, profissional: session.profissional }, item.id)}>
                                                                <Volume2 className="w-3 h-3 mr-1" /> Chamar
                                                            </Button>
                                                        )}
                                                        {item.status === "EM_ATENDIMENTO" && (
                                                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-[11px] font-bold" disabled={!!loadingAction}
                                                                onClick={() => executarAcao("finalizar_atendimento", { atendimento_exame_id: item.id }, item.id)}>
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar
                                                            </Button>
                                                        )}

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button size="sm" className="h-8 w-8 p-0 bg-red-700"
                                                                        onClick={() => executarAcao("cancelar_atendimento", { p_atendimento_id: item.id }, item.id)}>
                                                                        <XCircle className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-slate-900 text-white border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                                                                    <p>Cancelar Senha</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* MODAL CONFIGURAÇÃO */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="sm:max-w-[400px] border-none shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="space-y-4">
                        <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mx-auto"><LayoutGrid className="w-8 h-8 text-emerald-500" /></div>
                        <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Sala de Atendimento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Número da Sala</Label>
                            <div className="relative">
                                <DoorOpen className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <Input className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500" placeholder="Ex: Consultório 01" value={session?.sala || ""} onChange={(e) => setSession({ ...session, sala: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Profissional</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <Input className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500" placeholder="Nome do especialista" value={session?.profissional || ""} onChange={(e) => setSession({ ...session, profissional: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 bg-slate-900 hover:bg-emerald-600 text-white font-black uppercase tracking-widest transition-all shadow-lg" onClick={salvarSessao}>Confirmar Entrada</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}