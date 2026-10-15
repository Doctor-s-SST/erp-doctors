"use client"

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    RefreshCw,
    FilePenLine,
    MessageCircleWarning,
    Signature,
    Search,
    ArrowUpDown,
    Send,
    FileCheck2,
    FileClock,
    FileWarning,
    X,
    MailCheck,
    RotateCcw,
} from "lucide-react";

import {
    Pacientes,
    ConfigOrdenacao,
    TipoConfirmacao,
    TipoFiltroStatus,
    TipoFiltroEnvio,
    TipoFiltroParaEnviar,
    ContadoresStatus,
} from "./types";
import { ConfirmarAcaoModal } from "./components/ConfirmarAcaoModal";
import { RegistrarPendenciaModal } from "./components/RegistrarPendenciaModal";
import { EnviarPendenciasModal } from "./components/EnviarPendenciasModal";
import { criarPayloadAcaoAso, criarPayloadAcoesAso, AcaoAso } from "@/lib/aso-assinatura";
import { mensagemErrosFuncionarios } from "@/lib/resultado-acao-aso";
import { ProblemaAcao, problemaDoPaciente, solicitarAcaoN8n } from "./resultado-acao";

type StatusLocal = "ASSINADO" | "PENDENCIA" | "ENVIADO" | "PENDENCIA_ENVIADA";

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
    ASSINADO: { label: "Assinado", className: "bg-blue-600 text-white" },
    PENDENCIA: { label: "Pendência", className: "bg-red-600 text-white" },
    ENVIADO: { label: "Enviado", className: "bg-green-600 text-white" },
    ENVIADO_DIRETO: { label: "Enviado direto", className: "bg-cyan-600 text-white" },
    PENDENCIA_ENVIADA: { label: "Pendência enviada", className: "bg-violet-600 text-white" },
};

export default function AssinaturaAsoPage() {
    const [pacientes, setPacientes] = useState<Pacientes[]>([]);
    const [loading, setLoading] = useState(false);
    const [unidadeId, setUnidadeId] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);

    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState<TipoFiltroStatus>("TODOS");
    const [filtroEnvio, setFiltroEnvio] = useState<TipoFiltroEnvio>("TODOS");
    const [filtroParaEnviar, setFiltroParaEnviar] = useState<TipoFiltroParaEnviar>("TODOS");
    const [ordenacao, setOrdenacao] = useState<ConfigOrdenacao>({
        coluna: "created_at",
        direcao: "desc",
    });

    // Estado para seleção em massa
    const [selecionadosEmMassa, setSelecionadosEmMassa] = useState<string[]>([]);

    const [tipoConfirmacao, setTipoConfirmacao] = useState<TipoConfirmacao>(null);
    const confirmModalOpen = tipoConfirmacao !== null;

    const [pendenciaOpen, setPendenciaOpen] = useState(false);
    const [justificativa, setJustificativa] = useState("");
    const [pendenciasParaEnviar, setPendenciasParaEnviar] = useState<Pacientes[]>([]);
    const [observacoesEnvioPendencia, setObservacoesEnvioPendencia] = useState<Record<string, string>>({});
    const [modoPendencia, setModoPendencia] = useState<"REGISTRAR" | "ENVIAR" | "REENVIAR">("ENVIAR");

    const [itemSelecionado, setItemSelecionado] = useState<Pacientes | null>(null);
    const [enviando, setEnviando] = useState(false);

    const requisicaoEmAndamento = useRef(false);
    const [problemasAcao, setProblemasAcao] = useState<ProblemaAcao[]>([]);
    const [resumoAcao, setResumoAcao] = useState<{
        total: number; concluidos: number; problemas: number;
    } | null>(null);

    // Permissões
    const isAdmin = role === "admin";
    const isEspecialista = role === "especialista" || isAdmin;
    const isOperador = role === "operador" || role === "recepcao" || isAdmin;

    useEffect(() => {
        const fetchUserContext = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("unidade_id, role")
                    .eq("id", user.id)
                    .single();

                if (profile?.unidade_id) setUnidadeId(profile.unidade_id);
                if (profile?.role) setRole(profile.role);
            }
        };
        fetchUserContext();
    }, []);

    const fetchPacientes = useCallback(async () => {
        if (!unidadeId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from("pacientes_assinatura")
            .select("*")
            .eq("unidade_id", unidadeId)
            .order("nome_paciente", {
                ascending: true,
            });

        if (error) {
            toast.error("Erro ao carregar pacientes.");
        } else {
            setPacientes(data || []);
            setSelecionadosEmMassa([]); // Reseta seleção
        }
        setLoading(false);
    }, [unidadeId]);

    useEffect(() => {
        if (unidadeId) {
            fetchPacientes();
        }
    }, [unidadeId, fetchPacientes]);

    // Cálculos dos contadores
    const contadores: ContadoresStatus = useMemo(() => {
        const paraAssinar = pacientes.filter((p) => !p.acao).length;
        const assinadosParaEnviar = pacientes.filter((p) => p.acao === "ASSINADO").length;
        const pendenciasParaEnviar = pacientes.filter((p) => p.acao === "PENDENCIA").length;
        const paraEnviar = assinadosParaEnviar + pendenciasParaEnviar;
        const pendencias = pacientes.filter((p) => p.acao === "PENDENCIA_ENVIADA").length;
        const enviadosFluxo = pacientes.filter((p) => p.acao === "ENVIADO").length;
        const enviadosDireto = pacientes.filter((p) => p.acao === "ENVIADO_DIRETO").length;
        const enviados = enviadosFluxo + enviadosDireto;

        return {
            paraAssinar,
            paraEnviar,
            assinadosParaEnviar,
            pendenciasParaEnviar,
            pendencias,
            enviados,
            enviadosFluxo,
            enviadosDireto,
        };
    }, [pacientes]);

    const toggleFiltro = (novoFiltro: TipoFiltroStatus) => {
        setFiltroEnvio("TODOS");
        setFiltroParaEnviar("TODOS");
        setSelecionadosEmMassa([]);
        setFiltroStatus((prev) => (prev === novoFiltro ? "TODOS" : novoFiltro));
    };

    const selecionarFiltroEnvio = (novoFiltro: TipoFiltroEnvio) => {
        setFiltroEnvio(novoFiltro);
        setSelecionadosEmMassa([]);
    };

    const selecionarFiltroParaEnviar = (novoFiltro: TipoFiltroParaEnviar) => {
        setFiltroParaEnviar(novoFiltro);
        setSelecionadosEmMassa([]);
    };

    const abrirConfirmarAssinatura = (item: Pacientes) => {
        setItemSelecionado(item);
        setTipoConfirmacao("ASSINATURA");
    };

    const abrirConfirmarEnvio = (item: Pacientes) => {
        setItemSelecionado(item);
        setTipoConfirmacao("ENVIO");
    };

    const abrirConfirmarReenvioAso = (item: Pacientes) => {
        setItemSelecionado(item);
        setTipoConfirmacao("REENVIO_ASO");
    };

    const abrirPendencias = (itens: Pacientes[], modo: "REGISTRAR" | "ENVIAR" | "REENVIAR") => {
        setModoPendencia(modo);
        setPendenciasParaEnviar(itens);
        setObservacoesEnvioPendencia(prev => Object.fromEntries(
            itens.flatMap(item => item.id ? [[item.id, prev[item.id] ?? item.observacao ?? ""]] : [])
        ));
    };

    const abrirEnvioPendencias = (itens: Pacientes[]) => abrirPendencias(itens, "ENVIAR");
    const abrirReenvioPendencias = (itens: Pacientes[]) => abrirPendencias(itens, "REENVIAR");

    const fecharEnvioPendencias = () => {
        if (requisicaoEmAndamento.current) return;
        setPendenciasParaEnviar([]);
        setObservacoesEnvioPendencia({});
    };

    const abrirPendencia = (item: Pacientes) => {
        setItemSelecionado(item);
        setJustificativa("");
        setPendenciaOpen(true);
    };

    const fecharConfirmModal = () => {
        if (requisicaoEmAndamento.current) return;
        setTipoConfirmacao(null);
        setItemSelecionado(null);
    };

    // Filtro e Ordenação combinados
    const dadosProcessados = useMemo(() => {
        let lista = [...pacientes];

        if (filtroStatus === "ASSINAR") {
            lista = lista.filter((p) => !p.acao);
        } else if (filtroStatus === "ENVIAR") {
            lista = lista.filter((p) => {
                if (filtroParaEnviar === "ASSINADO") return p.acao === "ASSINADO";
                if (filtroParaEnviar === "PENDENCIA") return p.acao === "PENDENCIA";
                return p.acao === "ASSINADO" || p.acao === "PENDENCIA";
            });
        } else if (filtroStatus === "PENDENCIA") {
            lista = lista.filter((p) => p.acao === "PENDENCIA_ENVIADA");
        } else if (filtroStatus === "ENVIADO") {
            lista = lista.filter((p) => {
                if (filtroEnvio === "ENVIADO") return p.acao === "ENVIADO";
                if (filtroEnvio === "ENVIADO_DIRETO") return p.acao === "ENVIADO_DIRETO";
                return p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO";
            });
        }

        if (busca.trim()) {
            const f = busca.toLowerCase().trim();
            lista = lista.filter(
                (p) =>
                    (p.nome_paciente || "").toLowerCase().includes(f) ||
                    (p.sequencial_ficha || "").toLowerCase().includes(f)
            );
        }

        return lista.sort((a, b) => {
            let valA: any = a[ordenacao.coluna] ?? "";
            let valB: any = b[ordenacao.coluna] ?? "";

            if (typeof valA === "string") valA = valA.toLowerCase();
            if (typeof valB === "string") valB = valB.toLowerCase();

            if (valA < valB) return ordenacao.direcao === "asc" ? -1 : 1;
            if (valA > valB) return ordenacao.direcao === "asc" ? 1 : -1;
            return 0;
        });
    }, [pacientes, busca, filtroStatus, filtroEnvio, filtroParaEnviar, ordenacao]);

    // Pacientes elegíveis para envio ou reenvio em massa na lista atual
    const elegiveisParaAcao = useMemo(() => {
        if (filtroStatus === "ASSINAR" && isEspecialista) {
            return dadosProcessados.filter((p) => !p.acao);
        }
        if (filtroStatus === "ENVIAR" && isOperador) {
            return dadosProcessados.filter((p) => p.acao === "ASSINADO" || p.acao === "PENDENCIA");
        }
        if (filtroStatus === "PENDENCIA" && isOperador) {
            return dadosProcessados.filter((p) => p.acao === "PENDENCIA_ENVIADA");
        }
        if (filtroStatus === "ENVIADO" && isOperador) {
            return dadosProcessados.filter((p) => p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO");
        }
        if (filtroStatus === "TODOS" && isOperador) {
            return dadosProcessados.filter((p) =>
                p.acao === "ENVIADO" ||
                p.acao === "ENVIADO_DIRETO" ||
                p.acao === "PENDENCIA_ENVIADA"
            );
        }
        return [];
    }, [dadosProcessados, filtroStatus, isEspecialista, isOperador]);

    const quantidadeSelecionadaPorTipo = useMemo(() => ({
        aso: pacientes.filter((p) => p.id && selecionadosEmMassa.includes(p.id) && p.acao === "ASSINADO").length,
        pendencia: pacientes.filter((p) => p.id && selecionadosEmMassa.includes(p.id) && p.acao === "PENDENCIA").length,
        reenvioAso: pacientes.filter((p) => p.id && selecionadosEmMassa.includes(p.id) && (p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO")).length,
        reenvioPendencia: pacientes.filter((p) => p.id && selecionadosEmMassa.includes(p.id) && p.acao === "PENDENCIA_ENVIADA").length,
    }), [pacientes, selecionadosEmMassa]);

    const quantidadeSelecionadaParaAssinar = pacientes.filter(
        (p) => p.id && selecionadosEmMassa.includes(p.id) && !p.acao
    ).length;

    // Lógica para Seleção em Massa
    const toggleSelectAll = () => {
        const idsElegiveis = elegiveisParaAcao.map((p) => p.id);
        const todosSelecionados = idsElegiveis.every((id: string | undefined) => selecionadosEmMassa.includes(id as string));

        if (todosSelecionados) {
            setSelecionadosEmMassa((prev: string[]) => prev.filter((id: string) => !idsElegiveis.includes(id)));
        } else {
            setSelecionadosEmMassa((prev: any) => Array.from(new Set([...prev, ...idsElegiveis])));
        }
    };

    const toggleSelectItem = (id: string) => {
        setSelecionadosEmMassa((prev: string[]) =>
            prev.includes(id) ? prev.filter((i: string) => i !== id) : [...prev, id]
        );
    };

    // Uma única interpretação de retorno para todas as ações da página.
    const executarAcao = async ({
        itens, acao, payload, statusLocal, observacoes, textoSucesso,
    }: {
        itens: Pacientes[];
        acao: AcaoAso;
        payload: unknown;
        statusLocal?: StatusLocal;
        observacoes?: Record<string, string>;
        textoSucesso: string;
    }): Promise<boolean> => {
        if (requisicaoEmAndamento.current || !itens.length) return false;
        if (itens.some(item => !item.id)) {
            toast.error("Existem pacientes sem identificação. Atualize a página antes de continuar.");
            return false;
        }
        requisicaoEmAndamento.current = true;
        setEnviando(true);
        setProblemasAcao([]);
        setResumoAcao(null);
        try {
            const resultado = await solicitarAcaoN8n(payload, itens, acao);
            const problemas = [...resultado.problemas];
            const atualizados: Array<{ id: string; dados: Partial<Pacientes> }> = [];

            // Só os pacientes confirmados pelo n8n podem mudar de status no banco.
            // Cada gravação tem resultado próprio, inclusive quando outra falha.
            if (statusLocal) {
                const gravacoes = await Promise.allSettled(resultado.confirmados.map(async paciente => {
                    const dados: Partial<Pacientes> = { acao: statusLocal };
                    const observacao = observacoes?.[paciente.id!];
                    if (observacao !== undefined) dados.observacao = observacao;
                    const { data, error } = await supabase.from("pacientes_assinatura")
                        .update(dados).eq("id", paciente.id!).select("id");
                    if (error || !data?.length) throw new Error("Gravação não confirmada.");
                    return { id: paciente.id!, dados };
                }));
                gravacoes.forEach((gravacao, indice) => {
                    if (gravacao.status === "fulfilled") {
                        atualizados.push(gravacao.value);
                    } else {
                        problemas.push(problemaDoPaciente(
                            resultado.confirmados[indice], acao,
                            "A ação foi confirmada pelo n8n, mas o status não pôde ser salvo nesta página. Confira o cadastro; não repita o envio apenas para corrigir o status.",
                            "banco", "atualizar_status"
                        ));
                    }
                });
                setPacientes(prev => prev.map(paciente => {
                    const atualizado = atualizados.find(item => item.id === paciente.id);
                    return atualizado ? { ...paciente, ...atualizado.dados } : paciente;
                }));
            }

            // Remove da seleção todo sucesso externo, mesmo se a gravação local falhar.
            // Isso evita incluir esse paciente novamente no próximo envio em massa.
            const idsConfirmados = new Set(resultado.confirmados.map(item => item.id!));
            setSelecionadosEmMassa(prev => prev.filter(id => !idsConfirmados.has(id)));
            const concluidos = statusLocal ? atualizados.length : resultado.confirmados.length;
            setProblemasAcao(problemas);
            setResumoAcao({ total: itens.length, concluidos, problemas: problemas.length });
            if (!problemas.length) {
                toast.success(`${concluidos} ${textoSucesso}`);
            } else {
                toast.error(mensagemErrosFuncionarios(problemas.map(problema => problema.nome)));
            }
        } catch (error) {
            const mensagem = error instanceof Error ? error.message : "Não foi possível confirmar o resultado da operação.";
            setProblemasAcao(itens.map(item => problemaDoPaciente(
                item, acao, mensagem, "resposta", "confirmar_resultado"
            )));
            setResumoAcao({ total: itens.length, concluidos: 0, problemas: itens.length });
            toast.error(mensagem);
        } finally {
            requisicaoEmAndamento.current = false;
            setEnviando(false);
        }
        return true;
    };

    // Confirmar Ação Individual
    const confirmarAcao = async () => {
        if (!itemSelecionado?.id || !tipoConfirmacao) return;
        const tipo = tipoConfirmacao;
        const acao: AcaoAso = tipo === "ASSINATURA" ? "ASSINADO"
            : tipo === "REENVIO_ASO" ? "REENVIAR-ASO" : "ENVIADO";
        const realizado = await executarAcao({
            itens: [itemSelecionado], acao,
            payload: criarPayloadAcaoAso([itemSelecionado], acao),
            statusLocal: tipo === "REENVIO_ASO" ? undefined : tipo === "ASSINATURA" ? "ASSINADO" : "ENVIADO",
            textoSucesso: tipo === "ASSINATURA" ? "ASO(s) marcado(s) como assinado(s)!"
                : tipo === "REENVIO_ASO" ? "ASO(s) reenviado(s) com sucesso!" : "ASO(s) enviado(s) com sucesso!",
        });
        if (realizado) fecharConfirmModal();
    };

    const enviarEmMassa = async (tipo: "ASO" | "PENDENCIA") => {
        const acaoAtual = tipo === "ASO" ? "ASSINADO" : "PENDENCIA";
        const itens = pacientes.filter(p => p.id && selecionadosEmMassa.includes(p.id) && p.acao === acaoAtual);
        if (!itens.length) return;
        if (tipo === "PENDENCIA") { abrirEnvioPendencias(itens); return; }
        await executarAcao({
            itens, acao: "ENVIADO", payload: criarPayloadAcaoAso(itens, "ENVIADO"),
            statusLocal: "ENVIADO", textoSucesso: "ASO(s) enviado(s) com sucesso!",
        });
    };

    const assinarEmMassa = async () => {
        const itens = pacientes.filter(p => p.id && selecionadosEmMassa.includes(p.id) && !p.acao);
        await executarAcao({
            itens, acao: "ASSINADO", payload: criarPayloadAcaoAso(itens, "ASSINADO"),
            statusLocal: "ASSINADO", textoSucesso: "ASO(s) marcado(s) como assinado(s)!",
        });
    };

    const abrirPendenciasEmMassa = () => {
        const itens = pacientes.filter(
            (p) => p.id && selecionadosEmMassa.includes(p.id) && !p.acao
        );
        if (itens.length) abrirPendencias(itens, "REGISTRAR");
    };

    const confirmarEnvioPendencias = async () => {
        const itens = pendenciasParaEnviar.filter(item => item.id);
        if (!itens.length) return;
        if (itens.some(item => !observacoesEnvioPendencia[item.id!]?.trim())) {
            toast.warning("Informe a justificativa de todos os pacientes.");
            return;
        }
        const registrando = modoPendencia === "REGISTRAR";
        const reenviando = modoPendencia === "REENVIAR";
        const acao: AcaoAso = registrando ? "PENDENCIA" : reenviando ? "REENVIAR-PENDENCIA" : "ENVIAR-PENDENCIA";
        const observacoes = Object.fromEntries(itens.map(item => [item.id!, observacoesEnvioPendencia[item.id!].trim()]));
        const realizado = await executarAcao({
            itens, acao,
            payload: criarPayloadAcoesAso(itens.map(paciente => ({
                paciente, acao, observacao: observacoes[paciente.id!],
            }))),
            statusLocal: registrando ? "PENDENCIA" : "PENDENCIA_ENVIADA",
            observacoes,
            textoSucesso: registrando ? "pendência(s) registrada(s) com sucesso!"
                : reenviando ? "pendência(s) reenviada(s) com sucesso!" : "pendência(s) enviada(s) com sucesso!",
        });
        if (realizado) {
            // Fecha o modal para mostrar os problemas. Mantém justificativas para nova abertura.
            setPendenciasParaEnviar([]);
        }
    };

    const reenviarAsoEmMassa = async () => {
        const itens = pacientes.filter(p => p.id && selecionadosEmMassa.includes(p.id)
            && (p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO"));
        await executarAcao({
            itens, acao: "REENVIAR-ASO", payload: criarPayloadAcaoAso(itens, "REENVIAR-ASO"),
            textoSucesso: "ASO(s) reenviado(s) com sucesso!",
        });
    };

    const reenviarPendenciaEmMassa = () => {
        const itensParaReenviar = pacientes.filter(
            (p) => p.id && selecionadosEmMassa.includes(p.id) && p.acao === "PENDENCIA_ENVIADA"
        );
        if (itensParaReenviar.length) {
            abrirReenvioPendencias(itensParaReenviar);
        }
    };

    const confirmarPendencia = async () => {
        if (!itemSelecionado?.id) return;
        if (!justificativa.trim()) {
            toast.warning("Informe a justificativa da pendência.");
            return;
        }
        const realizado = await executarAcao({
            itens: [itemSelecionado], acao: "PENDENCIA",
            payload: criarPayloadAcaoAso([itemSelecionado], "PENDENCIA", justificativa.trim()),
            statusLocal: "PENDENCIA", observacoes: { [itemSelecionado.id]: justificativa.trim() },
            textoSucesso: "pendência(s) registrada(s) com sucesso!",
        });
        if (realizado) { setPendenciaOpen(false); setItemSelecionado(null); }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado!");
    };

    const handleSort = (coluna: keyof Pacientes) => {
        setOrdenacao((prev) => ({
            coluna,
            direcao:
                prev.coluna === coluna && prev.direcao === "asc" ? "desc" : "asc",
        }));
    };

    const renderThOrdenavel = ({
        label,
        coluna,
    }: {
        label: string;
        coluna: keyof Pacientes;
    }) => {
        const isAtivo = ordenacao.coluna === coluna;

        return (
            <TableHead
                className={`font-bold text-xs uppercase cursor-pointer select-none transition-colors ${isAtivo ? "text-blue-600" : ""
                    }`}
                onClick={() => handleSort(coluna)}
            >
                <div className="flex items-center gap-1">
                    {label}
                    <ArrowUpDown
                        className={`w-3 h-3 ${isAtivo ? "opacity-100" : "opacity-30"}`}
                    />
                </div>
            </TableHead>
        );
    };

    return (
        <div className="min-h-fit mt-2 space-y-4 bg-gray-500/20 rounded-xl p-2">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20 text-blue-400">
                        <Signature className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">
                            Assinatura e Envio de ASO
                        </h1>
                        <p className="text-xs text-slate-400 font-mono">
                            Controle de envio de ASO&apos;s
                        </p>
                    </div>
                </div>

                {isEspecialista && filtroStatus === "ASSINAR" && quantidadeSelecionadaParaAssinar > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={assinarEmMassa} disabled={enviando} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                            <FilePenLine className="w-4 h-4" />
                            Assinar {quantidadeSelecionadaParaAssinar} ASO(s)
                        </Button>
                        <Button onClick={abrirPendenciasEmMassa} disabled={enviando} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                            <MessageCircleWarning className="w-4 h-4" />
                            Registrar {quantidadeSelecionadaParaAssinar} pendência(s)
                        </Button>
                    </div>
                )}

                {/* BOTÃO DE ENVIO EM MASSA NO HEADER QUANDO HOUVER SELEÇÃO */}
                {isOperador && filtroStatus === "ENVIAR" && selecionadosEmMassa.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        {quantidadeSelecionadaPorTipo.aso > 0 && (
                            <Button onClick={() => enviarEmMassa("ASO")} disabled={enviando} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                                <Send className="w-4 h-4" /> Enviar {quantidadeSelecionadaPorTipo.aso} ASO(s)
                            </Button>
                        )}
                        {quantidadeSelecionadaPorTipo.pendencia > 0 && (
                            <Button onClick={() => enviarEmMassa("PENDENCIA")} disabled={enviando} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                                <MessageCircleWarning className="w-4 h-4" /> Enviar {quantidadeSelecionadaPorTipo.pendencia} pendência(s)
                            </Button>
                        )}
                    </div>
                )}

                {/* BOTÃO DE REENVIO EM MASSA DE PENDÊNCIAS */}
                {isOperador && (filtroStatus === "PENDENCIA" || filtroStatus === "TODOS") && quantidadeSelecionadaPorTipo.reenvioPendencia > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={reenviarPendenciaEmMassa} disabled={enviando} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                            <RotateCcw className="w-4 h-4" /> Reenviar {quantidadeSelecionadaPorTipo.reenvioPendencia} pendência(s)
                        </Button>
                    </div>
                )}

                {/* BOTÃO DE REENVIO EM MASSA DE ASO */}
                {isOperador && (filtroStatus === "ENVIADO" || filtroStatus === "TODOS") && quantidadeSelecionadaPorTipo.reenvioAso > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={reenviarAsoEmMassa} disabled={enviando} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                            <RotateCcw className="w-4 h-4" /> Reenviar {quantidadeSelecionadaPorTipo.reenvioAso} ASO(s)
                        </Button>
                    </div>
                )}
            </header>

            {enviando && (
                <div role="status" aria-live="polite" className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                    Processando os pacientes. Aguarde o resultado antes de repetir a ação.
                </div>
            )}

            {resumoAcao && (
                <section aria-label="Resultado da última operação" aria-live="polite"
                    className={`rounded-lg border p-4 ${resumoAcao.problemas
                        ? "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
                        : "border-green-300 bg-green-50 text-green-950 dark:bg-green-950 dark:text-green-100"}`}>
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-sm">
                            {resumoAcao.concluidos} de {resumoAcao.total} funcionário(s) concluído(s)
                        </p>
                        <Button type="button" variant="ghost" size="sm" aria-label="Fechar resultado"
                            onClick={() => { setResumoAcao(null); setProblemasAcao([]); }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {problemasAcao.length > 0 && (
                        <>
                            <p className="mt-2 text-xs">Não foi possível processar:</p>
                            <ul className="mt-2 space-y-1 max-h-80 overflow-y-auto">
                                {problemasAcao.map((problema, indice) => (
                                    <li key={`${problema.id}-${indice}`} className="text-sm font-semibold">{problema.nome}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            )}


            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-1">
                <CardHeader className="flex flex-col items-stretch gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
                    {/* CARDS DE CONTADORES */}
                    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {/* CARD 1: PARA ASSINAR */}
                        <div
                            onClick={() => toggleFiltro("ASSINAR")}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${filtroStatus === "ASSINAR"
                                ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
                                : "bg-slate-50/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-800 hover:border-amber-400"
                                }`}
                        >
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Assinar
                                </p>
                                <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                    {contadores.paraAssinar}
                                </p>
                            </div>
                            <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 shrink-0">
                                <FileClock className="w-5 h-5" />
                            </div>
                        </div>

                        {/* CARD 2: PARA ENVIAR */}
                        <div
                            onClick={() => toggleFiltro("ENVIAR")}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${filtroStatus === "ENVIAR"
                                ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20"
                                : "bg-slate-50/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-800 hover:border-blue-400"
                                }`}
                        >
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Enviar
                                </p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                    {contadores.paraEnviar}
                                </p>
                            </div>
                            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500 shrink-0">
                                <FileCheck2 className="w-5 h-5" />
                            </div>
                        </div>

                        {/* CARD 3: PENDÊNCIAS */}
                        <div
                            onClick={() => toggleFiltro("PENDENCIA")}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${filtroStatus === "PENDENCIA"
                                ? "bg-red-500/10 border-red-500 ring-2 ring-red-500/20"
                                : "bg-slate-50/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-800 hover:border-red-400"
                                }`}
                        >
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Pendências
                                </p>
                                <p className="text-2xl font-black text-red-600 dark:text-red-400">
                                    {contadores.pendencias}
                                </p>
                            </div>
                            <div className="bg-red-500/10 p-2 rounded-lg text-red-500 shrink-0">
                                <FileWarning className="w-5 h-5" />
                            </div>
                        </div>

                        {/* CARD 4: ENVIADOS */}
                        <div
                            onClick={() => toggleFiltro("ENVIADO")}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${filtroStatus === "ENVIADO"
                                ? "bg-green-500/10 border-green-500 ring-2 ring-green-500/20"
                                : "bg-slate-50/50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-800 hover:border-green-400"
                                }`}
                        >
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    ASO enviado
                                </p>
                                <p className="text-2xl font-black text-green-600 dark:text-green-400">
                                    {contadores.enviados}
                                </p>
                            </div>
                            <div className="bg-green-500/10 p-2 rounded-lg text-green-500 shrink-0">
                                <MailCheck className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* BARRA DE PESQUISA E AÇÕES */}
                    <div className="flex w-full flex-col gap-2 pt-1">
                        {filtroStatus === "ENVIAR" && (
                            <div
                                className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-gray-700 dark:bg-gray-800"
                                aria-label="Separar ASOs aguardando envio"
                            >
                                {([
                                    { valor: "TODOS", rotulo: "Todos", quantidade: contadores.paraEnviar },
                                    { valor: "ASSINADO", rotulo: "Assinado", quantidade: contadores.assinadosParaEnviar },
                                    { valor: "PENDENCIA", rotulo: "Pendência", quantidade: contadores.pendenciasParaEnviar },
                                ] as const).map((opcao) => (
                                    <button
                                        key={opcao.valor}
                                        type="button"
                                        aria-pressed={filtroParaEnviar === opcao.valor}
                                        onClick={() => selecionarFiltroParaEnviar(opcao.valor)}
                                        className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors sm:text-xs ${
                                            filtroParaEnviar === opcao.valor
                                                ? "bg-white text-slate-900 shadow-sm dark:bg-gray-950 dark:text-white"
                                                : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-gray-700 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        <span className="truncate">{opcao.rotulo}</span>
                                        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-gray-700">
                                            {opcao.quantidade}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {filtroStatus === "ENVIADO" && (
                            <div
                                className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-gray-700 dark:bg-gray-800"
                                aria-label="Separar ASOs enviados"
                            >
                                {([
                                    { valor: "TODOS", rotulo: "Todos", quantidade: contadores.enviados },
                                    { valor: "ENVIADO", rotulo: "Enviado", quantidade: contadores.enviadosFluxo },
                                    { valor: "ENVIADO_DIRETO", rotulo: "Enviado direto", quantidade: contadores.enviadosDireto },
                                ] as const).map((opcao) => (
                                    <button
                                        key={opcao.valor}
                                        type="button"
                                        aria-pressed={filtroEnvio === opcao.valor}
                                        onClick={() => selecionarFiltroEnvio(opcao.valor)}
                                        className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors sm:text-xs ${
                                            filtroEnvio === opcao.valor
                                                ? "bg-white text-slate-900 shadow-sm dark:bg-gray-950 dark:text-white"
                                                : "text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-gray-700 dark:hover:text-slate-100"
                                        }`}
                                    >
                                        <span className="truncate">{opcao.rotulo}</span>
                                        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-gray-700">
                                            {opcao.quantidade}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex w-full flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center sm:justify-end">
                            {filtroStatus !== "TODOS" && (
                                <Badge
                                    variant="outline"
                                    className="flex w-fit items-center gap-1.5 px-3 py-1 text-xs cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                                    onClick={() => {
                                        setFiltroStatus("TODOS");
                                        setFiltroEnvio("TODOS");
                                        setFiltroParaEnviar("TODOS");
                                        setSelecionadosEmMassa([]);
                                    }}
                                >
                                    <span>
                                        Filtrando por:{" "}
                                        <strong>
                                            {filtroStatus === "ENVIADO" && filtroEnvio !== "TODOS"
                                                ? BADGE_CONFIG[filtroEnvio].label
                                                : filtroStatus === "ENVIAR" && filtroParaEnviar !== "TODOS"
                                                    ? BADGE_CONFIG[filtroParaEnviar].label
                                                    : filtroStatus}
                                        </strong>
                                    </span>
                                    <X className="w-3.5 h-3.5 text-slate-500" />
                                </Badge>
                            )}

                            <div className="flex items-center gap-2 sm:ml-auto">
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 h-9 w-full sm:w-72 transition-colors focus-within:border-blue-500">
                                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                                    <Input
                                        placeholder="Buscar por nome ou sequencial..."
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                        className="h-full border-none shadow-none px-0 text-xs focus-visible:ring-0 bg-transparent"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={enviando || loading}
                                    onClick={() => void fetchPacientes()}
                                    className="h-9 w-9 shrink-0"
                                >
                                    <RefreshCw
                                        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                                    />
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="overflow-x-auto p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow>
                                {/* CHECKBOX SELECIONAR TODOS OS ELEGÍVEIS */}
                                {(isOperador || isEspecialista) && (
                                    <TableHead className="w-10 text-center">
                                        <Checkbox
                                            checked={
                                                elegiveisParaAcao.length > 0 &&
                                                elegiveisParaAcao.every((p: any) =>
                                                    selecionadosEmMassa.includes(p.id)
                                                )
                                            }
                                            onCheckedChange={toggleSelectAll}
                                            disabled={enviando || elegiveisParaAcao.length === 0}
                                            className="h-5 w-5 border-2 border-slate-500 bg-white shadow-sm data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-slate-400 dark:bg-slate-900"
                                        />
                                    </TableHead>
                                )}
                                {renderThOrdenavel({ label: "Nome", coluna: "nome_paciente" })}
                                {renderThOrdenavel({ label: "Sequencial da Ficha", coluna: "sequencial_ficha" })}
                                {renderThOrdenavel({ label: "Data de Liberação", coluna: "created_at" })}
                                <TableHead className="font-bold text-xs uppercase">
                                    Observação
                                </TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right">
                                    Ações
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {dadosProcessados.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={isOperador || isEspecialista ? 6 : 5}
                                        className="text-center py-8 text-xs text-slate-400 font-mono"
                                    >
                                        Nenhum registro encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dadosProcessados.map((item: any) => {
                                    const badge = item.acao ? BADGE_CONFIG[item.acao] : null;
                                    const canSelect =
                                        (isEspecialista && filtroStatus === "ASSINAR" && !item.acao) ||
                                        (isOperador && filtroStatus === "ENVIAR" && (item.acao === "ASSINADO" || item.acao === "PENDENCIA")) ||
                                        (isOperador && filtroStatus === "PENDENCIA" && item.acao === "PENDENCIA_ENVIADA") ||
                                        (isOperador && filtroStatus === "ENVIADO" && (item.acao === "ENVIADO" || item.acao === "ENVIADO_DIRETO"));
                                    const isSelected = selecionadosEmMassa.includes(item.id);

                                    return (
                                        <TableRow
                                            key={item.id}
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                                                }`}
                                        >
                                            {/* CHECKBOX DA LINHA */}
                                            {(isOperador || isEspecialista) && (
                                                <TableCell className="text-center">
                                                    {canSelect && (
                                                        <Checkbox
                                                            disabled={enviando}
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleSelectItem(item.id)}
                                                            className="h-5 w-5 border-2 border-slate-500 bg-white shadow-sm data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-slate-400 dark:bg-slate-900"
                                                        />
                                                    )}
                                                </TableCell>
                                            )}

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
                                                {item.observacao || ""}
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    {isEspecialista && filtroStatus === "ASSINAR" && !item.acao && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={enviando} onClick={() => abrirConfirmarAssinatura(item)}
                                                                className="w-fit px-2 flex gap-2 font-medium text-green-600 bg-green-500/10 hover:bg-green-500/20 hover:text-green-600 border border-green-500/30"
                                                            >
                                                                <FilePenLine className="w-4 h-4" />
                                                                <span>ASO Assinado</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={enviando} onClick={() => abrirPendencia(item)}
                                                                className="w-fit px-2 flex gap-2 font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 hover:text-red-600 border border-red-500/30"
                                                            >
                                                                <MessageCircleWarning className="w-4 h-4" />
                                                                <span>ASO com pendência</span>
                                                            </Button>
                                                        </>
                                                    )}

                                                    {isOperador && filtroStatus === "ENVIAR" && item.acao === "ASSINADO" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={enviando} onClick={() => abrirConfirmarEnvio(item)}
                                                            className="w-fit px-2 flex gap-2 font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-600 border border-blue-500/30 ml-auto"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                            <span>Enviar ASO</span>
                                                        </Button>
                                                    )}

                                                    {isOperador && filtroStatus === "ENVIAR" && item.acao === "PENDENCIA" && (
                                                        <Button variant="ghost" size="sm" disabled={enviando} onClick={() => abrirEnvioPendencias([item])} className="w-fit px-2 flex gap-2 font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 ml-auto">
                                                            <MessageCircleWarning className="w-4 h-4" />
                                                            <span>Enviar pendência</span>
                                                        </Button>
                                                    )}

                                                    {/* REENVIAR ASO */}
                                                    {isOperador && (filtroStatus === "ENVIADO" || filtroStatus === "TODOS") && (item.acao === "ENVIADO" || item.acao === "ENVIADO_DIRETO") && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={enviando} onClick={() => abrirConfirmarReenvioAso(item)}
                                                            className="w-fit px-2 flex gap-1.5 font-medium text-cyan-600 bg-cyan-500/10 hover:bg-cyan-500/20 hover:text-cyan-600 border border-cyan-500/30"
                                                            title="Reenviar ASO"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            <span>Reenviar ASO</span>
                                                        </Button>
                                                    )}

                                                    {/* REENVIAR PENDÊNCIA */}
                                                    {isOperador && (filtroStatus === "PENDENCIA" || filtroStatus === "TODOS") && item.acao === "PENDENCIA_ENVIADA" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={enviando} onClick={() => abrirReenvioPendencias([item])}
                                                            className="w-fit px-2 flex gap-1.5 font-medium text-violet-600 bg-violet-500/10 hover:bg-violet-500/20 hover:text-violet-600 border border-violet-500/30"
                                                            title="Reenviar pendência"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                            <span>Reenviar pendência</span>
                                                        </Button>
                                                    )}

                                                    {badge && (
                                                        <Badge
                                                            className={`uppercase text-[10px] font-bold tracking-wider border-none ${badge.className}`}
                                                        >
                                                            {badge.label}
                                                        </Badge>
                                                    )}

                                                    {!item.acao && !(isEspecialista && filtroStatus === "ASSINAR") && (
                                                        <span className="text-xs text-slate-400 italic">
                                                            Aguardando Assinatura
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* MODAL: CONFIRMAR ASSINATURA OU ENVIO INDIVIDUAL */}
            <ConfirmarAcaoModal
                open={confirmModalOpen}
                tipoConfirmacao={tipoConfirmacao}
                itemSelecionado={itemSelecionado}
                enviando={enviando}
                onClose={fecharConfirmModal}
                onConfirm={confirmarAcao}
            />

            {/* MODAL: PENDÊNCIA COM JUSTIFICATIVA */}
            <RegistrarPendenciaModal
                open={pendenciaOpen}
                itemSelecionado={itemSelecionado}
                justificativa={justificativa}
                enviando={enviando}
                onJustificativaChange={setJustificativa}
                onClose={() => { if (!requisicaoEmAndamento.current) setPendenciaOpen(false); }}
                onConfirm={confirmarPendencia}
            />

            <EnviarPendenciasModal
                open={pendenciasParaEnviar.length > 0}
                pacientes={pendenciasParaEnviar}
                observacoes={observacoesEnvioPendencia}
                enviando={enviando}
                onObservacaoChange={(id, value) => setObservacoesEnvioPendencia((prev) => ({ ...prev, [id]: value }))}
                onClose={fecharEnvioPendencias}
                onConfirm={confirmarEnvioPendencias}
                titulo={
                    modoPendencia === "REGISTRAR"
                        ? "Registrar pendências"
                        : modoPendencia === "REENVIAR"
                            ? "Reenviar pendências"
                            : "Enviar pendências"
                }
                descricao={
                    modoPendencia === "REGISTRAR"
                        ? "Informe uma justificativa específica para cada paciente."
                        : modoPendencia === "REENVIAR"
                            ? "Revise ou personalize a justificativa que será reenviada para cada paciente."
                            : "Revise ou personalize a justificativa que será enviada para cada paciente."
                }
                textoConfirmar={
                    modoPendencia === "REGISTRAR"
                        ? "Registrar pendências"
                        : modoPendencia === "REENVIAR"
                            ? `Reenviar pendência${pendenciasParaEnviar.length > 1 ? "s" : ""}`
                            : `Enviar pendência${pendenciasParaEnviar.length > 1 ? "s" : ""}`
                }
            />
        </div>
    );
}
