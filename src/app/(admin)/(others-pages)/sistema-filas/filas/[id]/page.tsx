"use client"

import { useEffect, useState, useMemo, useRef } from "react"
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
    BellRing,
    Search,
    MessageSquare,
    Filter,
    Loader2,
    X
} from "lucide-react"
import { is } from "zod/v4/locales"

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
    const [filtroPesquisa, setFiltroPesquisa] = useState("")
    const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")
    const [listaGlobalExames, setListaGlobalExames] = useState<any[]>([]);
    const [finalizandoIds, setFinalizandoIds] = useState<Record<string, number>>({});


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

    const getStatusStyles = (item: ItemFila) => {
        let isMinhaSala = false;
        if ((item.num_sala === session?.sala) && (item.profissional === session?.profissional)) {
            isMinhaSala = true
        }
        console.log("Item:", item, "Minha Sala?", isMinhaSala)

        if (item.status_atendimento.startsWith('EM_') && item.status === "EM_FILA") {
            return {
                color: isMinhaSala ? "text-emerald-600" : "text-blue-600",
                bg: isMinhaSala ? "bg-emerald-500/10" : "bg-blue-500/10",
                label: isMinhaSala ? "EM FILA" : "BLOQUEADO",
                animate: isMinhaSala ? "animate-pulse" : "",
                podeAcoes: isMinhaSala
            }
        }

        if (item.bloqueado || item.status_atendimento.startsWith('EM_') && item.status === "EM_ATENDIMENTO") {
            return {
                color: isMinhaSala ? "text-orange-600" : "text-red-600",
                bg: isMinhaSala ? "bg-orange-500/10" : "bg-red-500/10",
                label: isMinhaSala ? "ATENDENDO" : "BLOQUEADO",
                animate: isMinhaSala ? "animate-pulse" : "",
                podeAcoes: isMinhaSala
            }
        }

        // 3. Status Finalizado
        if (item.status === "FINALIZADO") {
            return { color: "text-green-100", bg: "bg-green-600", label: "FINALIZADO", podeAcoes: false }
        }

        // 4. Padrão: AGUARDANDO (Disponível para chamar)
        return {
            color: "text-blue-600",
            bg: "bg-blue-500/10",
            label: "AGUARDANDO",
            podeAcoes: true
        }
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
            const { data: result } = await supabase.rpc("get_fila_especialidade", {
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
        const fetchExames = async () => {
            const { data } = await supabase.from('exames').select('*');
            if (data) setListaGlobalExames(data);
        };
        fetchExames();


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

    const normalizar = (texto: string) =>
        texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

    const obterTempoExecucao = async (item: ItemFila) => {
        const { data: atendimentoCompleto } = await supabase
            .from('atendimentos')
            .select('exames_list')
            .eq('id', item.atendimento_id)
            .single();

        if (!atendimentoCompleto) return 20;

        const nomesExamesNormalizados = atendimentoCompleto.exames_list.map((e: any) =>
            normalizar(e.exame)
        );

        const examesDaEspecialidade = listaGlobalExames.filter(ex =>
            ex.especialidade_id === id
        );

        const dadosExame = examesDaEspecialidade.find(ex =>
            nomesExamesNormalizados.includes(normalizar(ex.nome))
        );

        return dadosExame?.tempo_execucao_segundos || 20;
    };

    async function executarAcao(rpcName: string, params: any) {
        setLoadingAction(params.p_atendimento_id);

        const { error } = await supabase.rpc(rpcName, params);

        if (error) {
            toast.error("Erro na operação: " + error.message);
        } else {
            toast.success("Sucesso!");
            fetchFila();
        }
        setLoadingAction(null);
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
        let lista = showToxicologico ? [...data, ...dataTox] : [...data];

        // Remove duplicatas
        lista = Array.from(new Map(lista.map(item => [item.id, item])).values());

        // Aplicar Filtro
        if (filtroTipo !== "TODOS") {
            lista = lista.filter(i => i.tipo_senha === filtroTipo)
        }

        if (filtroPesquisa) {
            const f = filtroPesquisa.toLowerCase();
            lista = lista.filter(i =>
                i.nome.toLowerCase().includes(f)
            );
        }

        return lista.sort((a, b) => {
            const pesoStatus = (item: ItemFila) => {
                if (item.status === "EM_ATENDIMENTO") return 1;
                if (item.status === "AGUARDANDO") return 2;
                return 3;
            };
            const pA = pesoStatus(a);
            const pB = pesoStatus(b);
            if (pA !== pB) return pA - pB;

            return ordenacao.direcao === 'asc'
                ? getTempoEsperaTotal(a) - getTempoEsperaTotal(b)
                : getTempoEsperaTotal(b) - getTempoEsperaTotal(a);
        })
    }, [data, dataTox, showToxicologico, ordenacao, filtroPesquisa, filtroTipo])

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

    const timersRef = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});

    const cancelarFinalizacao = (id: string) => {
        const timer = timersRef.current[id];

        if (timer) {
            clearInterval(timer);
            delete timersRef.current[id];
        }

        setFinalizandoIds(prev => {
            const novo = { ...prev };
            delete novo[id];
            return novo;
        });

        toast.warning("Finalização cancelada");
    };

    const iniciarFinalizacao = async (item: ItemFila) => {
        const tempo = await obterTempoExecucao(item);

        setFinalizandoIds(prev => ({
            ...prev,
            [item.id]: tempo
        }));

        const interval = setInterval(() => {
            setFinalizandoIds(prev => {
                const atual = prev[item.id];

                if (atual === undefined) {
                    clearInterval(interval);
                    return prev;
                }

                if (atual <= 1) {
                    clearInterval(interval);
                    delete timersRef.current[item.id];

                    executarAcao("finalizar_especialidade", {
                        p_atendimento_id: item.atendimento_id,
                        p_atendimento_exame_id: item.id,
                        p_sala: especialidadeNome,
                        p_num_sala: session.sala,
                    });

                    const novo = { ...prev };
                    delete novo[item.id];
                    return novo;
                }

                return {
                    ...prev,
                    [item.id]: atual - 1
                };
            });
        }, 1000);

        timersRef.current[item.id] = interval;
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

                {/* CONTROLES E FILTRO */}
                <div className="flex items-center justify-center gap-3">
                    <div className="w-full flex gap-3">
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <div className="flex gap-2">
                                {["TODOS", "NORMAL", "PREFERENCIAL"].map((tipo) => (
                                    <Button
                                        key={tipo}
                                        variant={filtroTipo === tipo ? "default" : "outline"}
                                        size="sm"
                                        className={`h-8 text-[10px] font-black uppercase tracking-widest ${filtroTipo === tipo
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-transparent text-slate-500 border-slate-200'
                                            }`}
                                        onClick={() => setFiltroTipo(tipo)}
                                    >
                                        {tipo}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <Search className="w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome..."
                                className="w-80"
                                value={filtroPesquisa}
                                onChange={(e) => setFiltroPesquisa(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={fetchFila} disabled={isRefreshing} variant="outline" className="h-12 bg-white dark:bg-slate-900 p-2 px-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <RefreshCw className={`w-3 h-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
                        </Button>
                        {especialidadeNome === "Triagem" && (
                            <Button onClick={() => setShowToxicologico(!showToxicologico)} variant={showToxicologico ? "default" : "outline"} className={`h-10 text-[10px] font-black uppercase ${showToxicologico ? 'bg-orange-600' : ''}`}>
                                <Beaker className="w-3 h-3 mr-2" /> Toxicológico
                            </Button>
                        )}
                    </div>

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
                                        <ThOrdenavel label="Observação" coluna="observacao" />
                                        <th className="text-right p-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {dadosProcessados.map((item) => {
                                        const styles = getStatusStyles(item);
                                        // const waitTime = getTempoEsperaTotal(item);

                                        const isFinalizado = item.status === "FINALIZADO"
                                        const isCancelado = item.status === "CANCELADO"
                                        const isNaoAtendido = item.status === "NAO_ATENDIDO"
                                        const isBloqueado = item.bloqueado || styles.label === "BLOQUEADO"
                                        const isEncerrado = isFinalizado || isCancelado

                                        const rowStyles =
                                            isFinalizado
                                                ? "bg-emerald-200/70 dark:bg-emerald-900/30"
                                                : isCancelado
                                                    ? "bg-red-200/70 dark:bg-red-900/30"
                                                    : isNaoAtendido
                                                        ? "bg-orange-200/70 dark:bg-orange-900/30"
                                                        : isBloqueado
                                                            ? "bg-red-200/70 dark:bg-red-900/30" :
                                                            "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"

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
                                                    {isFinalizado ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant="destructive" className={`uppercase bg-green-600 text-green-100 border-none text-[10px] font-bold tracking-wider`}>
                                                                Finalizado
                                                            </Badge>
                                                            <span className="text-[11px] font-bold">{`${item.sala_atual} (Sala ${item.num_sala})`}</span>
                                                        </div>

                                                    ) : isBloqueado ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant="destructive" className={`uppercase ${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider ${styles.animate || ""}`}>
                                                                {styles.label}
                                                            </Badge>
                                                            <span className="text-[11px] font-bold">{`${item.sala_atual} (Sala ${item.num_sala})`}</span>
                                                        </div>
                                                    ) : (
                                                        <Badge
                                                            className={`${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider ${styles.animate || ""}`}
                                                        >
                                                            {styles.label}
                                                        </Badge>
                                                    )}
                                                </td>

                                                {/* CAMPO OBSERVAÇÃO */}
                                                <td className="p-4 text-slate-500 italic max-w-50 truncate">
                                                    {item.observacao ? (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger className="flex items-center gap-1">
                                                                    <MessageSquare className="w-3 h-3" /> {item.observacao}
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-xs">{item.observacao}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : ""}
                                                </td>

                                                {/* AÇÕES */}
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1.5 items-center">
                                                        {!isEncerrado ? (
                                                            <>
                                                                {item.status === "AGUARDANDO" && !isBloqueado && (
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

                                                                {item.status === "EM_ATENDIMENTO" && !isBloqueado && (
                                                                    <>
                                                                        {finalizandoIds[item.id] ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    disabled
                                                                                    className="h-8 text-[11px] font-bold bg-slate-600 min-w-[90px] text-white"
                                                                                >
                                                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                    {finalizandoIds[item.id]}s
                                                                                </Button>

                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="destructive"
                                                                                                className="h-8 w-8 p-0"
                                                                                                onClick={() => cancelarFinalizacao(item.id)}
                                                                                            >
                                                                                                <X className="w-4 h-4" />
                                                                                            </Button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>Interromper finalização</TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                                                                onClick={() => iniciarFinalizacao(item)}
                                                                            >
                                                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                Finalizar
                                                                            </Button>
                                                                        )}

                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 text-[11px] border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                                            onClick={() =>
                                                                                executarAcao("chamar_paciente", {
                                                                                    p_atendimento_id: item.atendimento_id,
                                                                                    p_atendimento_exame_id: item.id,
                                                                                    p_sala: especialidadeNome,
                                                                                    p_num_sala: session.sala,
                                                                                    p_profissional: session.profissional,
                                                                                })
                                                                            }
                                                                        >
                                                                            <BellRing className="w-3 h-3 mr-1" />
                                                                            Chamar Novamente
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {item.status !== "AGUARDANDO" && !isBloqueado && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 text-[11px] bg-orange-600 font-bold text-white hover:text-orange-500 border-orange-500/50 transition-colors dark:text-white/80"
                                                                        onClick={() => executarAcao("nao_atendido_especialidade", {
                                                                            p_atendimento_id: item.atendimento_id,
                                                                            p_atendimento_exame_id: item.id
                                                                        })}
                                                                    >
                                                                        Não Atendido
                                                                    </Button>
                                                                )}

                                                                {isBloqueado && (
                                                                    <Badge
                                                                        className={`${styles.bg} ${styles.color} border-none text-[10px] uppercase font-bold tracking-wider ${styles.animate || ""}`}
                                                                    >
                                                                        Atendimento Bloqueado
                                                                    </Badge>
                                                                )}
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