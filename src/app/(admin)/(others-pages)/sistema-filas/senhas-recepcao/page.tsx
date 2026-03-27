"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FileEdit, CheckCircle2, RefreshCw, User, Monitor, XCircle, Filter, ArrowUpDown, Clock, PlusCircle, MonitorCheck, UploadCloud, Save, Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

type ConfigOrdenacao = {
    coluna: keyof Atendimento | 'tempo_espera'
    direcao: 'asc' | 'desc'
}

interface DetalhesFicha {
    empresa: { razao_social: string; cnpj: string };
    funcionario: { cargo: string; setor: string; cpf: string };
    exames: Array<{ exame: string; data: string }>;
    riscos: { físicos: string[]; químicos: string[]; ergonômicos: string[]; acidentes: string[] };
}

const RECEPCIONISTAS = ["Livia Beatriz", "Mariana Galvao", "Pietra Senatore", "Marcela Santos"]

export default function RecepcaoPage() {
    const [data, setData] = useState<Atendimento[]>([])
    const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [session, setSession] = useState<{ guiche?: string, nome?: string }>({})
    const [openModal, setOpenModal] = useState(false)
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({ coluna: 'tempo_espera', direcao: 'asc' })
    const generatingRef = useRef(false)

    // ESTADOS DO MODAL DE IMPORTAÇÃO
    const [importModal, setImportModal] = useState<{ open: boolean, item: Atendimento | null }>({ open: false, item: null })
    const [formFicha, setFormFicha] = useState({
        nome: "",
        sequencial: 0,
        arquivo: null as File | null,
        dadosExtra: null as DetalhesFicha | null
    })

    //user localStorage
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();

            if (user) {
                const userKey = `recepcao_session_${user.id}`;
                const saved = localStorage.getItem(userKey);

                if (saved) {
                    setSession(JSON.parse(saved));
                    setOpenModal(false);
                } else {
                    // Força o reset do estado para não herdar dados do login anterior
                    setSession({ guiche: "", nome: "" });
                    setOpenModal(true);
                }
            } else {
                // Se deslogado ou erro, limpa tudo
                setSession({ guiche: "", nome: "" });
            }
        };
        checkUser();
    }, []);



    const getTempoEsperaEvolutivo = (item: any) => {
        if (!item.created_at) return { texto: "--", isCancelado: false };
        const statusTravados = ["CANCELADO"];

        if (statusTravados.includes(item.status) && item.tempo_espera_min !== undefined) {
            return { texto: `${item.tempo_espera_min} min`, isCancelado: true };
        }

        const diffMs = Date.now() - new Date(item.created_at).getTime();
        // Garante que o tempo nunca seja menor que 0
        const min = Math.max(0, Math.floor(diffMs / 1000 / 60));

        return { texto: `${min} min`, isCancelado: false };
    };

    const getColorTempoEspera = (minutos: number, isCancelado: boolean) => {
        if (isCancelado) return "text-red-500";
        if (minutos < 10) return "text-emerald-500"; // Até 10 min: Verde (Ok)
        if (minutos < 20) return "text-amber-500";   // 10-20 min: Amarelo (Atenção)
        if (minutos < 30) return "text-orange-600";  // 20-30 min: Laranja (Urgente)
        return "text-red-600 animate-pulse";         // +30 min: Vermelho Pulsante (Crítico)
    };

    const getHora = (date: string) => {
        if (!date) return "--:--"
        return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    function getStatusBadge(status: string) {
        const styles: any = {
            "AGUARDANDO_RECEPCAO": "bg-slate-100 text-slate-500",
            "EM_FILA": "bg-amber-100 text-amber-600",
            "EM_RECEPCAO": "bg-blue-100 text-blue-600 animate-pulse",
            "FINALIZADO": "bg-emerald-100 text-emerald-600",
            "CANCELADO": "bg-red-100 text-red-600"
        }
        return <Badge className={`${styles[status] || 'bg-slate-100'} border-none text-[9px] font-black tracking-widest uppercase px-2`}>{status.replace('_', ' ')}</Badge>
    }

    const handleSort = (coluna: keyof Atendimento | 'tempo_espera') => {
        setOrdenacao(prev => ({
            coluna,
            direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc'
        }))
    }

    const dadosProcessados = useMemo(() => {
        let filtrados = data.filter(item => filtroTipo === "TODOS" ? true : item.tipo_senha === filtroTipo)

        return filtrados.sort((a, b) => {
            // 1. PRIORIDADE POR STATUS (Mantém EM_RECEPCAO no topo, etc)
            const pesoStatus = (status: string) => {
                switch (status) {
                    case "EM_RECEPCAO": return 1
                    case "EM_FILA": return 2
                    case "AGUARDANDO_RECEPCAO": return 3
                    default: return 4
                }
            }
            const pA = pesoStatus(a.status);
            const pB = pesoStatus(b.status)

            if (pA !== pB) return pA - pB

            // 2. ORDENAÇÃO DINÂMICA DA COLUNA
            const { coluna, direcao } = ordenacao
            let comparacao = 0

            if (coluna === 'tempo_espera' || coluna === 'created_at') {
                const valA = new Date(a.created_at).getTime()
                const valB = new Date(b.created_at).getTime()
                comparacao = valA - valB
            } else {
                // Tratamento para strings (nome, senha_codigo, guiche, etc)
                const valA = String(a[coluna as keyof Atendimento] || "").toLowerCase()
                const valB = String(b[coluna as keyof Atendimento] || "").toLowerCase()

                comparacao = valA.localeCompare(valB, 'pt-BR', { numeric: true })
            }

            return direcao === 'asc' ? comparacao : -comparacao
        })
    }, [data, filtroTipo, ordenacao])

    async function fetchData() {
        const { data: result, error } = await supabase.rpc("get_painel_recepcao")
        if (!error && result) setData(result)
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000)
        return () => clearInterval(interval)
    }, [])

    async function salvarSessao() {
        if (!session?.guiche || !session?.nome) return toast.warning("Preencha todos os campos")

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const userKey = `recepcao_session_${user.id}`
            localStorage.setItem(userKey, JSON.stringify(session))
            setOpenModal(false)
            fetchData()
        } else {
            toast.error("Usuário não au")
        }
    }

    // LÓGICA DE SALVAMENTO DA FICHA
    async function handleSalvarFicha() {
        if (!importModal.item) return
        setLoadingAction("saving_ficha")

        const { error } = await supabase.rpc("vincular_ficha_paciente", {
            p_atendimento_id: importModal.item.id,
            p_nome: formFicha.nome,
            p_sequencial: formFicha.sequencial.toString()
        })

        if (error) {
            toast.error("Erro ao salvar dados")
        } else {
            toast.success("Ficha importada com sucesso!")
            setImportModal({ open: false, item: null })
            fetchData()
        }
        setLoadingAction(null)
    }

    const abrirModalImportacao = (item: Atendimento) => {
        setImportModal({ open: true, item });
        setFormFicha({
            nome: item.nome || "",
            sequencial: 0,
            arquivo: null,
            dadosExtra: null,
        });
    }

    async function gerarSenha(tipo: "NORMAL" | "PREFERENCIAL") {
        if (generatingRef.current) return
        generatingRef.current = true
        setLoadingAction(tipo)
        try {
            const { error } = await supabase.rpc("gerar_senha", { tipo_param: tipo, guiche_param: session?.guiche || "0" })
            if (error) throw error
            toast.success(`Senha ${tipo} gerada!`)
            fetchData()
        } catch (err) {
            toast.error("Erro ao gerar senha")
        } finally {
            generatingRef.current = false
            setLoadingAction(null)
        }
    }

    async function executarAcao(rpcName: string, params: any, actionId: string) {
        setLoadingAction(actionId)
        const { error } = await supabase.rpc(rpcName, params)
        if (error) toast.error("Erro na operação")
        else { toast.success("Sucesso!"); fetchData() }
        setLoadingAction(null)
    }

    const ThOrdenavel = ({ label, coluna }: { label: string, coluna: keyof Atendimento | 'tempo_espera' }) => (
        <th
            className={`text-left p-4 font-black uppercase tracking-[0.15em] text-[9px] cursor-pointer transition-colors ${ordenacao.coluna === coluna ? 'text-blue-500' : 'text-slate-400 hover:text-blue-500'}`}
            onClick={() => handleSort(coluna)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`w-3 h-3 ${ordenacao.coluna === coluna ? 'opacity-100' : 'opacity-30'}`} />
            </div>
        </th>
    )

    const handleUploadPDF = async (file: File) => {
        setLoadingAction("processing_pdf");
        const toastId = toast.loading("Extraindo dados da ficha...");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/importar-ficha", { method: "POST", body: formData });
            if (!response.ok) throw new Error("Erro no processamento");

            const dataArray = await response.json();
            const data = dataArray[0]; // Pega o primeiro objeto do retorno

            setFormFicha((prev) => ({
                ...prev,
                nome: data.funcionario.nome.toUpperCase(),
                sequencial: parseInt(data.funcionario.ficha) || prev.sequencial,
                // Armazenamos o restante para exibição visual
                dadosExtra: data
            }));

            toast.success("Ficha identificada!", { id: toastId });
        } catch (error) {
            toast.error("Erro ao ler PDF", { id: toastId });
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 space-y-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* HEADER RECEPCAO */}
                    <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl">
                                <Monitor className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Chamada de Senhas - Recepção</h1>
                                <p className="text-slate-400 text-[11px] font-bold tracking-[0.2em] uppercase">{new Date().toLocaleDateString("pt-BR")}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
                                <User className="w-4 h-4 text-blue-400" />
                                <div>
                                    <p className="text-[9px] uppercase text-slate-500 font-black leading-none mb-1">Atendente</p>
                                    <p className="text-sm font-bold text-slate-200">{session?.nome || "---"}</p>
                                </div>
                            </div>
                            <div className="px-2 text-center">
                                <p className="text-[9px] uppercase text-slate-500 font-black leading-none mb-1">GUICHÊ</p>
                                <p className="text-lg font-black text-blue-400 leading-none">{session?.guiche || "--"}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setOpenModal(true)} className="ml-2 h-8 text-[9px] font-black uppercase tracking-widest bg-slate-700 hover:bg-blue-600 text-white">Alterar</Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">

                        {/* LADO ESQUERDO: FILTROS */}
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <div className="flex gap-2">
                                {["TODOS", "NORMAL", "PREFERENCIAL"].map((tipo) => (
                                    <Button
                                        key={tipo}
                                        variant={filtroTipo === tipo ? "default" : "outline"}
                                        size="sm"
                                        className={`h-8 text-[10px] font-black uppercase tracking-widest transition-all ${filtroTipo === tipo ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500 border-slate-200'}`}
                                        onClick={() => setFiltroTipo(tipo)}
                                    >
                                        {tipo}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* LADO DIREITO: BOTÕES DE GERAR SENHA E ATUALIZAR */}
                        <div className="flex flex-row justify-end items-center gap-4 w-full">
                            <div
                                className="flex h-8 items-center gap-1 bg-blue-600 text-muted p-1 rounded-full hover:bg-blue-500 hover:text-white cursor-pointer transition-all shrink-0"
                                onClick={() => gerarSenha("NORMAL")}
                            >
                                <PlusCircle className="w-5 h-5 font-bold ml-1" />
                                <Button
                                    size="sm"
                                    className="uppercase bg-transparent font-bold text-[12px] tracking-widest pl-0"
                                    disabled={!!loadingAction}
                                >
                                    Normal
                                </Button>
                            </div>

                            <div
                                className="flex h-8 items-center gap-1 bg-orange-600 text-muted p-1 rounded-full hover:bg-orange-500 hover:text-white cursor-pointer transition-all shrink-0"
                                onClick={() => gerarSenha("PREFERENCIAL")}
                            >
                                <PlusCircle className="w-5 h-5 font-bold ml-1" />
                                <Button
                                    size="sm"
                                    className="uppercase bg-transparent font-bold text-[12px] tracking-widest pl-0"
                                    disabled={!!loadingAction}
                                >
                                    Preferencial
                                </Button>
                            </div>

                            <div
                                className="flex h-8 items-center gap-1 bg-green-500 text-muted p-1 rounded-full hover:bg-green-700 hover:text-white cursor-pointer transition-all shrink-0"
                            >
                                <RefreshCw className={`w-5 h-5 font-bold ml-1 ${loadingAction ? 'animate-spin' : ''}`} />
                                <Button
                                    size="sm"
                                    className="uppercase bg-transparent font-bold text-[12px] tracking-widest pl-0"
                                    onClick={fetchData}
                                >
                                    Atualizar
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Card className="border-none shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <ThOrdenavel label="Senha" coluna="senha_codigo" />
                                            <ThOrdenavel label="Nome" coluna="nome" />
                                            <ThOrdenavel label="Sequencial Ficha" coluna="ficha_sequencial" />
                                            <ThOrdenavel label="Chegada" coluna="created_at" />
                                            <ThOrdenavel label="Tempo Espera" coluna="tempo_espera" />
                                            <ThOrdenavel label="Status" coluna="status" />
                                            <ThOrdenavel label="Guichê" coluna="guiche" />
                                            <th className="text-right p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {dadosProcessados.map((item) => {
                                            const tempo = getTempoEsperaEvolutivo(item);
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1">
                                                            {item.tipo_senha == "PREFERENCIAL" ? (
                                                                <span className="text-lg font-black text-orange-600 dark:text-orange-400 leading-none">{item.senha_codigo}</span>
                                                            ) : (<span className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">{item.senha_codigo}</span>)}
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">{item.tipo_senha}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">
                                                        {item.nome || <span className="text-slate-300 dark:text-slate-600 italic">Não identificado</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        {item.ficha_sequencial ? (
                                                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 italic">#{item.ficha_sequencial}</span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">Pendente</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">{getHora(item.created_at)}</td>
                                                    <td className={`p-4 font-bold ${getColorTempoEspera(
                                                        Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000)),
                                                        tempo.isCancelado
                                                    )}`}>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3 opacity-70" />
                                                                {tempo.texto}
                                                            </div>
                                                            {tempo.isCancelado && (
                                                                <span className="text-[9px] font-medium opacity-70">INTERROMPIDO</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">{getStatusBadge(item.status)}</td>
                                                    <td className="p-4 text-center font-black text-slate-700 dark:text-white">
                                                        {item.guiche || "--"}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            {item.status === "AGUARDANDO_RECEPCAO" && (
                                                                <Button size="sm" variant="outline" className="h-8 text-[11px] border-amber-600 text-amber-600 hover:bg-amber-50"
                                                                    onClick={() => executarAcao("atualizar_status", { p_id: item.id, p_status: 'EM_FILA' }, item.id)}>Chamar</Button>
                                                            )}

                                                            {item.status === "EM_FILA" && (
                                                                <>
                                                                    <Button size="sm" className="h-8 text-[11px] bg-blue-600"
                                                                        onClick={() => executarAcao("atualizar_status", { p_id: item.id, p_status: 'EM_RECEPCAO' }, item.id)}>Atender</Button>
                                                                    <Button size="sm" variant="ghost" className="h-8 text-[11px] text-slate-500"
                                                                        onClick={() => executarAcao("atualizar_status", { p_id: item.id, p_status: 'AUSENTE' }, item.id)}>Ausente</Button>
                                                                </>
                                                            )}

                                                            {item.status === "EM_RECEPCAO" && (
                                                                <Button size="sm" className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700"
                                                                    onClick={() => executarAcao("atualizar_status", { p_id: item.id, p_status: 'FINALIZADO' }, item.id)}>
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar
                                                                </Button>
                                                            )}

                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-400 text-white"
                                                                            onClick={() => abrirModalImportacao(item)}
                                                                        >
                                                                            <FileEdit className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-slate-900 text-white border-slate-800 text-[10px] font-bold uppercase tracking-wider">
                                                                        <p>Importar Ficha</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>

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
            </div>

            {/* MODAL DE IMPORTAÇÃO DE FICHA */}
            <Dialog open={importModal.open} onOpenChange={(val) => {
                setImportModal({ ...importModal, open: val });
                if (!val) setFormFicha({
                    nome: "",
                    sequencial: -1,
                    arquivo: null,
                    dadosExtra: null
                });
            }}>
                <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-none shadow-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                            <FileEdit className="w-5 h-5 text-blue-500" />
                            Ficha: {importModal.item?.senha_codigo}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* LOADING OVERLAY */}
                        {loadingAction === "processing_pdf" && (
                            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
                                <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                                <p className="font-black text-blue-600 uppercase tracking-widest text-xs">Analisando PDF via n8n...</p>
                            </div>
                        )}

                        {/* INPUT DE ARQUIVO */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Documento PDF (Opcional)</Label>
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-500/50 transition-colors bg-slate-50/50 dark:bg-slate-800/20 group text-center cursor-pointer relative">
                                <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => e.target.files?.[0] && handleUploadPDF(e.target.files[0])} />
                                <div className="flex items-center justify-center gap-3">
                                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                    <p className="text-[11px] font-bold text-slate-500 uppercase">
                                        {formFicha.arquivo?.name ?? "Importar ficha"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* EXIBIÇÃO DE DADOS IMPORTADOS - Protegido contra Undefined */}
                        {formFicha.dadosExtra && (
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[9px] font-black text-blue-500 uppercase">Empresa</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                            {formFicha.dadosExtra.empresa?.razao_social ?? "Não detectado"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-blue-500 uppercase">Cargo</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {formFicha.dadosExtra.funcionario?.cargo ?? "Não detectado"}
                                        </p>
                                    </div>
                                </div>

                                {formFicha.dadosExtra.exames && (
                                    <div>
                                        <p className="text-[9px] font-black text-blue-500 uppercase mb-2">Exames Detectados ({formFicha.dadosExtra.exames.length})</p>
                                        <div className="flex flex-wrap gap-1">
                                            {formFicha.dadosExtra.exames.map((ex, i) => (
                                                <Badge key={i} variant="outline" className="text-[9px] bg-white dark:bg-slate-800 border-slate-200 py-0 uppercase font-medium">
                                                    {ex.exame?.replace('.', '')}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* INPUTS PRINCIPAIS - Sempre editáveis */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</Label>
                                <Input className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 font-bold uppercase"
                                    placeholder="Digite o nome ou importe o PDF"
                                    value={formFicha.nome}
                                    onChange={(e) => setFormFicha({ ...formFicha, nome: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Sequencial / Ficha</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="number" className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 text-lg font-black text-blue-600"
                                        value={formFicha.sequencial}
                                        onChange={(e) => setFormFicha({ ...formFicha, sequencial: parseInt(e.target.value) || 0 })} />
                                    <Button variant="outline" type="button" className="h-12 px-4 border-slate-200 hover:bg-slate-100"
                                        onClick={() => setFormFicha(prev => ({ ...prev, sequencial: (prev.sequencial || 0) + 1 }))}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="bg-slate-50 dark:bg-slate-800/50 -mx-6 -mb-6 p-6 mt-4">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                            onClick={handleSalvarFicha}
                            disabled={loadingAction === "saving_ficha" || loadingAction === "processing_pdf"}>
                            {loadingAction === "saving_ficha" ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Confirmar e Vincular
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="sm:max-w-[400px] border-none shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-black uppercase tracking-tight">
                            Guichê de Atendimento
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-4 flex flex-col items-center">
                        <div className=" flex justify-center items-center gap-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Número do Guichê</Label>
                            <Select
                                value={session?.guiche}
                                onValueChange={(val) => setSession(prev => ({ ...prev, guiche: val }))}

                            >
                                <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Selecione o Guichê" />
                                </SelectTrigger>
                                <SelectContent>
                                    {["1", "2", "3"].map(n => (
                                        <SelectItem key={n} value={n}>Guichê {n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-center items-center gap-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Seu Nome</Label>
                            <Select
                                value={session?.nome}
                                onValueChange={(val) => setSession(prev => ({ ...prev, nome: val }))}
                            >
                                <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Selecione seu nome" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RECEPCIONISTAS.map(nome => (
                                        <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full h-12 bg-slate-900 hover:bg-blue-600" onClick={salvarSessao}>
                            Ativar Guichê
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}