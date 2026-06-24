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
    X,
    UserCog,
    DatabaseSearch
} from "lucide-react"
import { is } from "zod/v4/locales"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatusSenhaFilas } from "@/components/atendimento/status-senha-filas/StatusSenhaFilas"

type ItemFila = {
    finaliza_em: any
    tipo_senha: string
    id: string
    atendimento_id: string
    senha: string
    nome: string
    empresa_razao: string
    codigo_empresa: string
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

type Sala = { id: string; numero: string; especialidade_id: string }
type Profissional = {
    id: string;
    nome: string;
    profissional_especialidades: { especialidade_id: string }[];
}

export default function FilaPage() {
    const { id } = useParams()
    const [especialidadeNome, setEspecialidadeNome] = useState("Carregando...")
    const [data, setData] = useState<ItemFila[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [loadingAction, setLoadingAction] = useState<string | null>(null)
    const [openModal, setOpenModal] = useState(false)
    const [session, setSession] = useState<any>(null)
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({ coluna: 'tempo_espera', direcao: 'desc' })
    const [filtroPesquisa, setFiltroPesquisa] = useState("")
    const [filtroTipo, setFiltroTipo] = useState<string>("TODOS")
    // const [listaGlobalExames, setListaGlobalExames] = useState<any[]>([]);
    const [examesPorAtendimento, setExamesPorAtendimento] = useState<Record<string, any[]>>({});
    const [examesConcluidos, setExamesConcluidos] = useState<
        Record<string, string[]>
    >({});
    const [finalizandoIds, setFinalizandoIds] = useState<Record<string, number>>({});
    const [selectedAtendimento, setSelectedAtendimento] = useState<ItemFila | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    const [salas, setSalas] = useState<Sala[]>([])
    const [profissionais, setProfissionais] = useState<Profissional[]>([])
    const [form, setForm] = useState({ sala: "", profissional: "" });
    const [isOutraSala, setIsOutraSala] = useState(false);
    const [isOutroProfissional, setIsOutroProfissional] = useState(false);
    const salasFiltradas = useMemo(() => {
        return salas.filter(s => s.especialidade_id === id)
    }, [salas, id])

    // Estados para o Alerta de Inatividade/Tempo Extrapolado
    const [showTempoAlerta, setShowTempoAlerta] = useState(false);
    const [atendimentoAtualId, setAtendimentoAtualId] = useState<string | null>(null);
    const [inicioAtendimento, setInicioAtendimento] = useState<number | null>(null);
    const ultimoAlertaRef = useRef<number | null>(null);

    const [unidadeId, setUnidadeId] = useState<string | null>(null);
    const finalizandoEmAndamento = useRef<Set<string>>(new Set());
    const [now, setNow] = useState(Date.now());
    // const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 200);

        return () => clearInterval(interval);
    }, []);

    const canceladosRef = useRef(new Set<string>());

    const getTempoRestante = (id: string) => {
        const fim = finalizandoIds[id];
        if (!fim) return null;

        const segundos = Math.max(
            0,
            Math.floor((fim - now) / 1000)
        );

        return segundos;
    };

    const [naoAtendidosRecentes, setNaoAtendidosRecentes] = useState<string[]>([]);;

    useEffect(() => {
        const saved = localStorage.getItem('nao_atendidos_recentes');
        if (saved) {
            setNaoAtendidosRecentes(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        // Evita sobrescrever o localStorage com um array vazio antes do carregamento inicial
        if (naoAtendidosRecentes.length > 0) {
            localStorage.setItem('nao_atendidos_recentes', JSON.stringify(naoAtendidosRecentes));
        }
    }, [naoAtendidosRecentes]);

    const profissionaisFiltrados = useMemo(() => {
        if (!id) return []
        return profissionais.filter(p =>
            p.profissional_especialidades?.some(
                (v: any) => v.especialidade_id === id
            )
        )
    }, [profissionais, id])

    const entrar = async () => {
        if (!form.sala || !form.profissional) {
            alert("Por favor, preencha a sala e o profissional.");
            return;
        }

        // remove "Sala " caso venha junto
        const salaNormalizada = form.sala
            .replace(/^sala\s*/i, "")
            .trim();

        const dadosSessao = {
            ...form,
            sala: salaNormalizada,
            especialidade_id: id
        };

        console.log(form)

        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const userKey = `fila_session_${user.id}`;

            localStorage.setItem(
                userKey,
                JSON.stringify(dadosSessao)
            );

            window.dispatchEvent(
                new CustomEvent("fila-changed")
            )

            setSession(dadosSessao);

            setOpenModal(false);
        }
    };

    const getTempoEsperaTotal = (item: ItemFila) => {
        if (!item.created_at) return 0;

        // Se o item estiver finalizado ou cancelado, ele para de contar.
        // Como você não tem o tempo final salvo em uma coluna específica, 
        // aqui você pode decidir se exibe o tempo total até agora ou 0.
        if (item.status === "FINALIZADO") {
            return 0; // Ou mantenha a lógica de exibir o tempo total se preferir
        }

        const dataCriacao = new Date(item.created_at).getTime();
        const agora = Date.now();

        // Cálculo da diferença em minutos
        const diffMs = agora - dataCriacao;
        const minutos = Math.floor(diffMs / 1000 / 60);

        return minutos > 0 ? minutos : 0;
    };

    const getHora = (date: string) => {
        if (!date) return "--:--"
        return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }

    const getColorTempoEspera = (created_at: string, isCancelado: boolean) => {
        const minutos = Math.floor((Date.now() - new Date(created_at).getTime()) / 1000 / 60);


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

        if ((item.status_atendimento.startsWith('EM ') && item.status === "EM_FILA")) {
            return {
                color: isMinhaSala ? "text-emerald-600" : "text-red-600",
                bg: isMinhaSala ? "bg-emerald-500/10" : "bg-red-500/10",
                label: isMinhaSala ? "EM FILA" : "BLOQUEADO",
                animate: isMinhaSala ? "animate-pulse" : "",
                podeAcoes: isMinhaSala
            }
        }

        if (item.bloqueado || item.status_atendimento.startsWith('EM ') && item.status === "EM_ATENDIMENTO") {
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
        // Se ainda não carregou o unidadeId, não busca para não vir dados misturados
        if (!unidadeId) return;

        setIsRefreshing(true);
        try {
            const { data: esp } = await supabase
                .from('especialidades')
                .select('nome')
                .eq('id', id)
                .single();

            if (!esp) return;
            setEspecialidadeNome(esp.nome);

            // Adicionando o p_unidade_id na chamada RPC
            const { data: result } = await supabase.rpc("get_fila_especialidade_novo", {
                p_sala: esp.nome,
                p_unidade_id: unidadeId // <--- Filtro por unidade
            });

            if (result) {
                console.log(
                    result.filter((x: any) => x.finaliza_em)
                );
                setData(result);

                const novosTimers: Record<string, number> = {};
                const agora = Date.now();
                let houveFinalizacaoAutomatica = false;

                result.forEach((item: any) => {
                    if (item.finaliza_em) {
                        const fim = new Date(item.finaliza_em).getTime();

                        // recria timer visual
                        if (fim > agora) {

                            novosTimers[item.id] = fim;
                        }
                    }
                });

                // Atualiza o estado apenas com os temporizadores que AINDA estão correndo
                setFinalizandoIds(prev => ({
                    ...prev,
                    ...novosTimers
                }));
            }
        } catch (err) {
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }

    useEffect(() => {

        async function inicializar() {

            const { data: esp } = await supabase
                .from('especialidades')
                .select('nome')
                .eq('id', id)
                .single();

            if (!esp || !unidadeId) return;

            setEspecialidadeNome(esp.nome);

            // const { data: result } = await supabase.rpc(
            //     "get_fila_especialidade_novo",
            //     {
            //         p_sala: esp.nome,
            //         p_unidade_id: unidadeId
            //     }
            // );

            // if (result) {
            //     setData(result);
            // }
        }

        inicializar();

    }, [id, unidadeId]);

    useEffect(() => {
        // Busca se existe alguém sendo atendido por VOCÊ nesta sala
        const emAtendimento = data.find(item =>
            item.status === "EM_ATENDIMENTO" &&
            item.num_sala === session?.sala &&
            item.profissional === session?.profissional
        );


        if (emAtendimento) {
            // Se mudou o paciente ou começou agora
            if (atendimentoAtualId !== emAtendimento.id) {
                setAtendimentoAtualId(emAtendimento.id);
                setInicioAtendimento(Date.now());
                ultimoAlertaRef.current = null; // Reseta o rastreador de alertas
            }
        } else {
            // Se não tem ninguém em atendimento, limpa os estados
            setAtendimentoAtualId(null);
            setInicioAtendimento(null);
            ultimoAlertaRef.current = null;
            setShowTempoAlerta(false);
        }
    }, [data, session]);

    useEffect(() => {
        if (!inicioAtendimento || !atendimentoAtualId) return;

        const interval = setInterval(() => {
            const agora = Date.now();
            const decorridoMinutos = (agora - inicioAtendimento) / 1000 / 60;

            if (decorridoMinutos >= 15) {
                // Se nunca alertou OU se o último alerta foi há mais de 5 minutos
                if (!ultimoAlertaRef.current || (agora - ultimoAlertaRef.current) / 1000 / 60 >= 5) {
                    setShowTempoAlerta(true);
                    ultimoAlertaRef.current = agora;
                }
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [inicioAtendimento, atendimentoAtualId]);

    useEffect(() => {

        if (!unidadeId || !especialidadeNome) return;

        const eventSource = new EventSource(
            `https://doctors-distribuidor-sse.cgalnz.easypanel.host/stream-fila` +
            `?tipo=especialidade` +
            `&unidadeId=${unidadeId}` +
            `&sala=${encodeURIComponent(especialidadeNome)}`
        );

        eventSource.onmessage = (event) => {
            const payload = JSON.parse(event.data);
            setData(payload.dados);
        };

        return () => {
            eventSource.close();
        };

    }, [unidadeId, especialidadeNome]);

    // 🔄 Mantém o finalizandoIds 100% sincronizado com a coluna finaliza_em do banco (Evita zerar no F5)
    // useEffect(() => {
    //     if (!data || data.length === 0) return;

    //     const novosTimers: Record<string, number> = {};
    //     const agora = Date.now();

    //     data.forEach((item: any) => {

    //         if (
    //             item.status === "EM_ATENDIMENTO" &&
    //             item.finaliza_em
    //         ) {
    //             const fim = new Date(item.finaliza_em).getTime();

    //             if (fim > agora) {
    //                 novosTimers[item.id] = fim;
    //             }
    //         }
    //     });
    //     // Mescla com o estado anterior mantendo os timers ativos do banco de dados
    //     setFinalizandoIds(prev => {
    //         const atualizado = { ...prev, ...novosTimers };

    //         // Limpa registros do estado local que o banco de dados já não aponta mais como ativos/finaliza_em
    //         Object.keys(atualizado).forEach(id => {
    //             const correspondente = data.find(i => i.id === id);
    //             if (!correspondente || !correspondente.finaliza_em) {
    //                 delete atualizado[id];
    //             }
    //         });

    //         return atualizado;
    //     });
    // }, [data]);
    useEffect(() => {
        if (!data?.length) return;

        const agora = Date.now();

        const timers = Object.fromEntries(
            data
                .filter(item =>
                    item.status === "EM_ATENDIMENTO" &&
                    item.finaliza_em &&
                    new Date(item.finaliza_em).getTime() > agora
                )
                .map(item => [
                    item.id,
                    new Date(item.finaliza_em).getTime()
                ])
        );

        setFinalizandoIds(timers);

    }, [data]);

    useEffect(() => {
        data.forEach(item => {

            const fim = finalizandoIds[item.id];

            if (!fim) return;

            if (
                Date.now() >= fim &&
                !finalizandoEmAndamento.current.has(item.id)
            ) {

                finalizandoEmAndamento.current.add(item.id);

                executarAcao(
                    "finalizar_especialidade_novo",
                    {
                        p_atendimento_id: item.atendimento_id,
                        p_atendimento_exame_id: item.id,
                        p_sala: item.sala || especialidadeNome,
                        p_num_sala: session?.sala,
                    }
                ).finally(() => {

                    setFinalizandoIds(prev => {
                        const novo = { ...prev };
                        delete novo[item.id];
                        return novo;
                    });

                    finalizandoEmAndamento.current.delete(item.id);
                });
            }
        });

    }, [now, finalizandoIds, data]);

    useEffect(() => {
        const initialize = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // 1. Busca Profile para pegar a unidade e o role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, unidade_id')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    let idFinal = profile.unidade_id;

                    // Lógica para Admin (respeitando a unidade trocada no localStorage)
                    // if (profile.role === 'admin') {
                    //     const unidadeSessao = localStorage.getItem('unidade_ativa_id');
                    //     if (unidadeSessao) idFinal = unidadeSessao;
                    // }

                    setUnidadeId(idFinal);

                    // 2. Gerenciamento da Sessão de Sala/Profissional (sua lógica atual)
                    const userKey = `fila_session_${user.id}`;
                    const saved = localStorage.getItem(userKey);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed.sala && parsed.profissional) {
                            setSession(parsed);
                            setOpenModal(false);
                        }
                    } else {
                        setOpenModal(true);
                    }
                }
            }
        };
        initialize();
    }, [id]);

    useEffect(() => {
        async function fetchConfig() {
            setLoading(true);
            const { data: s } = await supabase
                .from("salas")
                .select(`
                    id,
                    numero,
                    sala_especialidades!left (
                        especialidade_id
                    )
                    `)
                .eq("unidade_id", unidadeId)
                .order("numero");
            const { data: p } = await supabase.from("profissionais").select(`
                id,
                nome,
                ativo,
                profissional_especialidades (especialidade_id)
            `).eq("ativo", true)
                .order("nome");

            // Normaliza os dados retornados para o tipo Sala esperado pela aplicação
            setSalas(
                (s || []).map((row: any) => ({
                    id: String(row.id),
                    numero: String(row.numero),
                    especialidade_id: String(row.sala_especialidades?.[0]?.especialidade_id ?? "")
                }))
            );
            // Não use .map se for remover a lista de especialidades, 
            // ou garanta que ela continue lá:
            setProfissionais(p || []);
            setLoading(false);

        }
        fetchConfig();
    }, [unidadeId]); // Adicione id como dependência

    useEffect(() => {
        if (data.length > 0) {

            fetchExamesAtendimentos(data);
        }
    }, [data]);

    async function fetchExamesAtendimentos(data: any) {
        if (!data.length || !id) return;
        const atendimentoIds = data.map((i: { atendimento_id: any }) => i.atendimento_id);


        const { data: atendimentosData, error } = await supabase
            .from("atendimentos")
            .select(`
            id,
            exames_list
        `)
            .in("id", atendimentoIds);
        if (error) {
            return;
        }


        const { data: especialidadeAtual } = await supabase
            .from("especialidades")
            .select("obrigar_check_exames")
            .eq("id", id)
            .single();

        const especialidadeObrigatoria =
            especialidadeAtual?.obrigar_check_exames === true;

        const { data: examesEspecialidade } = await supabase
            .from("exames")
            .select(`
        id,
        nome,
        especialidade_id,
        obrigatorio_checkbox
    `)
            .eq("especialidade_id", id);

        // nomes dos exames da especialidade atual
        const nomesExamesEspecialidade =
            examesEspecialidade?.map(e =>
                e.nome?.toLowerCase().trim()
            ) || [];

        const agrupado: Record<string, any[]> = {};
        const concluidosIniciais: Record<string, string[]> = {};

        atendimentosData?.forEach((atendimento: any) => {

            const examesList = Array.isArray(atendimento.exames_list)
                ? atendimento.exames_list
                : [];

            // filtra somente exames da especialidade atual
            const examesFiltrados = examesList
                .map((ex: any) => {
                    const exameSistema = examesEspecialidade?.find(
                        e => normalizar(e.nome) === normalizar(ex.exame)
                    );

                    if (!exameSistema) return null;

                    return {
                        ...ex,
                        exame_id: exameSistema.id,
                        obrigatorio_checkbox:
                            exameSistema.obrigatorio_checkbox ?? true
                    };
                })
                .filter(Boolean);

            agrupado[atendimento.id] = examesFiltrados;

            // =========================
            // AUTO MARCAR NÃO OBRIGATÓRIOS
            // =========================
            concluidosIniciais[atendimento.id] = examesFiltrados
                .filter((ex: any) => {

                    // PRIORIDADE:
                    // se já existe realizado=true no banco,
                    // respeita ele

                    if (ex.realizado === true) {
                        return true;
                    }

                    const exameSistema = examesEspecialidade?.find(
                        e => e.id === ex.exame_id
                    );

                    const exameObrigatorio =
                        exameSistema?.obrigatorio_checkbox === true;

                    return (
                        especialidadeObrigatoria === false &&
                        exameObrigatorio === false
                    );
                })
                .map((ex: any) => ex.exame);
        });


        setExamesPorAtendimento(agrupado);
        setExamesConcluidos(prev => {
            const novo = { ...prev };

            Object.keys(concluidosIniciais).forEach((atendimentoId) => {
                // só inicializa se ainda não existir
                if (!novo[atendimentoId]) {
                    novo[atendimentoId] = concluidosIniciais[atendimentoId];
                }
            });

            return novo;
        });
    }

    const normalizar = (texto: string) =>
        texto
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

    const obterTempoExecucao = async () => {
        if (!id) return 20;

        const { data, error } = await supabase
            .from("especialidades")
            .select("tempo_finalizacao_segundos")
            .eq("id", id)
            .single();

        if (error || !data) {
            return 20; // fallback
        }

        return data.tempo_finalizacao_segundos || 20;
    };

    async function salvarRealizacaoExames(
        atendimentoId: string,
        examesEspecialidadeAtual: any[]
    ) {

        // busca lista ORIGINAL completa
        const { data: atendimento, error: erroBusca } = await supabase
            .from("atendimentos")
            .select("exames_list")
            .eq("id", atendimentoId)
            .single();

        if (erroBusca || !atendimento) {
            toast.error("Erro ao buscar exames");
            return false;
        }

        const examesOriginais = Array.isArray(atendimento.exames_list)
            ? atendimento.exames_list
            : [];

        const concluidos =
            examesConcluidos[atendimentoId] || [];

        // nomes da especialidade atual
        const nomesEspecialidadeAtual = examesEspecialidadeAtual.map(
            (e: any) => normalizar(e.exame)
        );

        // atualiza SOMENTE exames da especialidade atual
        const examesAtualizados = examesOriginais.map((ex: any) => {

            const pertenceEspecialidadeAtual =
                nomesEspecialidadeAtual.includes(
                    normalizar(ex.exame)
                );

            // mantém intacto
            if (!pertenceEspecialidadeAtual) {
                return ex;
            }

            // pega dados do exame atual da especialidade
            const exameAtual = examesEspecialidadeAtual.find(
                (e: any) =>
                    normalizar(e.exame) === normalizar(ex.exame)
            );

            return {
                ...ex,

                // adiciona somente os novos campos
                exame_id: exameAtual?.exame_id,
                obrigatorio_checkbox:
                    exameAtual?.obrigatorio_checkbox ?? false,

                realizado: concluidos.includes(ex.exame)
            };
        });

        const { error } = await supabase
            .from("atendimentos")
            .update({
                exames_list: examesAtualizados
            })
            .eq("id", atendimentoId);

        if (error) {
            toast.error("Erro ao salvar exames");
            return false;
        }

        return true;
    }

    async function executarAcao(rpcName: string, params: any) {
        setLoadingAction(params.p_atendimento_id);

        const { error } = await supabase.rpc(rpcName, params);

        if (error) {
            toast.error("Erro na operação: " + error.message);
        } else {
            toast.success("Sucesso!");
            if (rpcName === "nao_atendido_especialidade_novo") {
                setNaoAtendidosRecentes(prev => [...prev, params.p_atendimento_exame_id]);
            }
            if (rpcName === "chamar_paciente_bloqueado_novo") {
                setNaoAtendidosRecentes(prev => prev.filter(id => id !== params.p_atendimento_exame_id));
            }
            // fetchFila();
        }
        setLoadingAction(null);
    }

    const dadosProcessados = useMemo(() => {
        let lista = [...data];


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
            // Definimos os pesos de status
            const pesoStatus = (item: ItemFila) => {
                const isMinhaSessao = item.num_sala === session?.sala && item.profissional === session?.profissional;
                const naoAtendido = naoAtendidosRecentes.includes(item.id)
                if (item.status === "EM_ATENDIMENTO" && isMinhaSessao) return 1;
                if (item.status === "EM_FILA") return 2;
                if (item.status === "AGUARDANDO" && naoAtendido) return 3;
                if (item.status === "AGUARDANDO") return 4;
                if (item.status === "EM_ATENDIMENTO" && !isMinhaSessao && naoAtendido) return 9;
                if (item.status === "FINALIZADO") return 10;
                return 7;
            };

            // SE a ordenação for 'tempo_espera' (padrão), mantemos o agrupamento por status.
            // SE o usuário clicou em qualquer outra coluna (Nome, Senha, etc), a ordenação da coluna vira PRIORIDADE.
            const isOrdenacaoManual = ordenacao.coluna !== 'tempo_espera';

            if (!isOrdenacaoManual) {
                const pA = pesoStatus(a);
                const pB = pesoStatus(b);
                if (pA !== pB) return pA - pB;
            }

            // Lógica de comparação de valores
            let valA: any, valB: any;

            if (ordenacao.coluna === 'tempo_espera') {
                valA = getTempoEsperaTotal(a);
                valB = getTempoEsperaTotal(b);
            } else {
                // Garantimos que nulos/undefined fiquem no fim
                valA = a[ordenacao.coluna as keyof ItemFila] ?? '';
                valB = b[ordenacao.coluna as keyof ItemFila] ?? '';

                // Tratamento para strings (nomes) ficarem case-insensitive
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
            }

            if (valA < valB) return ordenacao.direcao === 'asc' ? -1 : 1;
            if (valA > valB) return ordenacao.direcao === 'asc' ? 1 : -1;

            // Se os valores da coluna forem iguais, usamos o peso do status como desempate
            return pesoStatus(a) - pesoStatus(b);
        });
    }, [data, ordenacao, filtroPesquisa, filtroTipo, session]);

    useEffect(() => {
        // Percorre a lista crua de dados para garantir que ninguém filtrado seja ignorado
        data.forEach(item => {
            const fim = finalizandoIds[item.id];
            if (!fim) return;

            // Se o horário atual atingiu ou passou o estipulado pelo finaliza_em
            if (Date.now() >= fim && !finalizandoEmAndamento.current.has(item.id)) {

                // Trava concorrência local
                finalizandoEmAndamento.current.add(item.id);

                executarAcao(
                    "finalizar_especialidade_novo",
                    {
                        p_atendimento_id: item.atendimento_id,
                        p_atendimento_exame_id: item.id,
                        p_sala: item.sala || especialidadeNome,
                        p_num_sala: session?.sala,
                    }
                ).finally(() => {
                    // Remove dos estados locais após a conclusão da RPC
                    setFinalizandoIds(prev => {
                        const novo = { ...prev };
                        delete novo[item.id];
                        return novo;
                    });
                    finalizandoEmAndamento.current.delete(item.id);
                });
            }
        });
        // Executa a cada atualização do tique do relógio (now) ou do array original de dados
    }, [now, finalizandoIds, data, especialidadeNome, session]);

    const ThOrdenavel = ({ label, coluna }: { label: string, coluna: keyof ItemFila | 'tempo_espera' }) => {
        const isAtivo = ordenacao.coluna === coluna;

        return (
            <th
                className={`text-left p-4 font-bold uppercase tracking-widest text-[10px] cursor-pointer transition-colors
                ${isAtivo ? 'bg-slate-200/50 dark:bg-slate-800 text-emerald-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => setOrdenacao(prev => ({
                    coluna,
                    direcao: prev.coluna === coluna && prev.direcao === 'asc' ? 'desc' : 'asc'
                }))}
            >
                <div className="flex items-center gap-1">
                    {label}
                    <div className="flex flex-col">
                        <ArrowUpDown className={`w-3 h-3 ${isAtivo ? 'opacity-100' : 'opacity-30'}`} />
                    </div>
                </div>
            </th>
        );
    };

    const onFichaClick = (item: any) => {
        window.navigator.clipboard.writeText(item.ficha_sequencial || "--");
        toast.success("Ficha copiada: " + (item.ficha_sequencial || "--"))
    };

    const onEmpresaClick = (item: any) => {
        window.navigator.clipboard.writeText(item.empresa_razao || "--");
        toast.success("Empresa copiada: " + (item.empresa_razao || "--"))
    };

    const cancelarFinalizacao = async (id: string) => {

        canceladosRef.current.add(id);

        setFinalizandoIds(prev => {
            const novo = { ...prev };
            delete novo[id];
            return novo;
        });

        await supabase
            .from("atendimento_exames")
            .update({
                finaliza_em: null
            })
            .eq("id", id);

        toast.warning("Finalização cancelada");
    };


    // Verifica se o profissional atual já está atendendo alguém

    const iniciarFinalizacao = async (item: ItemFila) => {
        canceladosRef.current.delete(item.id);
        const tempo = await obterTempoExecucao();

        const fimDate = new Date(Date.now() + tempo * 1000);

        // atualiza a tela imediatamente
        setFinalizandoIds(prev => ({
            ...prev,
            [item.id]: fimDate.getTime()
        }));

        // persiste em segundo plano
        await supabase
            .from('atendimento_exames')
            .update({
                finaliza_em: fimDate.toISOString()
            })
            .eq('id', item.id);
    };

    const profissionalOcupado = useMemo(() => {
        return data.some(item =>
            (item.status === "EM_ATENDIMENTO" || item.status === "EM_FILA") &&
            item.num_sala === session?.sala &&
            item.profissional === session?.profissional &&
            !finalizandoIds[item.id]
        );
    }, [data, session, finalizandoIds]);

    if (loading) return <div className="flex h-screen items-center justify-center font-mono text-sm animate-pulse text-emerald-600 bg-slate-50 dark:bg-slate-950 uppercase tracking-widest">Sincronizando Fila...</div>
    return (
        <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
            <div className="w-full mx-auto space-y-5">

                {/* HEADER */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl"><Stethoscope className="w-5 h-5 text-emerald-400" /></div>
                        <div className="space-y-1">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">{especialidadeNome}</h1>
                            <p className="text-slate-400 text-[11px] font-bold tracking-[0.2em] uppercase">{new Date().toLocaleDateString("pt-BR")}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-xl border border-slate-700/50">
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
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">
                    <div className="flex flex-col md:flex-row gap-2">
                        <div className="w-fit flex items-center gap-2 bg-white dark:bg-black p-2 rounded-xl shadow-sm border dark:border-gray-600">
                            <Filter className="w-4 h-4 font-black" />
                            <div className="flex gap-2">
                                {["TODOS", "NORMAL", "PREFERENCIAL"].map((tipo) => (
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

                    {/* <div className="flex gap-2">
                        <Button onClick={fetchFila} disabled={isRefreshing} variant="outline" className="h-12 bg-white dark:bg-gray-900 p-2 px-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <RefreshCw className={`w-3 h-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar
                        </Button>
                    </div> */}

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>
                            A fila é atualizada automaticamente em tempo real.
                        </span>
                    </div>

                </div>

                {/* TABELA */}
                <Card className="border-none shadow-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 p-0">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <ThOrdenavel label="Senha" coluna="senha" />
                                        <ThOrdenavel label="Nome" coluna="nome" />
                                        <ThOrdenavel label="Sequencial Ficha" coluna="ficha_sequencial" />
                                        <ThOrdenavel label="Chegada" coluna="created_at" />
                                        <ThOrdenavel label="Tempo Espera" coluna="tempo_espera" />
                                        <ThOrdenavel label="Status" coluna="status" />
                                        <ThOrdenavel label="Observação" coluna="observacao" />
                                        <th className="text-right p-4 font-bold dark:text-slate-400 uppercase tracking-widest text-[10px]">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {dadosProcessados.map((item: any) => {

                                        const podeFinalizar =
                                            item.status === "EM_ATENDIMENTO" &&
                                            item.num_sala === session?.sala &&
                                            item.profissional === session?.profissional;

                                        const styles = getStatusStyles(item);
                                        const tempoRestante = getTempoRestante(item.id);

                                        const isFinalizado = item.status === "FINALIZADO"
                                        const isCancelado = item.status === "CANCELADO"
                                        const isNaoAtendido = naoAtendidosRecentes.includes(item.id);
                                        const isBloqueado = item.bloqueado || styles.label === "BLOQUEADO"
                                        const isEncerrado = isFinalizado || isCancelado
                                        const isTox = especialidadeNome?.toUpperCase() == ("TOXICOLÓGICO") ? true : false;

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


                                        const examesList =
                                            examesPorAtendimento[item.atendimento_id] || [];



                                        const toggleExame = (atendimentoId: string, exame: string) => {
                                            setExamesConcluidos(prev => {
                                                const atuais = prev[atendimentoId] || [];

                                                const existe = atuais.includes(exame);

                                                return {
                                                    ...prev,
                                                    [atendimentoId]: existe
                                                        ? atuais.filter(e => e !== exame)
                                                        : [...atuais, exame]
                                                };
                                            });
                                        };

                                        const todosExamesConcluidos = (
                                            atendimentoId: string,
                                            exames: any[]
                                        ) => {

                                            // SOMENTE exames obrigatórios bloqueiam
                                            const examesObrigatorios = exames.filter(
                                                (ex: any) => ex.obrigatorio_checkbox === true
                                            );

                                            // não existe obrigatório -> libera
                                            if (examesObrigatorios.length === 0) {
                                                return true;
                                            }

                                            const concluidos =
                                                examesConcluidos[atendimentoId] || [];

                                            // todos obrigatórios precisam estar marcados
                                            return examesObrigatorios.every((ex: any) =>
                                                concluidos.includes(ex.exame)
                                            );
                                        };
                                        const examesOk = todosExamesConcluidos(
                                            item.atendimento_id,
                                            examesList
                                        );

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
                                                        <span
                                                            className="font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                                                            onClick={() => {
                                                                if (item.nome) {
                                                                    setSelectedAtendimento(item);
                                                                    setIsDetailsOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            {item.nome}
                                                        </span>

                                                        {/* EXAMES DA ESPECIALIDADE */}
                                                        {examesList.length > 0 && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="relative flex items-center justify-center">
                                                                            <div className="rounded-full cursor-pointer" />

                                                                            {/* quantidade */}
                                                                            <span className="
                                                                                bg-emerald-600
                                                                                text-white
                                                                                text-[10px]
                                                                                font-black
                                                                                rounded-full
                                                                                w-4
                                                                                h-4
                                                                                flex
                                                                                items-center
                                                                                justify-center
                        ">
                                                                                {examesList.length}
                                                                            </span>
                                                                        </div>
                                                                    </TooltipTrigger>

                                                                    <TooltipContent
                                                                        side="right"
                                                                        className="
        text-black
        dark:text-white
        bg-white
        dark:bg-black
        border
        border-slate-200
        dark:border-slate-700
        shadow-xl
        min-w-[280px]
        p-3
    "
                                                                    >
                                                                        <div className="space-y-2">
                                                                            <div className="flex items-center gap-2 border-b pb-2">
                                                                                <Stethoscope className="w-4 h-4 text-emerald-500" />

                                                                                <span className="font-black text-[11px] uppercase tracking-wider">
                                                                                    Exames da Especialidade
                                                                                </span>
                                                                            </div>

                                                                            <div className="space-y-2">
                                                                                {examesList.map((ex: any, idx: number) => {
                                                                                    const podeEditarCheckbox =
                                                                                        item.status === "EM_ATENDIMENTO" &&
                                                                                        item.num_sala === session?.sala &&
                                                                                        item.profissional === session?.profissional;
                                                                                    const checked =
                                                                                        examesConcluidos[item.atendimento_id]?.includes(ex.exame);

                                                                                    return (
                                                                                        <label
                                                                                            key={idx}
                                                                                            className="
                            flex
                            items-center
                            justify-between
                            gap-3
                            text-[12px]
                            bg-slate-200
                            dark:bg-slate-800
                            rounded-lg
                            px-2
                            py-2
                            cursor-pointer
                            hover:bg-slate-300
                            dark:hover:bg-slate-700
                            transition-all
                        "
                                                                                        >
                                                                                            <div className="flex items-center gap-2">

                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    checked={checked || false}
                                                                                                    disabled={!podeEditarCheckbox}
                                                                                                    onChange={() => {
                                                                                                        if (!podeEditarCheckbox) return;

                                                                                                        toggleExame(
                                                                                                            item.atendimento_id,
                                                                                                            ex.exame
                                                                                                        );
                                                                                                    }}
                                                                                                    className="
        w-4
        h-4
        accent-emerald-600
        cursor-pointer
        disabled:opacity-50
        disabled:cursor-not-allowed
    "
                                                                                                />

                                                                                                <FlaskConical className="w-3 h-3 text-emerald-500" />

                                                                                                <span
                                                                                                    className={
                                                                                                        checked
                                                                                                            ? "opacity-60"
                                                                                                            : ""
                                                                                                    }
                                                                                                >
                                                                                                    {ex.exame}
                                                                                                </span>
                                                                                            </div>
                                                                                        </label>
                                                                                    );
                                                                                })}
                                                                            </div>

                                                                            <div className="pt-2 border-t">
                                                                                <div className="flex items-center justify-between text-[10px] uppercase font-bold">
                                                                                    <span>Progresso</span>

                                                                                    <span className="text-emerald-600">
                                                                                        {
                                                                                            (examesConcluidos[item.atendimento_id] || []).filter(nome =>
                                                                                                examesList.some(
                                                                                                    ex =>
                                                                                                        ex.exame === nome &&
                                                                                                        ex.obrigatorio_checkbox === true
                                                                                                )
                                                                                            ).length
                                                                                        }
                                                                                        /
                                                                                        {
                                                                                            examesList.filter(
                                                                                                e => e.obrigatorio_checkbox === true
                                                                                            ).length
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}

                                                        {/* EMPRESA */}
                                                        {item.empresa_razao && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger>
                                                                        <DatabaseSearch
                                                                            className="w-4 h-4 text-emerald-500"
                                                                            onClick={() => onEmpresaClick?.(item)}
                                                                        />
                                                                    </TooltipTrigger>

                                                                    <TooltipContent onClick={() => onEmpresaClick?.(item)}>
                                                                        {item.empresa_razao}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
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
                                                <td className={`p-4 font-bold ${isEncerrado ? "text-slate-400" : getColorTempoEspera(item.created_at, isCancelado)}`}>
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
                                                            <span className="text-[10px] font-bold uppercase">{`${item.sala} (Sala ${item.num_sala})`}</span>
                                                        </div>

                                                    ) : isBloqueado ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant="destructive" className={`uppercase ${styles.bg} ${styles.color} border-none text-[10px] font-bold tracking-wider ${styles.animate || ""}`}>
                                                                {styles.label}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold uppercase">{`${item.sala} (Sala ${item.num_sala})`}</span>
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
                                                                {item.status === "AGUARDANDO" && !isBloqueado && <>
                                                                    {isTox && (
                                                                        finalizandoIds[item.id] ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    disabled
                                                                                    className="h-8 text-[11px] font-bold bg-slate-600 min-w-[90px] text-white"
                                                                                >
                                                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                    {tempoRestante}s
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
                                                                                Realizado
                                                                            </Button>
                                                                        )
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        // TRAVA AQUI: Desabilita se estiver ocupado, se já for o status atual ou se houver loading
                                                                        disabled={
                                                                            profissionalOcupado || // já existe atendimento desse profissional
                                                                            // filaTemEmAtendimento || // trava a fila inteira
                                                                            loadingAction === item.atendimento_id ||
                                                                            item.status !== "AGUARDANDO"
                                                                        }
                                                                        onClick={() => executarAcao("chamar_paciente_bloqueado_novo", {
                                                                            p_atendimento_id: item.atendimento_id,
                                                                            p_atendimento_exame_id: item.id,
                                                                            p_sala: item.sala || especialidadeNome,
                                                                            p_num_sala: session.sala,
                                                                            p_profissional: session.profissional
                                                                        })}
                                                                        className="h-8 text-[11px] border-amber-600 text-amber-600 hover:bg-amber-50"
                                                                    >
                                                                        {loadingAction === item.atendimento_id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <><BellRing className="w-3 h-3 mr-1" /><p>Chamar</p></>
                                                                        )}
                                                                    </Button>
                                                                    {isNaoAtendido &&
                                                                        <Badge className="uppercase text-[11px] font-bold">não atendido</Badge>
                                                                    }
                                                                </>
                                                                }

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
                                                                                    {tempoRestante}s
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
                                                                            <>
                                                                                {item.ultimo_atendimento && item.status === "EM_ATENDIMENTO" && (
                                                                                    <Badge className="bg-gray-300 py-3 text-black border border-black/50">
                                                                                        Última especialidade!
                                                                                    </Badge>
                                                                                )}
                                                                                {podeFinalizar && (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled={!examesOk}
                                                                                        className={`
                                                                                            h-8
                                                                                            text-[11px]
                                                                                            font-bold
                                                                                            transition-all
                                                                                            ${examesOk
                                                                                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                                                : "bg-slate-400 hover:bg-slate-400 text-white cursor-not-allowed opacity-70"
                                                                                            }
    `}
                                                                                        onClick={async () => {
                                                                                            const sucesso = await salvarRealizacaoExames(
                                                                                                item.atendimento_id,
                                                                                                examesList
                                                                                            );

                                                                                            if (!sucesso) return;
                                                                                            iniciarFinalizacao(item)
                                                                                        }}
                                                                                    >Finalizar
                                                                                    </Button>
                                                                                )}
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    className="h-8 text-[11px] border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                                                                                    onClick={() => executarAcao("chamar_paciente_novo", {
                                                                                        p_atendimento_id: item.atendimento_id,
                                                                                        p_atendimento_exame_id: item.id,
                                                                                        p_sala: item.sala || especialidadeNome,
                                                                                        p_num_sala: session.sala,
                                                                                        p_profissional: session.profissional,
                                                                                    })}
                                                                                >
                                                                                    <BellRing className="w-3 h-3 mr-1" />
                                                                                    Chamar Novamente
                                                                                </Button></>
                                                                        )}


                                                                    </>
                                                                )}

                                                                {(item.status !== "AGUARDANDO" && !isBloqueado) && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-8 text-[11px] bg-orange-600 font-bold text-white hover:text-orange-500 border-orange-500/50 transition-colors dark:text-white/80"
                                                                        onClick={() => executarAcao("nao_atendido_especialidade_novo", {
                                                                            p_atendimento_id: item.atendimento_id,
                                                                            p_atendimento_exame_id: item.id
                                                                        })}
                                                                    >
                                                                        Não Atendido
                                                                    </Button>
                                                                )}

                                                                {isBloqueado && (
                                                                    <>
                                                                        {isTox && (
                                                                            finalizandoIds[item.id] ? (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled
                                                                                        className="h-8 text-[11px] font-bold bg-slate-600 min-w-[90px] text-white"
                                                                                    >
                                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                                        {tempoRestante}s
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
                                                                                    Realizado
                                                                                </Button>
                                                                            )
                                                                        )}

                                                                        <Badge
                                                                            className={`${styles.bg} ${styles.color} border-none text-[10px] uppercase font-bold tracking-wider ${styles.animate || ""}`}
                                                                        >
                                                                            Atendimento Bloqueado
                                                                        </Badge>
                                                                    </>
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
                </Card >
            </div >

            {/* MODAL CONFIGURAÇÃO */}
            < Dialog open={openModal} onOpenChange={(open) => !loading && setOpenModal(open)
            }>
                <DialogContent className="sm:max-w-[450px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl">

                    <DialogHeader className="p-6 bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-500/20 p-3 rounded-xl">
                                <UserCog className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    Identificação
                                </DialogTitle>
                                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                                    {especialidadeNome}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-8 space-y-6">
                        {/* SALA */}
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Sala de Atendimento</Label>
                            {!isOutraSala ? (
                                <Select
                                    value={form.sala}
                                    onValueChange={(val) => val === "OUTRO" ? (setIsOutraSala(true), setForm({ ...form, sala: "" })) : setForm({ ...form, sala: val })}
                                >
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold uppercase">
                                        <SelectValue placeholder="QUAL SALA?" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800">
                                        {salasFiltradas.map(s => (
                                            <SelectItem key={s.id} value={s.numero} className="font-bold text-slate-900 dark:text-slate-100">Sala {s.numero}</SelectItem>
                                        ))}
                                        <SelectItem value="OUTRO" className="font-black text-emerald-600 dark:text-emerald-400">-- DIGITAR OUTRO --</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="relative">
                                    <Input
                                        autoFocus
                                        className="h-12 bg-slate-50 dark:bg-gray-900 border-emerald-500/50 text-slate-900 dark:text-white font-bold uppercase"
                                        value={form.sala}
                                        type="number"
                                        onChange={(e) => setForm({ ...form, sala: e.target.value.toUpperCase() })}
                                    />
                                    <X className="absolute right-3 top-4 w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setIsOutraSala(false)} />
                                </div>
                            )}
                        </div>

                        {/* PROFISSIONAL */}
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Profissional</Label>
                            {!isOutroProfissional ? (
                                <Select
                                    value={form.profissional}
                                    onValueChange={(val) => val === "OUTRO" ? (setIsOutroProfissional(true), setForm({ ...form, profissional: "" })) : setForm({ ...form, profissional: val })}
                                >
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold">
                                        <SelectValue placeholder="QUEM ATENDE?" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-gray-900 border-slate-200 dark:border-slate-800">
                                        {profissionaisFiltrados.map(p => (
                                            <SelectItem key={p.id} value={p.nome} className="font-bold text-slate-900 dark:text-slate-100">{p.nome}</SelectItem>
                                        ))}
                                        <SelectItem value="OUTRO" className="font-black text-emerald-600 dark:text-emerald-400">-- OUTRO --</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="relative">
                                    <Input
                                        autoFocus
                                        className="h-12 bg-slate-50 dark:bg-gray-900 border-emerald-500/50 text-slate-900 dark:text-white font-bold"
                                        value={form.profissional}
                                        onChange={(e) => setForm({ ...form, profissional: e.target.value })}
                                    />
                                    <X className="absolute right-3 top-4 w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setIsOutroProfissional(false)} />
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 dark:bg-gray-900 border-t border-slate-200 dark:border-slate-800">
                        <Button onClick={entrar} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest">
                            Entrar na Fila
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            {/* Modal de Alerta de Tempo de Atendimento */}
            < Dialog open={showTempoAlerta} onOpenChange={setShowTempoAlerta} >
                <DialogContent className="sm:max-w-[35vw] border-orange-500 border-3 overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-600">
                            <Clock className="w-5 h-5 animate-pulse" />
                            ALERTA DE TEMPO
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center space-y-3">
                        <p className="text-sm font-medium">
                            O atendimento atual já ultrapassou <span className="text-orange-600 font-bold">15 minutos</span>.
                        </p>
                        <p className="text-xs text-slate-500">
                            Você ainda está em atendimento com este paciente?
                        </p>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-col gap-2 items-center justify-center">
                        <Button
                            className="font-black bg-orange-400 hover:bg-orange-400"
                            onClick={() => {
                                setShowTempoAlerta(false);
                            }}
                        >
                            CONTINUAR ATENDENDO
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 font-black"
                            onClick={() => {
                                const item = data.find(i => i.id === atendimentoAtualId);
                                if (item) {
                                    setShowTempoAlerta(false);
                                    iniciarFinalizacao(item)
                                }
                            }}
                        >
                            FINALIZAR ATENDIMENTO
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >

            <StatusSenhaFilas
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                atendimento={selectedAtendimento}
            />
        </div >
    )
}