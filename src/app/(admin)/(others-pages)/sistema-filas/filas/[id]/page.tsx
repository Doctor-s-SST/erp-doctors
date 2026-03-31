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
    Beaker,
    Clock,
    FlaskConical,
    BellRing
} from "lucide-react"

type ItemFila = {
    tipo_senha: string
    id: string
    atendimento_id: string
    senha: string
    nome: string
    status: string
    status_atendimento: string
    created_at: string
    ficha_sequencial: string
    num_sala?: string | null
    tempo_espera_inicial?: number
    observacao?: string
    bloqueado?: boolean
    sala?: string
    profissional?: string
    especialidade_nome?: string
    sala_atual?: string
}

type ConfigOrdenacao = {
    coluna: keyof ItemFila | 'tempo_espera'
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
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({ coluna: 'tempo_espera', direcao: 'desc' })
    const [showToxicologico, setShowToxicologico] = useState(false)

    const TOX_SALA = "Toxicológico"

    const getTempoEsperaTotal = (item: ItemFila) => {
        if (!item.created_at) return 0

        const decorridoDesdeCriacao = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 1000 / 60)
        return (item.tempo_espera_inicial || 0) + decorridoDesdeCriacao
    }

    const getHora = (date: string) => {
        if (!date) return "--:--"
        return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    const getColorTempoEspera = (minutos: number, isCancelado: boolean) => {
        if (isCancelado) return "text-red-500";
        if (minutos < 10) return "text-emerald-500"; // Até 10 min: Verde (Ok)
        if (minutos < 20) return "text-amber-500";   // 10-20 min: Amarelo (Atenção)
        if (minutos < 30) return "text-orange-600";  // 20-30 min: Laranja (Urgente)
        return "text-red-600 animate-pulse";         // +30 min: Vermelho Pulsante (Crítico)
    }

    // Lógica de cores centralizada
    const getStatusStyles = (status: string, bloqueado?: boolean, salaAtual?: string) => {

        if (!status) {
            return { color: "text-slate-400", bg: "bg-slate-100", label: "INDETERMINADO" };
        }

        // 🔴 BLOQUEADO mostrando onde está
        if (bloqueado && salaAtual) {
            return {
                color: "text-red-600",
                bg: "bg-red-500/10",
                label: `EM ATENDIMENTO`
                // ${salaAtual.toUpperCase()}
            }
        }

        // 🟠 EM ALGUMA SALA (status do atendimento)
        if (status.startsWith("EM_") && status !== "EM_ATENDIMENTO") {
            return {
                color: "text-orange-600",
                bg: "bg-orange-500/10",
                label: status.replace("EM_", "").replaceAll("_", " ")
            }
        }

        // 🔵 Em atendimento (exame atual)
        if (status === "EM_ATENDIMENTO") {
            return {
                color: "text-blue-600",
                bg: "bg-blue-500/10",
                label: "EM CONSULTA",
                animate: "animate-pulse"
            }
        }

        if (bloqueado) {
            return { color: "text-red-500", bg: "bg-red-500/10", label: "BLOQUEADO" }
        }

        if (status === "FINALIZADO") {
            return { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "FINALIZADO" }
        }

        return { color: "text-slate-600", bg: "bg-slate-100", label: "AGUARDANDO" }
    }

    async function fetchFila() {
        setIsRefreshing(true)
        try {
            // 1. Busca o nome da especialidade primeiro
            const { data: esp } = await supabase
                .from('especialidades')
                .select('nome')
                .eq('id', id)
                .single()

            if (!esp) return;

            // Atualiza o estado para o Header (UI)
            setEspecialidadeNome(esp.nome)

            // 2. USA O VALOR DIRETO DA VARIÁVEL 'esp.nome' e não do estado
            const { data: result, error } = await supabase.rpc("get_fila_especialidade", {
                p_sala: esp.nome
            })

            if (result) setData(result)

            // Lógica do Toxicológico (se aplicável)
            if (showToxicologico) {
                const { data: resultTox } = await supabase.rpc("get_fila_especialidade", {
                    p_sala: TOX_SALA
                })
                if (resultTox) setDataTox(resultTox)
            }
        } catch (err) {
            console.error("Erro ao buscar fila:", err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        fetchFila()
        const interval = setInterval(fetchFila, 3000)
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

    async function executarAcao(rpcName: string, params: any) {
        setLoadingAction(params.p_atendimento_id)
        const { error } = await supabase.rpc(rpcName, params)
        if (error) { toast.error("Erro na operação") }
        else { toast.success("Sucesso!"); fetchFila() }
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
        const listaBruta = showToxicologico ? [...data, ...dataTox] : [...data];

        // Remove duplicatas baseadas no ID do atendimento_exame
        const listaUnica = Array.from(new Map(listaBruta.map(item => [item.id, item])).values());

        return listaUnica.sort((a, b) => {
            const pesoStatus = (s: string, bloq: boolean | undefined) => {
                if (bloq) return 5;
                if (s === "EM_ATENDIMENTO") return 1;
                if (s === "AGUARDANDO") return 2;
                return 3;
            };
            const pA = pesoStatus(a.status, a.bloqueado)
            const pB = pesoStatus(b.status, b.bloqueado)
            if (pA !== pB) return pA - pB
            return ordenacao.direcao === 'asc' ? getTempoEsperaTotal(a) - getTempoEsperaTotal(b) : getTempoEsperaTotal(b) - getTempoEsperaTotal(a)
        })
    }, [data, dataTox, showToxicologico, ordenacao])

    const ThOrdenavel = ({ label, coluna }: { label: string, coluna: keyof ItemFila | 'tempo_espera' }) => (
        <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setOrdenacao(prev => ({ coluna, direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc' }))}>
            <div className="flex items-center gap-1">{label} <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
        </th>
    )

    const onFichaClick = (item: any) => {
        window.navigator.clipboard.writeText(item.ficha_sequencial || "--");
        toast.success("Ficha copiada: " + (item.ficha_sequencial || "--"))
    };

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
                                        <ThOrdenavel label="Sequencial Ficha" coluna="ficha_sequencial" />
                                        <ThOrdenavel label="Chegada" coluna="created_at" />
                                        <ThOrdenavel label="Tempo Espera" coluna="tempo_espera" />
                                        <ThOrdenavel label="Status" coluna="status" />
                                        <ThOrdenavel label="Sala" coluna="sala" />
                                        <th className="text-right p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {dadosProcessados.map((item) => {
                                        const styles = getStatusStyles(
                                            item.status_atendimento,
                                            item.bloqueado,
                                            item.sala_atual
                                        )

                                        const isFinalizado = item.status === "FINALIZADO"
                                        const isCancelado = item.status === "CANCELADO"
                                        const isNaoAtendido = item.status === "NAO_ATENDIDO"
                                        const isEncerrado = isFinalizado || isCancelado

                                        const rowStyles =
                                            isFinalizado
                                                ? "bg-emerald-200/70 dark:bg-emerald-900/30"
                                                : isCancelado
                                                    ? "bg-red-200/70 dark:bg-red-900/30"
                                                    : isNaoAtendido
                                                        ? "bg-orange-200/70 dark:bg-orange-900/30"
                                                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"

                                        return (
                                            <tr
                                                key={item.id}
                                                className={`${rowStyles} transition-all border-b border-slate-100 dark:border-slate-800`}
                                            >
                                                {/* SENHA */}
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-lg font-black leading-none ${item.tipo_senha === "PREFERENCIAL" ? "text-orange-600" : "text-blue-600"}`}>
                                                            {item.senha}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{item.tipo_senha}</span>
                                                    </div>
                                                </td>

                                                {/* NOME */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">
                                                            {item.nome}
                                                        </span>

                                                        {showToxicologico && item.especialidade_nome && (
                                                            <span className="text-[9px] text-slate-400 uppercase font-black">
                                                                {item.especialidade_nome}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* FICHA */}
                                                <td
                                                    className="p-4 text-[13px] font-bold font-mono cursor-pointer text-center"
                                                    onClick={() => onFichaClick?.(item)}
                                                >
                                                    <span className="p-1 rounded bg-slate-500/20 hover:bg-slate-500/50 transition-all">
                                                        {item.ficha_sequencial || "--"}
                                                    </span>
                                                </td>

                                                {/* CHEGADA */}
                                                <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                                                    {getHora(item.created_at)}
                                                </td>

                                                {/* TEMPO */}
                                                <td className={`p-4 font-bold ${isEncerrado ? "text-slate-400" : getColorTempoEspera(parseInt(item.created_at), isCancelado)}`}>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 opacity-70" />
                                                        {getTempoEsperaTotal(item)} min
                                                    </div>
                                                </td>

                                                {/* STATUS */}
                                                <td className="p-4 text-center">
                                                    {item.bloqueado ? (
                                                        <Badge variant="destructive" className={`h-fit flex-col uppercase ${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider p-2 ${styles.animate || ""}`}>
                                                            <span>{styles.label}</span>
                                                            <span>{`${item.sala_atual} (Sala ${item.num_sala})`}</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            className={`${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider ${styles.animate || ""}`}
                                                        >
                                                            {styles.label}
                                                        </Badge>
                                                    )}
                                                </td>

                                                {/* SALA */}
                                                <td className="p-4 text-center font-black text-slate-700 dark:text-white">
                                                    {item.num_sala || "--"}
                                                </td>

                                                {/* AÇÕES */}
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1.5 items-center">
                                                        {!isEncerrado ? (
                                                            <>
                                                                {item.status === "AGUARDANDO" && !item.bloqueado && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 text-[11px] border-amber-600 text-amber-600 hover:bg-amber-50"
                                                                        onClick={() =>
                                                                            executarAcao(
                                                                                "chamar_paciente",
                                                                                {
                                                                                    p_atendimento_id: item.atendimento_id,
                                                                                    p_atendimento_exame_id: item.id,
                                                                                    p_sala: especialidadeNome,
                                                                                    p_num_sala: session.sala,
                                                                                    p_profissional: session.profissional,
                                                                                }
                                                                            )
                                                                        }
                                                                    >
                                                                        <BellRing className="w-3 h-3 mr-1" />
                                                                        Chamar
                                                                    </Button>
                                                                )}

                                                                {item.status === "EM_ATENDIMENTO" && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                                                        onClick={() =>
                                                                            executarAcao(
                                                                                "finalizar_atendimento",
                                                                                { atendimento_exame_id: item.id },
                                                                            )
                                                                        }
                                                                    >
                                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                        Finalizar
                                                                    </Button>
                                                                )}

                                                                {/* CANCELAR */}
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-8 w-8 p-0 text-white hover:text-red-600 hover:border-red-500 bg-red-500"
                                                                                onClick={() =>
                                                                                    executarAcao(
                                                                                        "cancelar_atendimento",
                                                                                        { p_atendimento_id: item.atendimento_id }
                                                                                    )
                                                                                }
                                                                            >
                                                                                <XCircle className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Cancelar</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-bold uppercase italic text-slate-400">
                                                                Encerrado
                                                            </span>
                                                        )}
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
                                <Input className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500" placeholder="Ex: Consultório 01" onChange={(e) => setSession({ ...session, sala: e.target.value })} />
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