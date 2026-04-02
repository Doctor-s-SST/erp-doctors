/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { FileEdit, CheckCircle2, RefreshCw, User, Monitor, XCircle, Filter, ArrowUpDown, Clock, PlusCircle, MonitorCheck, UploadCloud, Save, Building2, Stethoscope, BellRing, Loader2, X, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { on } from "events"

type Atendimento = {
    id: string;
    senha_codigo: string;
    tipo_senha: string;
    nome: string;
    ficha_sequencial: string;
    created_at: string;
    status: string;
    guiche: string;
    atendente: string;
    tempo_espera_min: number;
    ficha_preenchida: boolean;
    tem_exames: any[];
    sala_atual?: string | null
    num_sala?: string | null
    profissional?: string | null
}

type ConfigOrdenacao = {
    coluna: keyof Atendimento | 'tempo_espera'
    direcao: 'asc' | 'desc'
}

const RECEPCIONISTAS = ["Livia Noccioli", "Mariana Galvão", "Pietra Amaro", "Marcela Santos"]

export default function RecepcaoPage() {
    const [data, setData] = useState<Atendimento[]>([])
    const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")
    const [filtroPesquisa, setFiltroPesquisa] = useState("")
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [session, setSession] = useState<{ guiche?: string, nome?: string }>({})
    const [openModal, setOpenModal] = useState(false)
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({ coluna: 'tempo_espera', direcao: 'asc' })
    const generatingRef = useRef(false)
    const [exameInput, setExameInput] = useState("")
    const [finalizandoIds, setFinalizandoIds] = useState<Record<string, number>>({});


    // ESTADOS DO MODAL DE IMPORTAÇÃO
    const [importModal, setImportModal] = useState<{ open: boolean, item: Atendimento | null }>({ open: false, item: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [especialidades, setEspecialidades] = useState<any[]>([])
    const initialFormFicha = {
        sequencial: "",
        arquivo: null as File | null,
        empresa: { razao_social: "", cnpj: "" },
        funcionario: { nome: "", rg: "", nascimento: "", cargo: "", setor: "", cpf: "" },
        exame: { tipo: "" },
        exames: [] as Array<{ exame: string }>,
        especialidadesSelecionadas: [] as number[],
        observacao: ""
    }
    const [formFicha, setFormFicha] = useState(initialFormFicha)

    useEffect(() => {
        const fetchEspecialidades = async () => {
            const { data } = await supabase.from("especialidades").select("id, nome, exames(id, nome)");
            if (data) {
                const ordenadas = [...data].sort((a, b) => {
                    const nomeA = a.nome.toUpperCase();
                    const nomeB = b.nome.toUpperCase();

                    // Regra: Toxicológico sempre por último
                    if (nomeA.includes("TOXICOLOGICO") || nomeA.includes("TOXICOLÓGICO")) return 1;
                    if (nomeB.includes("TOXICOLOGICO") || nomeB.includes("TOXICOLÓGICO")) return -1;

                    // Restante em ordem alfabética
                    return nomeA.localeCompare(nomeB);
                });

                setEspecialidades(ordenadas);

                // const triagem = ordenadas.find(e => e.nome.toLowerCase().includes("triagem"));
            }
        }
        fetchEspecialidades();
    }, []);

    const formatarNome = (str: string) => {
        if (!str) return ""
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    const handleAddExameManual = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && exameInput.trim()) {
            e.preventDefault();
            const novoExame = { exame: exameInput.trim().toUpperCase() };
            setFormFicha(prev => ({
                ...prev,
                exames: [...prev.exames, novoExame]
            }));
            setExameInput("");
        }
    };

    const removeExame = (index: number) => {
        setFormFicha(prev => ({
            ...prev,
            exames: prev.exames.filter((_, i) => i !== index)
        }));
    };

    const updateNestedField = (category: string, field: string, value: string) => {
        setFormFicha(prev => ({
            ...prev,
            [category]: {
                ...((prev[category as keyof typeof prev] as object) || {}),
                [field]: value
            }
        }));
    };

    //user localStorage
    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();

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

        const statusTravados = ["CANCELADO", "FINALIZADO"];

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const styles: any = {
            "AGUARDANDO_RECEPCAO": "bg-slate-600 text-slate-100",
            "EM_FILA": "bg-amber-600 text-amber-100 animate-pulse",
            "EM_RECEPCAO": "bg-blue-600 text-blue-100 animate-pulse",
            "FINALIZADO": "bg-green-600 text-green-100",
            "CANCELADO": "bg-red-600 text-red-100",
            "NAO_ATENDIDO": "bg-orange-600 text-orange-100",
            "AGUARDANDO_EXAMES": "bg-green-600 text-green-100",
            "EM_AUDIOMETRIA": "bg-green-600 text-green-100",
            "EM_CLÍNICO": "bg-green-600 text-green-100",
            "EM_TRIAGEM": "bg-green-600 text-green-100",
            "EM_TOXICOLÓGICO": "bg-green-600 text-green-100",
            "EM_LABORATÓRIO": "bg-green-600 text-green-100",
            "EM_ECG_EEG_ESPIRO": "bg-green-600 text-green-100",
        }
        return <Badge className={`${styles[status] || 'bg-slate-100'} border-none text-[9px] font-black tracking-widest uppercase px-2`}>{(status) === "NAO_ATENDIDO" ? "NÃO ATENDIDO" : (status === "AGUARDANDO_RECEPCAO" ? "AGUARDANDO RECEPÇÃO" : (status === "EM_RECEPCAO" ? "EM RECEPÇÃO" : status.replace('_', ' ')))}</Badge>
    }

    const handleSort = (coluna: keyof Atendimento | 'tempo_espera') => {
        setOrdenacao(prev => ({
            coluna,
            direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc'
        }))
    }

    const dadosProcessados = useMemo(() => {
        let filtrados = data.filter(item =>
            filtroTipo === "TODOS" ? true : item.tipo_senha === filtroTipo
        );

        if (filtroPesquisa) {
            const f = filtroPesquisa.toLowerCase();

            filtrados = filtrados.filter(i =>
                i.nome && i.nome.toLowerCase().includes(f)
            );
        }


        return filtrados.sort((a, b) => {
            // 1. PRIORIDADE POR STATUS (Mantém EM_RECEPCAO no topo, etc)
            const pesoStatus = (status: string) => {
                switch (status) {
                    case "EM_RECEPCAO": return 1
                    case "EM_FILA": return 2
                    case "AGUARDANDO_RECEPCAO": return 3
                    case "NAO_ATENDIDO": return 4
                    case "AGUARDANDO_EXAMES": return 5
                    case "FINALIZADO": return 6
                    case "CANCELADO": return 7
                    default: return 8
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
    }, [data, filtroTipo, filtroPesquisa, ordenacao])

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
            toast.error("Usuário não autenticado")
        }
    }

    const formatarParaSQL = (dataStr: string) => {
        if (!dataStr || !dataStr.includes('/')) return dataStr;
        const [d, m, y] = dataStr.split('/');
        return `${y}-${m}-${d}`;
    };

    async function handleSalvarDadosFicha() {
        if (!importModal.item) return;
        setLoadingAction("saving_ficha");

        const idTriagem = especialidades.find(e =>
            e.nome.toLowerCase().includes("triagem")
        )?.id;

        const especialidadesFinal = idTriagem
            ? Array.from(new Set([idTriagem, ...formFicha.especialidadesSelecionadas]))
            : formFicha.especialidadesSelecionadas;

        const { error } = await supabase.rpc("registrar_dados_ficha", {
            p_atendimento_id: importModal.item.id,
            p_sequencial: formFicha.sequencial,
            p_paciente_nome: formFicha.funcionario.nome,
            p_paciente_cpf: formFicha.funcionario.cpf,
            p_paciente_nascimento: formatarParaSQL(formFicha.funcionario.nascimento),
            p_paciente_rg: formFicha.funcionario.rg,
            p_paciente_cargo: formFicha.funcionario.cargo,
            p_paciente_setor: formFicha.funcionario.setor,
            p_empresa_razao: formFicha.empresa.razao_social,
            p_empresa_cnpj: formFicha.empresa.cnpj,
            p_especialidades_ids: especialidadesFinal,
            p_exames_nomes: formFicha.exames,
            p_observacao: formFicha.observacao
        });

        if (error) {
            toast.error("Erro: " + error.message);
        } else {
            toast.success("Dados salvos com sucesso!");
            setImportModal({ open: false, item: null });
            fetchData();
        }
        setLoadingAction(null);
    }

    useEffect(() => {
        const normalizar = (txt: string) => txt?.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "") || "";

        // Encontra IDs de especialidades que dão match com os exames atuais
        const novosIdsMatch = especialidades
            .filter(esp =>
                formFicha.exames.some(exDigitado =>
                    esp.exames?.some((exBanco: { nome: string }) => normalizar(exBanco.nome) === normalizar(exDigitado.exame))
                )
            )
            .map(esp => esp.id);

        setFormFicha(prev => {
            // Une os que já estavam selecionados manualmente com os novos matches (sem duplicar)
            const totalSelecionados = Array.from(new Set([...prev.especialidadesSelecionadas, ...novosIdsMatch]));

            // Só atualiza se houver mudança real para evitar loop infinito
            if (JSON.stringify(totalSelecionados.sort()) !== JSON.stringify(prev.especialidadesSelecionadas.sort())) {
                return { ...prev, especialidadesSelecionadas: totalSelecionados };
            }
            return prev;
        });
    }, [formFicha.exames, especialidades]);

    const abrirModalImportacao = async (item: Atendimento) => {
        setLoadingAction("loading_edit");

        const { data: detalhes } = await supabase
            .from("atendimentos")
            .select(`
            *,
            pacientes (*)
        `)
            .eq("id", item.id)
            .single();

        const { data: examesAtendimento } = await supabase
            .from("atendimento_exames")
            .select("sala")
            .eq("atendimento_id", item.id);

        const idsSelecionados = especialidades
            .filter(esp => examesAtendimento?.some(e => e.sala === esp.nome))
            .map(esp => esp.id);

        const idTriagem = especialidades.find(e => e.nome.toLowerCase().includes("triagem"))?.id;

        const especialidadesFinal = idTriagem
            ? Array.from(new Set([idTriagem, ...idsSelecionados]))
            : idsSelecionados;

        if (detalhes) {
            setFormFicha({
                sequencial: detalhes.ficha_sequencial || 0,
                arquivo: null,
                empresa: {
                    razao_social: detalhes.pacientes?.empresa_razao || "",
                    cnpj: detalhes.pacientes?.empresa_cnpj || ""
                },
                funcionario: {
                    nome: detalhes.pacientes?.nome || item.nome || "",
                    rg: detalhes.pacientes?.rg || "",
                    nascimento: detalhes.pacientes?.data_nascimento || "",
                    cargo: detalhes.pacientes?.cargo || "",
                    setor: detalhes.pacientes?.setor || "",
                    cpf: detalhes.pacientes?.cpf || ""
                },
                exame: { tipo: "" },
                exames: detalhes.exames_list || [],
                especialidadesSelecionadas: especialidadesFinal,
                observacao: detalhes.observacao || ""
            });

        } else {
            setFormFicha(prev => ({
                ...initialFormFicha,
                especialidadesSelecionadas: idTriagem ? [idTriagem] : []
            }));
        }

        setImportModal({ open: true, item });
        setLoadingAction(null);
    };

    async function gerarSenha(tipo: "NORMAL" | "PREFERENCIAL") {
        if (generatingRef.current) return
        generatingRef.current = true
        setLoadingAction(tipo)
        try {
            const { error } = await supabase.rpc("gerar_senha", { tipo_param: tipo, guiche_param: session?.guiche || "0", atendente_param: session?.nome || "" })
            if (error) throw error
            toast.success(`Senha ${tipo} gerada!`)
            fetchData()
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            toast.error("Erro ao gerar senha")
        } finally {
            generatingRef.current = false
            setLoadingAction(null)
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function executarAcao(rpcName: string, params: any) {
        setLoadingAction(params.p_atendimento_id)
        const { error } = await supabase.rpc(rpcName, params)
        if (error) toast.error("Erro na operação")
        else { toast.success("Sucesso!"); fetchData() }
        setLoadingAction(null)
    }

    const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

    const cancelarFinalizacao = (id: string) => {
        if (timersRef.current[id]) {
            clearInterval(timersRef.current[id]);
            delete timersRef.current[id];
        }
        setFinalizandoIds(prev => {
            const { [id]: _, ...rest } = prev;
            return rest;
        });
    };

    const iniciarFinalizacaoComDelay = (id: string) => {
        const TEMPO_ESPERA = 10;
        const idsParaFinalizar = obterIdsConsolidados();

        setFinalizandoIds(prev => ({ ...prev, [id]: TEMPO_ESPERA }));

        const interval = setInterval(() => {
            setFinalizandoIds(prev => {
                const tempoAtual = prev[id];

                // Se o ID não está mais no estado (cancelado), limpa o intervalo
                if (tempoAtual === undefined) {
                    clearInterval(interval);
                    return prev;
                }

                if (tempoAtual <= 1) {
                    clearInterval(interval);
                    delete timersRef.current[id];

                    executarAcao("finalizar_recepcao", {
                        p_atendimento_id: id,
                        p_especialidades_ids: idsParaFinalizar
                    });

                    const { [id]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [id]: tempoAtual - 1 };
            });
        }, 1000);

        timersRef.current[id] = interval;
    };

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
            const data = dataArray[0];

            setFormFicha(prev => ({
                ...prev,
                sequencial: data.funcionario.ficha || prev.sequencial,

                empresa: {
                    razao_social: data.empresa?.razao_social || "",
                    cnpj: data.empresa?.cnpj || ""
                },

                funcionario: {
                    nome: formatarNome(data.funcionario?.nome) || "",
                    rg: data.funcionario?.rg || "",
                    nascimento: data.funcionario?.nascimento || "",
                    cargo: data.funcionario?.cargo || "",
                    setor: data.funcionario?.setor || "",
                    cpf: data.funcionario?.cpf || ""
                },

                exame: {
                    tipo: data.exame?.tipo || ""
                },

                exames: data.exames || []
            }))

            toast.success("Ficha identificada!", { id: toastId });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            toast.error("Erro ao ler PDF", { id: toastId });
        } finally {
            setLoadingAction(null);
        }
    };

    const obterIdsConsolidados = () => {
        return especialidades
            .filter(esp => {
                const normalizar = (txt: string) => txt.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");

                const isMatchedByDatabase = formFicha.exames.some(exDigitado =>
                    esp.exames?.some((exBanco: any) => normalizar(String(exBanco.nome)) === normalizar(String(exDigitado.exame)))
                );
                // const isTriagem = esp.nome.toLowerCase().includes("triagem");
                const isManual = formFicha.especialidadesSelecionadas.includes(esp.id);

                return isMatchedByDatabase || isManual;
            })
            .map(esp => esp.id);
    };

    const onFichaClick = (item: any) => {
        window.navigator.clipboard.writeText(item.ficha_sequencial || "--");
        toast.success("Ficha copiada: " + (item.ficha_sequencial || "--"))
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

                                            // Lógica de estados
                                            const isFinalizado = item.status === "FINALIZADO";
                                            const isNaoAtendido = item.status === "NAO_ATENDIDO";
                                            const isCancelado = item.status === "CANCELADO";
                                            const isAguardandoExames = item.status === "AGUARDANDO_EXAMES" || item.status === "EM_TRIAGEM" || item.status === "EM_CLÍNICO" || item.status === "EM_TOXICOLÓGICO" || item.status === "EM_LABORATÓRIO" || item.status === "EM_ECG_EEG_ESPIRO" || item.status === "EM_AUDIOMETRIA";
                                            const isAguardandoRecepcao = item.status === "AGUARDANDO_RECEPCAO";
                                            const isEncerrado = isFinalizado || isCancelado;

                                            // NOVIDADE: Verifica se a ficha já foi salva no banco
                                            const fichaPronta = item.ficha_preenchida || !!item.nome;

                                            // Estilização da Linha baseada no Status
                                            const rowStyles =
                                                isFinalizado
                                                    ? "bg-emerald-200/70 dark:bg-emerald-900/30"
                                                    : isCancelado
                                                        ? "bg-red-200/70 dark:bg-red-900/30"
                                                        : isAguardandoExames
                                                            ? "bg-green-200/30 dark:bg-green-900/30"
                                                            : isNaoAtendido
                                                                ? "bg-orange-200/70 dark:bg-orange-900/30"
                                                                : isAguardandoRecepcao
                                                                    ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                                                    : fichaPronta
                                                                        ? "bg-blue-50/30 dark:bg-blue-900/5"
                                                                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40";

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`${rowStyles} transition-all border-b border-slate-100 dark:border-slate-800`}
                                                >
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-lg font-black leading-none ${item.tipo_senha === "PREFERENCIAL" ? "text-orange-600" : "text-blue-600"}`}>
                                                                {item.senha_codigo}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">{item.tipo_senha}</span>
                                                        </div>
                                                    </td>

                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`${!item.nome ? "text-slate-400 italic" : "font-bold text-slate-700 dark:text-slate-200"}`}>
                                                                {item.nome || "Aguardando ficha..."}
                                                            </span>

                                                            {/* Feedback visual de que a ficha foi salva */}
                                                            {fichaPronta && !isEncerrado && (
                                                                <span title="Ficha Salva">
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                </span>
                                                            )}

                                                            {item.tem_exames && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Stethoscope className="w-3 h-3 text-emerald-500" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Exames já vinculados</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 text-[13px] font-bold font-mono cursor-pointer text-center" onClick={() => onFichaClick(item)}>
                                                        <span className="p-1 rounded bg-slate-500/20 hover:bg-slate-500/50 transition-all">{item.ficha_sequencial || "--"}</span>
                                                    </td>

                                                    <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">{getHora(item.created_at)}</td>

                                                    <td className={`p-4 font-bold ${isEncerrado ? "text-slate-400" : getColorTempoEspera(parseInt(tempo.texto), tempo.isCancelado)}`}>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3 opacity-70" />
                                                            {tempo.texto}
                                                        </div>
                                                    </td>

                                                    <td className="p-4 text-center">
                                                        {item.sala_atual == null ? (
                                                            getStatusBadge(item.status)
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1">
                                                                {getStatusBadge(item.status)}
                                                                <span className="text-[12px] font-bold text-slate-500">
                                                                    Sala: {item.sala_atual}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center font-black text-slate-700 dark:text-white">
                                                        {item.guiche || "--"}
                                                    </td>


                                                    <td className="p-4 text-right">
                                                        <div className="flex justify-end gap-1.5 items-center">
                                                            {!isEncerrado ? (
                                                                <>
                                                                    {item.status === "EM_FILA" && (
                                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                            <span className="text-[11px] font-medium italic">Aguardando chamada...</span>
                                                                        </div>
                                                                    )}

                                                                    {/* OPÇÕES DURANTE O ATENDIMENTO */}
                                                                    {item.status === "AGUARDANDO_RECEPCAO" && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-8 text-[11px] border-amber-600 text-amber-600 hover:bg-amber-50"
                                                                            onClick={() => executarAcao("gerenciar_chamada_recepcao", {
                                                                                p_atendimento_id: item.id,
                                                                                p_status: 'EM_FILA',
                                                                                p_guiche: item.guiche,
                                                                                p_atendente: item.atendente
                                                                            })}
                                                                            disabled={loadingAction === item.id}
                                                                        >
                                                                            <BellRing className="w-3 h-3 mr-1" />
                                                                            Chamar
                                                                        </Button>
                                                                    )}

                                                                    {/* OPÇÕES DURANTE O ATENDIMENTO */}
                                                                    {item.status === "EM_RECEPCAO" && (
                                                                        <>
                                                                            {finalizandoIds[item.id] ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    {/* BOTÃO COM CONTAGEM */}
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled
                                                                                        className="h-8 text-[11px] font-bold bg-slate-600 min-w-[90px] text-white"
                                                                                    >
                                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                        {finalizandoIds[item.id]}s
                                                                                    </Button>

                                                                                    {/* BOTÃO PARA CANCELAR A CONTAGEM */}
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
                                                                                // BOTÃO NORMAL
                                                                                <Button
                                                                                    size="sm"
                                                                                    disabled={!fichaPronta}
                                                                                    className={`h-8 text-[11px] font-bold ${fichaPronta ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300'
                                                                                        }`}
                                                                                    onClick={() => iniciarFinalizacaoComDelay(item.id)}
                                                                                >
                                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                                    Finalizar
                                                                                </Button>
                                                                            )}

                                                                            {!finalizandoIds[item.id] && (
                                                                                <>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="h-8 text-[11px] border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-muted dark:hover:text-white dark:hover:bg-blue-600 transition-colors"
                                                                                        onClick={() => executarAcao("gerenciar_chamada_recepcao", {
                                                                                            p_atendimento_id: item.id,
                                                                                            p_status: 'EM_FILA'
                                                                                        })}
                                                                                    >
                                                                                        <BellRing className="w-3 h-3 mr-1" />
                                                                                        Chamar Novamente
                                                                                    </Button>

                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        className="h-8 text-[11px] bg-orange-500/80 text-white hover:text-orange-500 border-orange-500/50 transition-colors dark:text-white/80"
                                                                                        onClick={() => executarAcao("gerenciar_chamada_recepcao", {
                                                                                            p_atendimento_id: item.id,
                                                                                            p_status: 'NAO_ATENDIDO'
                                                                                        })}
                                                                                    >
                                                                                        Não Atendido
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    )}

                                                                    {item.status === "NAO_ATENDIDO" && (
                                                                        <>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-8 text-[11px] border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-muted dark:hover:text-white dark:hover:bg-blue-600 transition-colors"
                                                                                onClick={() => executarAcao("gerenciar_chamada_recepcao", {
                                                                                    p_atendimento_id: item.id,
                                                                                    p_status: 'EM_FILA'
                                                                                })}
                                                                            >
                                                                                <BellRing className="w-3 h-3 mr-1" />
                                                                                Chamar Novamente
                                                                            </Button>
                                                                        </>
                                                                    )}

                                                                    {/* BOTÃO FICHA */}
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="secondary"
                                                                                    className={`h-8 w-8 p-0 ${fichaPronta ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'} ${fichaPronta ? "hover:bg-emerald-300" : "hover:bg-blue-300"} transition-colors`}
                                                                                    onClick={() => abrirModalImportacao(item)}
                                                                                >
                                                                                    <FileEdit className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>{fichaPronta ? "Editar" : "Importar"}</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>

                                                                    {/* BOTÃO CANCELAR */}
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    className="h-8 w-8 p-0 text-white hover:text-red-600 hover:border-red-500 bg-red-500"
                                                                                    onClick={() => {
                                                                                        if (confirm("Cancelar este atendimento?")) {
                                                                                            executarAcao("cancelar_atendimento", {
                                                                                                p_atendimento_id: item.id,
                                                                                            })
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Cancelar</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] font-bold uppercase italic ${isCancelado ? 'text-red-500' : 'text-slate-400'}`}>
                                                                        {isFinalizado ? "Atendido" : isCancelado ? "Cancelado" : "Não Atendido"}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* MODAL DE IMPORTAÇÃO DE FICHA */}
            <Dialog
                open={importModal.open}
                onOpenChange={(val) => {
                    setImportModal({ ...importModal, open: val });
                    if (!val) setFormFicha(initialFormFicha);
                }}
            >
                <DialogContent className="sm:max-w-200 bg-white dark:bg-slate-900 border-none shadow-2xl max-h-[95vh] overflow-y-auto p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                            <FileEdit className="w-6 h-6 text-blue-600" />
                            Cadastrar Ficha: <span className="text-blue-600">{importModal.item?.senha_codigo}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-8">
                        {/* 1. UPLOAD E BOTÃO DE IMPORTAÇÃO */}
                        <div className="relative group">
                            {loadingAction === "processing_pdf" && (
                                <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border-2 border-blue-500 border-dashed">
                                    <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                                    <p className="font-black text-blue-600 uppercase tracking-widest text-[10px]">Lendo PDF...</p>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/50 transition-all rounded-xl p-4 text-center relative cursor-pointer">
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleUploadPDF(e.target.files[0])}
                                />
                                <div className="flex items-center justify-center gap-3">
                                    <UploadCloud className="w-6 h-6 text-slate-400" />
                                    <p className="text-sm font-bold text-slate-500">
                                        {formFicha.arquivo?.name ?? "Importar PDF da Ficha (Preenchimento Automático)"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. DADOS DO FUNCIONÁRIO (FOCO PRINCIPAL) */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Dados do Funcionário</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Nome Completo</Label>
                                    <Input className="h-10 font-bold" value={formFicha.funcionario.nome} onChange={(e) => setFormFicha({ ...formFicha, funcionario: { ...formFicha.funcionario, nome: e.target.value } })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Nº Sequencial</Label>
                                    <Input className="h-10 font-black text-blue-600 text-center text-lg" value={formFicha.sequencial} onChange={(e) => setFormFicha({ ...formFicha, sequencial: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">CPF</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.cpf || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'cpf', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">RG</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.rg || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'rg', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Nascimento</Label>
                                    <Input
                                        className="h-9 text-center"
                                        value={formFicha.funcionario.nascimento || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'nascimento', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Cargo</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.cargo || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'cargo', e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400">Setor</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.setor || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'setor', e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* 3. DADOS DA EMPRESA E MÉDICO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Empresa</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold opacity-70">Razão Social</Label>
                                        <Input
                                            className="h-9"
                                            value={formFicha.empresa.razao_social || ""}
                                            onChange={(e) => updateNestedField('empresa', 'razao_social', e.target.value.toUpperCase())}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold opacity-70">CNPJ</Label>
                                        <Input
                                            className="h-9"
                                            value={formFicha.empresa.cnpj || ""}
                                            onChange={(e) => updateNestedField('empresa', 'cnpj', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Stethoscope className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Informações ASO</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold opacity-70">Tipo de Exame</Label>
                                        <Input
                                            className="h-9 font-bold text-blue-600"
                                            value={formFicha.exame.tipo || ""}
                                            onChange={(e) => updateNestedField('exame', 'tipo', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* 3.5 OBSERVAÇÕES DO ATENDIMENTO */}
                        <section className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 pb-2">
                                <BellRing className="w-4 h-4 text-amber-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Observações</h3>
                            </div>
                            <div className="space-y-1.5">
                                <textarea
                                    className="w-full min-h-[80px] p-3 text-sm font-medium dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={formFicha.observacao}
                                    onChange={(e) => setFormFicha({ ...formFicha, observacao: e.target.value })}
                                />
                            </div>
                        </section>

                        {/* 4. LANÇAMENTO DE EXAMES E ESPECIALIDADES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Exames do Prontuário</h4>
                                </div>
                                <Input
                                    placeholder="Adicionar exame manual..."
                                    className="h-10 border-slate-200"
                                    value={exameInput}
                                    onChange={(e) => setExameInput(e.target.value)}
                                    onKeyDown={handleAddExameManual}
                                />
                                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl min-h-25 align-top">
                                    {formFicha.exames.map((ex, i) => (
                                        <Badge
                                            key={i}
                                            className="bg-white dark:bg-slate-700 text-slate-700 border border-slate-200 font-bold py-1 px-2 flex items-center gap-2"
                                        >
                                            {ex.exame.toUpperCase()}
                                            <Button onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                removeExame(i);
                                            }}
                                                className="cursor-pointer text-slate-400 hover:text-red-500 transition-colors bg-transparent p-0">

                                                <XCircle
                                                    className="w-3 h-3"
                                                />
                                            </Button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Destinos de Atendimento</h4>
                                </div>
                                <div className="bg-slate-50 h-fit dark:bg-slate-800/50 border border-slate-100 rounded-xl p-3 h-38.75 overflow-y-auto space-y-1">
                                    {especialidades.map((esp) => {
                                        // Verifica se esta especialidade deve estar marcada (está no estado)
                                        const isChecked = formFicha.especialidadesSelecionadas.includes(esp.id);

                                        return (
                                            <label key={esp.id} className={`flex items-center justify-between p-2 rounded-md transition-all cursor-pointer ${isChecked ? 'bg-blue-100/50 dark:bg-blue-900/30' : 'opacity-50 hover:opacity-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        className="w-3.5 h-3.5"
                                                        onChange={(e) => {
                                                            setFormFicha(prev => ({
                                                                ...prev,
                                                                especialidadesSelecionadas: e.target.checked
                                                                    ? [...prev.especialidadesSelecionadas, esp.id]
                                                                    : prev.especialidadesSelecionadas.filter(id => id !== esp.id)
                                                            }))
                                                        }}
                                                    />
                                                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{esp.nome}</span>
                                                </div>
                                                {isChecked && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                            onClick={handleSalvarDadosFicha}
                            disabled={loadingAction === "saving_ficha" || !formFicha.funcionario.nome}
                        >
                            {loadingAction === "saving_ficha" ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            Salvar Ficha de Atendimento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            {/* MODAL DE GUICHÊ */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="sm:max-w-100 border-none shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="space-y-4">
                        <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mx-auto"><MonitorCheck className="w-8 h-8 text-emerald-500" /></div>
                        <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Guichê de Atendimento</DialogTitle>
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
                    <DialogFooter className="bg-slate-800">
                        <Button className="w-full h-12 text-muted bg-slate-900 dark:bg-blue-600 dark:hover:bg-blue-400 hover:bg-blue-600" onClick={salvarSessao}>
                            Ativar Guichê
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
