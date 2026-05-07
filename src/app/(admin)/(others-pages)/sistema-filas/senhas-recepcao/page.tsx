/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useRef, useMemo, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FileEdit, CheckCircle2, RefreshCw, User, Monitor, XCircle, Filter, ArrowUpDown, Clock, PlusCircle, MonitorCheck, UploadCloud, Save, Building2, Stethoscope, BellRing, Loader2, X, Search, Printer, Plus, ClipboardPlus, ClipboardList, Activity } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useReactToPrint } from "react-to-print";
import { TemplateFicha } from "@/components/atendimento/ficha-impressao/TemplateFicha";
import { StatusSenhaRecep } from "@/components/atendimento/status-senha-recep/StatusSenhaRecep"
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
    tipo_exame: string
    // unidadeId: string
    encaixe: boolean
}

type ConfigOrdenacao = {
    coluna: keyof Atendimento | 'tempo_espera'
    direcao: 'asc' | 'desc'
}

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
    const [especialidadesAuto, setEspecialidadesAuto] = useState<number[]>([]);
    const [especialidadesManual, setEspecialidadesManual] = useState<number[]>([]);
    const [recepcionistas, setRecepcionistas] = useState<{ id: string; nome: string }[]>([])
    const [loadingRecepcionistas, setLoadingRecepcionistas] = useState(true)
    const componentRef = useRef<HTMLDivElement>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [selectedAtendimento, setSelectedAtendimento] = useState<Atendimento | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [unidadeId, setUnidadeId] = useState<string | null>(null);
    const [unidadeNome, setUnidadeNome] = useState<string>("");

    // Este estado serve apenas para forçar o componente a atualizar a cada minuto
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setTick((prev) => prev + 1);
        }, 30000);

        return () => clearInterval(timer);
    }, []);

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
        observacao: "",
        encaixe: false
    }
    const [formFicha, setFormFicha] = useState(initialFormFicha)

    useEffect(() => {
        // Se não tivermos unidadeId ainda, não buscamos profissionais
        // (Pois recepcionistas são específicos de cada unidade)
        if (!unidadeId) return;

        const fetchEspecialidades = async () => {
            // Se suas especialidades forem globais, mantenha sem o .eq('unidade_id')
            // Se elas mudarem por unidade, adicione o .eq("unidade_id", unidadeId)
            const { data } = await supabase
                .from("especialidades")
                .select("id, nome, exames(id, nome)")
                .eq("unidade_id", unidadeId);

            if (data) {
                const ordenadas = [...data].sort((a, b) => {
                    const nomeA = a.nome.toUpperCase();
                    const nomeB = b.nome.toUpperCase();

                    // Regra: Toxicológico sempre por último
                    if (nomeA.includes("TOXICOLOGICO") || nomeA.includes("TOXICOLÓGICO")) return 1;
                    if (nomeB.includes("TOXICOLOGICO") || nomeB.includes("TOXICOLÓGICO")) return -1;

                    return nomeA.localeCompare(nomeB);
                });

                setEspecialidades(ordenadas);
            }
        };

        const fetchRecepcionistas = async () => {
            setLoadingRecepcionistas(true);
            try {
                const { data, error } = await supabase
                    .from("profissionais")
                    .select("id, nome")
                    .eq("recepcao", true)
                    .eq("unidade_id", unidadeId)
                    .order("nome");

                if (error) throw error;
                setRecepcionistas(data || []);
            } catch (err) {
            } finally {
                setLoadingRecepcionistas(false);
            }
        };

        fetchEspecialidades();
        fetchRecepcionistas();

    }, [unidadeId]); // <--- O efeito reage à mudança da unidade

    const formatarNome = (str: string) => {
        if (!str) return ""
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    const sugestoesExames = useMemo(() => {
        const lista: string[] = [];
        especialidades.forEach(esp => {
            esp.exames?.forEach((ex: any) => {
                if (!lista.includes(ex.nome.toUpperCase())) {
                    lista.push(ex.nome.toUpperCase());
                }
            });
        });
        return lista.sort();
    }, [especialidades]);

    const handleAddExameManual = (nomeExame: string) => {
        const nomeFormatado = nomeExame.trim().toUpperCase();

        // Verifica se o exame já está na lista para não duplicar
        const jaExiste = formFicha.exames.some(ex => ex.exame.toUpperCase() === nomeFormatado);

        if (nomeFormatado && !jaExiste) {
            setFormFicha(prev => ({
                ...prev,
                exames: [...prev.exames, { exame: nomeFormatado }]
            }));
        }
        setExameInput("");
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
    // 1. Efeito para carregar o usuário e a Unidade
    useEffect(() => {
        const initialize = async () => {
            setData([]); // Limpeza inicial
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // 1. Busca Profile com Unidade (JOIN) e Role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select(`
                    role, 
                    unidade_id,
                    unidades (flag)
                `)
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    let idFinal = profile.unidade_id;

                    // 2. Lógica de Admin (igual à ConfiguracoesPage)
                    // if (profile.role === 'admin') {
                    //     const unidadeSessao = localStorage.getItem('unidade_ativa_id');
                    //     if (unidadeSessao) {
                    //         idFinal = unidadeSessao;
                    //         // Se mudou a unidade, precisamos buscar o nome dela novamente 
                    //         // ou você pode salvar o nome no storage também.
                    //     }
                    // }

                    setUnidadeId(idFinal);
                    setUnidadeNome((profile.unidades as any)?.flag || "");

                    // 3. Gerenciamento da Sessão de Guichê
                    const userKey = `recepcao_session_${user.id}`;
                    const saved = localStorage.getItem(userKey);

                    if (saved) {
                        const parsedSession = JSON.parse(saved);
                        // Se a unidade da sessão for diferente da unidade ativa, reseta guichê
                        if (parsedSession.unidadeId !== idFinal) {
                            localStorage.removeItem(userKey);
                            setSession({ guiche: "", nome: "" });
                            setOpenModal(true);
                        } else {
                            setSession(parsedSession);
                            setOpenModal(false);
                        }
                    } else {
                        setOpenModal(true);
                    }

                    // 4. Primeiro fetch de dados
                    fetchData(idFinal);
                }
            }
        };

        initialize();
    }, []); // Roda apenas no mount da página

    // 2. Efeito para buscar dados do painel (Depende do unidadeId)
    // useEffect(() => {
    //     if (!unidadeId) return;

    //     fetchData(); // Busca imediata
    //     const interval = setInterval(fetchData, 5000); // Polling

    //     return () => clearInterval(interval);
    // }, [unidadeId]); // <--- Roda sempre que o unidadeId for definido ou mudar


    const getTempoEsperaEvolutivo = (item: any) => {
        if (!item.created_at) return { texto: "--", isCancelado: false };

        const isCancelado = item.status === "CANCELADO";
        const isFinalizado = item.status === "FINALIZADO";

        // 1. TRAVA: Se já encerrou, não calcula mais nada. Usa o dado do banco.
        if (isFinalizado || isCancelado) {
            const tempoBanco = item.tempo_espera_min ?? item.tempo_espera ?? 0;
            return {
                texto: `${tempoBanco} min`,
                isCancelado: isCancelado
            };
        }

        // 2. DINÂMICO: Se ainda está em aberto, calcula a diferença agora.
        // Como o 'tick' lá em cima muda a cada minuto, esta parte será re-executada.
        const dataCriacao = new Date(item.created_at).getTime();
        const agora = Date.now();
        const diffMs = agora - dataCriacao;
        const min = Math.max(0, Math.floor(diffMs / 1000 / 60));

        return {
            texto: `${min} min`,
            isCancelado: false
        };
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
            "AGUARDANDO_RECEPCAO": "bg-gray-600 text-gray-100",
            "EM_FILA": "bg-amber-600 text-amber-100 animate-pulse",
            "EM_RECEPCAO": "bg-blue-600 text-blue-100 animate-pulse",
            "FINALIZADO": "bg-green-600 text-green-100",
            "CANCELADO": "bg-red-600 text-red-100",
            "NAO_ATENDIDO": "bg-orange-600 text-orange-100",
            "AGUARDANDO_EXAMES": "bg-green-600 text-green-100",

        }
        return <Badge className={`${styles[status] || 'bg-green-600'} border-none text-[9px] font-black tracking-widest uppercase px-2`}>{(status) === "NAO_ATENDIDO" ? "NÃO ATENDIDO" : (status === "AGUARDANDO_RECEPCAO" ? "AGUARDANDO RECEPÇÃO" : (status === "EM_RECEPCAO" ? "EM RECEPÇÃO" : status.replace('_', ' ')))}</Badge>
    }

    const handleSort = (coluna: keyof Atendimento | 'tempo_espera') => {
        setOrdenacao(prev => ({
            coluna,
            direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc'
        }))
    }

    const dadosProcessados = useMemo(() => {
        // 1. Filtros iniciais
        // 1. Filtros iniciais
        let filtrados = data.filter(item => {
            if (filtroTipo === "TODOS") return true;

            // Se o botão clicado for ENCAIXE, filtra estritamente por ele
            if (filtroTipo === "ENCAIXE") return item.encaixe === true;

            // Se for NORMAL ou PREFERENCIAL, filtra pelo tipo_senha
            return item.tipo_senha === filtroTipo;
        });

        if (filtroPesquisa) {
            const f = filtroPesquisa.toLowerCase();
            filtrados = filtrados.filter(i =>
                i.nome && i.nome.toLowerCase().includes(f)
            );
        }

        // 2. Lógica de Ordenação
        return filtrados.sort((a, b) => {
            // Função para definir pesos de status
            const pesoStatus = (item: Atendimento) => {
                switch (item.status) {
                    case "EM_RECEPCAO": return 1;
                    case "EM_FILA": return 2;
                    case "AGUARDANDO_RECEPCAO": return 3;
                    case "NAO_ATENDIDO": return 4;
                    case "AGUARDANDO_EXAMES": return 5;
                    case "FINALIZADO": return 9;
                    case "CANCELADO": return 10;
                    default: return 7;
                }
            };

            // SE a ordenação for 'tempo_espera' (padrão), mantemos o agrupamento por status.
            // SE o usuário clicou em qualquer outra coluna (Nome, Senha, etc), a coluna vira PRIORIDADE.
            const isOrdenacaoManual = ordenacao.coluna !== 'tempo_espera';

            if (!isOrdenacaoManual) {
                const pA = pesoStatus(a);
                const pB = pesoStatus(b);
                if (pA !== pB) return pA - pB;
            }

            // Lógica de comparação de valores da coluna selecionada
            let valA: any, valB: any;

            if (ordenacao.coluna === 'tempo_espera' || ordenacao.coluna === 'created_at') {
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
            } else {
                // Garantimos tratamento de strings e nulos
                valA = a[ordenacao.coluna as keyof Atendimento] ?? '';
                valB = b[ordenacao.coluna as keyof Atendimento] ?? '';

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
            }

            // Executa a comparação
            let resultado = 0;
            if (typeof valA === 'string' && typeof valB === 'string') {
                resultado = valA.localeCompare(valB, 'pt-BR', { numeric: true });
            } else {
                if (valA < valB) resultado = -1;
                else if (valA > valB) resultado = 1;
            }

            // Aplica a direção (asc/desc)
            const finalComp = ordenacao.direcao === 'asc' ? resultado : -resultado;

            // Se os valores da coluna forem iguais (empate), usamos o peso do status como desempate final
            if (finalComp === 0) {
                return pesoStatus(a) - pesoStatus(b);
            }

            return finalComp;
        });
    }, [data, filtroTipo, filtroPesquisa, ordenacao, unidadeId]);

    async function fetchData(idForcado?: string) {
        const idParaBuscar = idForcado || unidadeId;

        // Se não tiver ID e não for forçado, não faz nada
        if (!idParaBuscar) return;

        const { data: result, error } = await supabase.rpc("get_painel_recepcao", {
            p_unidade_id: idParaBuscar
        });

        if (!error && result) {
            setData(result);
        }
    }

    useEffect(() => {
        if (!unidadeId) return;

        fetchData();
        const interval = setInterval(() => {
            fetchData(unidadeId);
        }, 3000);

        return () => clearInterval(interval);
    }, [unidadeId]);

    async function salvarSessao() {
        if (!session?.guiche || !session?.nome) return toast.warning("Preencha todos os campos")

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            // Incluímos o unidadeId explicitamente na sessão salva
            const sessionData = { ...session, unidadeId: unidadeId };
            const userKey = `recepcao_session_${user.id}`
            localStorage.setItem(userKey, JSON.stringify(sessionData))
            setOpenModal(false)
            setData([]); // Limpa a lista da unidade anterior
            // setUnidadeId(novaUnidade);
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
            p_especialidades_ids: especialidadesSelecionadas,
            p_exames_nomes: formFicha.exames,
            p_observacao: formFicha.observacao,
            p_unidade_id: unidadeId,
            p_encaixe: formFicha.encaixe,
            p_tipo_exame: formFicha.exame.tipo
        });

        if (error) {
            toast.error("Erro: " + error.message);
        } else {
            toast.success("Dados salvos com sucesso!");
            setImportModal({ open: false, item: null });
            fetchData();
        }
        setLoadingAction(null);
        handlePrint();
    }

    useEffect(() => {
        const normalizar = (txt: string) =>
            txt?.toLowerCase().trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\./g, "") || "";

        const novosIdsMatch = especialidades
            .filter(esp =>
                formFicha.exames.some(exDigitado =>
                    esp.exames?.some((exBanco: { nome: string }) =>
                        normalizar(exBanco.nome) === normalizar(exDigitado.exame)
                    )
                )
            )
            .map(esp => esp.id);

        setEspecialidadesAuto(novosIdsMatch);

    }, [formFicha.exames, especialidades]);

    const getIdTriagem = () => {
        return especialidades.find(e =>
            e.nome.toLowerCase().includes("triagem")
        )?.id;
    };

    const especialidadesSelecionadas = useMemo(() => {
        return Array.from(new Set([
            ...especialidadesAuto,
            ...especialidadesManual
        ]));
    }, [especialidadesAuto, especialidadesManual]);

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

        setEspecialidadesAuto([]);
        setEspecialidadesManual(especialidadesFinal);

        if (detalhes) {
            setEspecialidadesAuto([]);
            setEspecialidadesManual(especialidadesFinal);

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
                exame: { tipo: detalhes.tipo_exame || "" },
                exames: detalhes.exames_list || [],
                especialidadesSelecionadas: [],
                observacao: detalhes.observacao || "",
                encaixe: detalhes.encaixe
            });
        } else {
            const idTriagem = getIdTriagem();

            setFormFicha(initialFormFicha);

            setEspecialidadesAuto([]);
            setEspecialidadesManual(idTriagem ? [idTriagem] : []);
        }

        setImportModal({ open: true, item });
        setLoadingAction(null);
    };


    async function gerarSenha(tipo: "NORMAL" | "PREFERENCIAL") {
        if (generatingRef.current) return;
        generatingRef.current = true;
        setLoadingAction(tipo);

        try {
            console.log("Session", session)
            const { data: senhaGerada, error } = await supabase.rpc("gerar_senha", {
                tipo_param: tipo,
                guiche_param: session?.guiche || "0",
                atendente_param: session?.nome || "",
                unidade_param: unidadeId
            });

            if (error) throw error;

            toast.success(`Senha ${senhaGerada} gerada!`);
            fetchData();

        } catch (err) {
            toast.error("Erro ao gerar senha");
        } finally {
            generatingRef.current = false;
            setLoadingAction(null);
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

    const iniciarFinalizacaoComDelay = (id: string, encaixe: boolean) => {
        const TEMPO_ESPERA = encaixe ? 1800 : 30; // 🔥 30min ou 30s

        const idsParaFinalizar = obterIdsConsolidados();

        setFinalizandoIds(prev => ({ ...prev, [id]: TEMPO_ESPERA }));

        const interval = setInterval(() => {
            setFinalizandoIds(prev => {
                const tempoAtual = prev[id];

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
            className={`text-left p-4 font-black uppercase tracking-[0.15em] text-[9px] cursor-pointer transition-colors ${ordenacao.coluna === coluna ? 'text-blue-500' : 'hover:text-blue-500'}`}
            onClick={() => handleSort(coluna)}
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`w-3 h-3 ${ordenacao.coluna === coluna ? 'opacity-100' : 'opacity-50'}`} />
            </div>
        </th>
    )

    const handleUploadPDF = async (file: File) => {
        setLoadingAction("processing_pdf");
        const toastId = toast.loading("Validando exames...");

        try {
            // 1. Busca oficial
            const { data: examesCadastrados, error: dbError } = await supabase
                .from("exames")
                .select("nome");

            if (dbError) throw dbError;

            // Função auxiliar para remover acentos e normalizar
            const normalizar = (str: string) =>
                str.normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                    .trim()
                    .toUpperCase();

            // Criamos o Set com os nomes do BANCO normalizados
            const listaOficialNormalizada = new Set(
                examesCadastrados.map(e => normalizar(e.nome))
            );

            // 2. Processamento do PDF
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/importar-ficha", { method: "POST", body: formData });
            const dataArray = await response.json();
            const data = dataArray[0];

            const hoje = new Date().toLocaleDateString("pt-BR");

            // 3. Filtragem com normalização temporária
            const examesFiltrados = (data.exames || []).filter((ex: any) => {
                // Normaliza o que veio do PDF para comparar
                const nomeExamePDF = normalizar(ex.exame || "");

                const existeNoBanco = listaOficialNormalizada.has(nomeExamePDF);
                const dataValida = !ex.data || ex.data === hoje;

                return existeNoBanco && dataValida;
            });

            // 4. Update State (Mantendo os dados originais do PDF no estado)
            setFormFicha(prev => ({
                ...prev,
                sequencial: data.funcionario?.ficha || prev.sequencial,
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
                exames: examesFiltrados
            }));

            toast.success("Ficha processada com sucesso!", { id: toastId });

        } catch (error: any) {
            toast.error("Falha na importação", { id: toastId });
        } finally {
            setLoadingAction(null);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Ficha_${formFicha.sequencial}`,
    });

    useEffect(() => {

        async function getRole() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (data && !error) {
                    setUserRole(data.role);
                } else {
                    setUserRole("user");
                }
            }
        }
        getRole();
    }, []);

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
            <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
                <div className="w-full mx-auto space-y-5">

                    {/* HEADER RECEPCAO */}
                    <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl">
                                <Monitor className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Chamada de Senhas - Recepção</h1>
                                <p className="text-gray-400 text-[11px] font-bold tracking-[0.2em]">{new Date().toLocaleDateString("pt-BR")}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-800/40 p-2 rounded-xl border border-gray-700/50">
                            <div className="flex items-center gap-3 pr-6 border-r border-gray-700">
                                <User className="w-4 h-4 text-blue-400" />
                                <div>
                                    <p className="text-[9px] uppercase text-gray-500 font-black leading-none mb-1">Atendente</p>
                                    <p className="text-sm font-bold text-gray-200">{session?.nome || "---"}</p>
                                </div>
                            </div>
                            <div className="px-2 text-center">
                                <p className="text-[9px] uppercase text-gray-500 font-black leading-none mb-1">GUICHÊ</p>
                                <p className="text-lg font-black text-blue-400 leading-none">{session?.guiche || "--"}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setOpenModal(true)} className="ml-2 h-8 text-[9px] font-black uppercase tracking-widest bg-gray-700 hover:bg-blue-600 text-white">Alterar</Button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">

                        {/* LADO ESQUERDO: FILTROS */}
                        <div className="flex flex-col md:flex-row gap-2">
                            <div className="w-fit flex items-center gap-2 bg-white dark:bg-black p-2 rounded-xl shadow-sm border dark:border-gray-600">
                                <Filter className="w-4 h-4 font-black" />
                                <div className="flex gap-2">
                                    {["TODOS", "NORMAL", "PREFERENCIAL", "ENCAIXE"].map((tipo) => (
                                        <Button
                                            key={tipo}
                                            variant={filtroTipo === tipo ? "default" : "outline"}
                                            size="sm"
                                            className={`h-8 text-[9px] font-black uppercase tracking-widest ${filtroTipo === tipo
                                                ? 'bg-gray-700 text-white'
                                                : 'bg-transparent font-black border-gray-200'
                                                }`}
                                            onClick={() => setFiltroTipo(tipo)}
                                        >
                                            {tipo}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm border dark:border-gray-600">
                                <Search className="w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar por nome..."
                                    className="w-80"
                                    value={filtroPesquisa}
                                    onChange={(e) => setFiltroPesquisa(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* LADO DIREITO: BOTÕES DE GERAR SENHA E ATUALIZAR */}
                        <div className="flex flex-row justify-end items-center gap-2 w-full">
                            <div
                                className="flex h-8 items-center gap-1 bg-blue-600 text-muted p-1 rounded-full hover:bg-blue-500 hover:text-white cursor-pointer transition-all shrink-0 "
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
                                    onClick={() => fetchData()}
                                >
                                    Atualizar
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Card className="border-none shadow-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 p-0">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px]">
                                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                        <tr>
                                            <ThOrdenavel label="Senha" coluna="senha_codigo" />
                                            <ThOrdenavel label="Nome" coluna="nome" />
                                            <ThOrdenavel label="Sequencial Ficha" coluna="ficha_sequencial" />
                                            <ThOrdenavel label="Chegada" coluna="created_at" />
                                            <ThOrdenavel label="Tempo Espera" coluna="tempo_espera" />
                                            <ThOrdenavel label="Status" coluna="status" />
                                            <ThOrdenavel label="Guichê" coluna="guiche" />
                                            <th className="text-right p-4 font-bold uppercase tracking-widest text-[10px]">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {dadosProcessados.map((item) => {
                                            const tempo = getTempoEsperaEvolutivo(item);

                                            // Lógica de estados
                                            const isFinalizado = item.status === "FINALIZADO";
                                            const isNaoAtendido = item.status === "NAO_ATENDIDO";
                                            const isCancelado = item.status === "CANCELADO";
                                            const isAguardandoExames = item.status === "AGUARDANDO_EXAMES" || (item.status.startsWith("EM_") && item.status !== "EM_FILA" && item.status !== "EM_RECEPCAO");
                                            const isAguardandoRecepcao = item.status === "AGUARDANDO_RECEPCAO";
                                            const isEncerrado = isFinalizado || isCancelado;

                                            // NOVIDADE: Verifica se a ficha já foi salva no banco
                                            const fichaPronta = item.ficha_preenchida || !!item.nome;

                                            // Estilização da Linha baseada no Status
                                            const rowStyles =
                                                isFinalizado
                                                    ? "bg-emerald-300/70 dark:bg-emerald-900/30"
                                                    : isCancelado
                                                        ? "bg-red-300/70 dark:bg-red-900/30"
                                                        : isAguardandoExames
                                                            ? "bg-green-300/30 dark:bg-green-900/30"
                                                            : isNaoAtendido
                                                                ? "bg-orange-300/70 dark:bg-orange-900/30"
                                                                : isAguardandoRecepcao
                                                                    ? "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                                                    : fichaPronta
                                                                        ? "bg-blue-50/30 dark:bg-blue-900/5"
                                                                        : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40";

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`${rowStyles} transition-all border-b border-gray-100 dark:border-gray-800`}
                                                >
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-lg font-black leading-none ${item.tipo_senha === "PREFERENCIAL" ? "text-orange-600" : "text-blue-600"}`}>
                                                                {item.senha_codigo}
                                                            </span>
                                                            <span className={`text-[9px] font-bold ${item.encaixe ? "text-green-700 text-[10px]" : "text-gray-400"} uppercase`}>{item.encaixe ? "encaixe" : item.tipo_senha}</span>
                                                        </div>
                                                    </td>

                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`${!item.nome ? "text-gray-400 italic" : "cursor-pointer font-bold text-gray-700 dark:text-gray-200"}`} onClick={() => {
                                                                if (item.nome) {
                                                                    setSelectedAtendimento(item);
                                                                    setIsDetailsOpen(true);
                                                                }
                                                            }}>
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
                                                        <span className="p-1 rounded bg-gray-500/20 hover:bg-gray-500/50 transition-all">{item.ficha_sequencial || "--"}</span>
                                                    </td>

                                                    <td className="p-4 text-gray-600 dark:text-gray-400 font-medium">{getHora(item.created_at)}</td>

                                                    <td className={`p-4 font-bold ${isEncerrado ? "text-gray-400" : getColorTempoEspera(parseInt(tempo.texto), tempo.isCancelado)}`}>
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
                                                                <span className="text-[12px] font-bold text-gray-500">
                                                                    Sala: {item.sala_atual}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center font-black text-gray-700 dark:text-white">
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
                                                                                p_guiche: session?.guiche,
                                                                                p_atendente: session?.nome
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

                                                                                    {/* CONTADOR */}
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled
                                                                                        className="h-8 text-[11px] font-bold bg-gray-600 min-w-[90px] text-white"
                                                                                    >
                                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                        {finalizandoIds[item.id] > 60
                                                                                            ? `${Math.floor(finalizandoIds[item.id] / 60)}m`
                                                                                            : `${finalizandoIds[item.id]}s`}
                                                                                    </Button>

                                                                                    {/* CANCELAR */}
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="destructive"
                                                                                        className="h-8 w-8 p-0"
                                                                                        onClick={() => cancelarFinalizacao(item.id)}
                                                                                    >
                                                                                        <X className="w-4 h-4" />
                                                                                    </Button>

                                                                                    {item.encaixe && (
                                                                                        // FORÇAR FINALIZAÇÃO
                                                                                        <Button
                                                                                            size="sm"
                                                                                            className="h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700"
                                                                                            onClick={() => {
                                                                                                cancelarFinalizacao(item.id);

                                                                                                executarAcao("finalizar_recepcao", {
                                                                                                    p_atendimento_id: item.id,
                                                                                                    p_especialidades_ids: obterIdsConsolidados()
                                                                                                });
                                                                                            }}
                                                                                        >
                                                                                            Forçar finalização
                                                                                        </Button>
                                                                                    )}

                                                                                </div>
                                                                            ) : (
                                                                                <Button
                                                                                    size="sm"
                                                                                    disabled={!fichaPronta}
                                                                                    className={`h-8 text-[11px] font-bold ${fichaPronta
                                                                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                                                                        : 'bg-gray-300'
                                                                                        }`}
                                                                                    onClick={() => iniciarFinalizacaoComDelay(item.id, item.encaixe)}
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
                                                                                            p_status: 'EM_FILA',
                                                                                            p_guiche: session?.guiche,
                                                                                            p_atendente: session?.nome
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
                                                                                    p_status: 'EM_FILA',
                                                                                    p_guiche: session?.guiche,
                                                                                    p_atendente: session?.nome
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

                                                                    {fichaPronta && (
                                                                        <div>
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            size="sm"
                                                                                            variant="secondary"
                                                                                            className={`h-8 w-8 p-0 ${fichaPronta ? 'bg-emerald-600 text-muted' : 'bg-blue-600 text-white'} ${fichaPronta ? "hover:bg-emerald-300" : "hover:bg-blue-300"} transition-colors`}
                                                                                            onClick={() => {
                                                                                                abrirModalImportacao(item).then(() => {
                                                                                                    // delay para garantir que o estado carregou antes de imprimir
                                                                                                    setTimeout(handlePrint, 500);
                                                                                                });
                                                                                            }}
                                                                                        >
                                                                                            <Printer className="w-3.5 h-3.5" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>Imprimir Ficha</TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        </div>
                                                                    )}

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
                                                                    <span className={`text-[10px] font-bold uppercase italic ${isCancelado ? 'text-red-500' : 'text-gray-400'}`}>
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
            </div >

            {/* MODAL DE IMPORTAÇÃO DE FICHA */}
            < Dialog
                open={importModal.open}
                onOpenChange={(val) => {
                    setImportModal({ ...importModal, open: val });
                    if (!val) setFormFicha(initialFormFicha);
                }
                }
            >
                <DialogContent className="sm:max-w-200 bg-white dark:bg-gray-900 border-none shadow-2xl max-h-[95vh] overflow-y-auto p-0">
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
                                <div className="absolute inset-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center border-2 border-blue-500 border-dashed">
                                    <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-2" />
                                    <p className="font-black text-blue-600 uppercase tracking-widest text-[10px]">Lendo PDF...</p>
                                </div>
                            )}
                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-blue-400 bg-gray-50/50 dark:bg-gray-800/50 transition-all rounded-xl p-4 text-center relative cursor-pointer">
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleUploadPDF(e.target.files[0])}
                                />
                                <div className="flex items-center justify-center gap-3">
                                    <UploadCloud className="w-6 h-6 text-gray-400" />
                                    <p className="text-sm font-bold text-gray-500">
                                        {formFicha.arquivo?.name ?? "Importar PDF da Ficha (Preenchimento Automático)"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. DADOS DO FUNCIONÁRIO (FOCO PRINCIPAL) */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Dados do Funcionário</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Nome Completo</Label>
                                    <Input className="h-10 font-bold" value={formFicha.funcionario.nome} onChange={(e) => setFormFicha({ ...formFicha, funcionario: { ...formFicha.funcionario, nome: e.target.value } })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Nº Sequencial</Label>
                                    <Input className="h-10 font-black text-blue-600 text-center text-lg" value={formFicha.sequencial} onChange={(e) => setFormFicha({ ...formFicha, sequencial: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">CPF</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.cpf || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'cpf', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">RG</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.rg || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'rg', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Nascimento</Label>
                                    <Input
                                        className="h-9 text-center"
                                        value={formFicha.funcionario.nascimento || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'nascimento', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Cargo</Label>
                                    <Input
                                        className="h-9"
                                        value={formFicha.funcionario.cargo || ""}
                                        onChange={(e) => updateNestedField('funcionario', 'cargo', e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-gray-400">Setor</Label>
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
                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Empresa</h3>
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
                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Stethoscope className="w-4 h-4 text-gray-400" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Informações ASO</h3>
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
                        <section className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 pb-2">
                                <BellRing className="w-4 h-4 text-amber-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Observações</h3>
                            </div>
                            <div className="space-y-1.5">
                                <textarea
                                    className="w-full min-h-[80px] p-3 text-sm font-medium dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={formFicha.observacao}
                                    onChange={(e) => setFormFicha({ ...formFicha, observacao: e.target.value })}
                                />
                            </div>
                        </section>

                        <section className="space-y-3 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">

                                <div>
                                    <p className="text-xs font-black uppercase text-gray-600 dark:text-gray-300">
                                        Atendimento de Encaixe
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        Define o tempo automático de finalização
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setFormFicha(prev => ({
                                            ...prev,
                                            encaixe: !prev.encaixe
                                        }))
                                    }
                                    className={`w-14 h-7 flex items-center rounded-full transition-all ${formFicha.encaixe ? "bg-amber-500" : "bg-gray-300"
                                        }`}
                                >
                                    <div
                                        className={`h-6 w-6 bg-white rounded-full shadow transform transition-all ${formFicha.encaixe ? "translate-x-7" : "translate-x-1"
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* ENCAIXE */}
                            <div className="text-[10px] font-bold uppercase tracking-widest text-center">
                                {formFicha.encaixe ? (
                                    <span className="text-amber-600">
                                        Tempo de finalização: 30 MINUTOS
                                    </span>
                                ) : (
                                    <span className="text-blue-600">
                                        Tempo de finalização: 30 SEGUNDOS
                                    </span>
                                )}
                            </div>
                        </section>

                        {/* 4. LANÇAMENTO DE EXAMES E ESPECIALIDADES */}
                        <div className="flex flex-col gap-8 pt-4 border-t border-gray-100">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                                        Exames do ASO
                                    </h4>
                                </div>

                                {/* Container do Input + Sugestões Customizadas */}
                                <div className="relative">
                                    <Input
                                        placeholder="Clique para ver a lista ou digite para buscar..."
                                        className="h-10 border-gray-200 focus-visible:ring-blue-500 bg-white dark:bg-gray-900"
                                        value={exameInput}
                                        onChange={(e) => {
                                            setExameInput(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && exameInput) {
                                                e.preventDefault();
                                                const match = sugestoesExames.find(s => s.toLowerCase() === exameInput.toLowerCase());
                                                if (match) handleAddExameManual(match);
                                            }
                                        }}
                                    />

                                    {/* Lista de Sugestões Estilizada */}
                                    {showSuggestions && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            <div className="max-h-56 overflow-y-auto p-1 custom-scrollbar">
                                                {sugestoesExames
                                                    // Se houver texto, filtra. Se não, mostra todos.
                                                    .filter(s => !exameInput || s.toLowerCase().includes(exameInput.toLowerCase()))
                                                    .map((sugestao, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                handleAddExameManual(sugestao);
                                                                setShowSuggestions(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-tight text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 rounded-lg transition-colors flex items-center justify-between group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-blue-500 transition-colors" />
                                                                {sugestao}
                                                            </div>
                                                            <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ))}

                                                {/* Caso a busca não retorne nada */}
                                                {exameInput && sugestoesExames.filter(s => s.toLowerCase().includes(exameInput.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-6 text-center text-[10px] text-gray-400 uppercase font-black tracking-widest">
                                                        Nenhum exame cadastrado
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Lista de Selecionados */}
                                <div className="rounded-xl border border-gray-100 bg-gray-50/50 dark:bg-gray-800/30 overflow-hidden shadow-inner">
                                    {/* Ajuste na classe grid: condicional para colunas */}
                                    <div className={`h-full grid gap-1 items-center overflow-y-auto p-2 custom-scrollbar ${formFicha.exames.length === 0 ? "grid-cols-1" : "grid-cols-2"
                                        }`}>
                                        {formFicha.exames.length === 0 ? (
                                            <div className="p-8 text-center flex flex-col items-center justify-center">
                                                <div className="inline-flex p-3 rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-3">
                                                    <ClipboardList className="w-5 h-5 text-gray-300" />
                                                </div>
                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                                                    Nenhum exame na lista
                                                </p>
                                            </div>
                                        ) : (
                                            formFicha.exames.map((ex, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200/50 shadow-sm group hover:border-blue-400/50 hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 border border-blue-100 dark:border-blue-800/50 group-hover:scale-110 transition-transform">
                                                            <Activity className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-[11px] font-black text-gray-700 dark:text-gray-100 uppercase tracking-tight line-clamp-1">
                                                            {ex.exame}
                                                        </span>
                                                    </div>

                                                    <Button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeExame(i);
                                                        }}
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4  border-t border-gray-100 pt-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Destinos de Atendimento</h4>
                                </div>
                                <div className="bg-gray-50 h-fit dark:bg-gray-800/50 border border-gray-100 rounded-xl p-3 h-38.75 overflow-y-auto space-y-1">
                                    {especialidades.map((esp) => {
                                        // Verifica se esta especialidade deve estar marcada (está no estado)
                                        const isChecked = especialidadesSelecionadas.includes(esp.id);

                                        return (
                                            <label key={esp.id} className={`flex items-center justify-between p-2 rounded-md transition-all cursor-pointer ${isChecked ? 'bg-blue-100/50 dark:bg-blue-900/30' : 'opacity-50 hover:opacity-100'}`}>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        className="w-3.5 h-3.5"
                                                        onChange={(e) => {
                                                            setEspecialidadesManual(prev =>
                                                                e.target.checked
                                                                    ? [...prev, esp.id]
                                                                    : prev.filter(id => id !== esp.id)
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-[10px] font-black uppercase text-gray-600 dark:text-gray-300">{esp.nome}</span>
                                                </div>
                                                {isChecked && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800">
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
            </Dialog >


            {/* MODAL DE GUICHÊ */}
            < Dialog open={openModal} onOpenChange={setOpenModal} >
                <DialogContent className="sm:max-w-100 border-none shadow-2xl bg-white dark:bg-gray-900">
                    <DialogHeader className="space-y-4">
                        <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mx-auto"><MonitorCheck className="w-8 h-8 text-emerald-500" /></div>
                        <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-gray-800 dark:text-white">Guichê de Atendimento</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-4 flex flex-col items-center">
                        <div className="flex justify-center items-center gap-2">
                            <Label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Selecione o Guichê</Label>
                            <Select
                                value={session?.guiche}
                                onValueChange={(val) => setSession(prev => ({ ...prev, guiche: val }))}

                            >
                                <SelectTrigger className="h-12 bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="Selecione o Guichê" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(unidadeId !== "8c66cebc-07fa-4699-941d-807af73c443e" ? ["1", "2", "3", "4"] : ["1", "2"]).map((n) => (
                                        <SelectItem key={n} value={n}>
                                            Guichê {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-center items-center gap-2">
                            <Label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                                Seu Nome
                            </Label>
                            <Select
                                value={session?.nome}
                                onValueChange={(val) => setSession(prev => ({ ...prev, nome: val }))}
                            >
                                <SelectTrigger className="h-12 bg-gray-50 border-gray-200">
                                    <SelectValue placeholder={loadingRecepcionistas ? "Carregando..." : "Quem está atendendo?"} />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-900">
                                    {recepcionistas.length > 0 ? (
                                        recepcionistas.map((p) => (
                                            <SelectItem key={p.id} value={p.nome} className="font-bold">
                                                {p.nome}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-xs text-center text-gray-500">
                                            Nenhum recepcionista encontrado
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="bg-gray-900">
                        <Button className="w-full h-12 text-muted bg-gray-900 dark:bg-blue-600 dark:hover:bg-blue-400 hover:bg-blue-600" onClick={salvarSessao}>
                            Ativar Guichê
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* TEMPLATE FICHA */}
            <div style={{ display: 'none' }}>
                <TemplateFicha
                    ref={componentRef}
                    dados={formFicha}
                />
            </div>

            <StatusSenhaRecep
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                atendimento={selectedAtendimento}
            />
        </>
    );
}
