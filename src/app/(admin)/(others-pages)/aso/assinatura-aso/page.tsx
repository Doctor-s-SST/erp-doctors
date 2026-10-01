"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
    CheckSquare,
    RotateCcw,
} from "lucide-react";

import {
    Pacientes,
    ConfigOrdenacao,
    TipoConfirmacao,
    TipoFiltroStatus,
    ContadoresStatus,
} from "./types";
import { ConfirmarAcaoModal } from "./components/ConfirmarAcaoModal";
import { RegistrarPendenciaModal } from "./components/RegistrarPendenciaModal";
import { EnviarPendenciasModal } from "./components/EnviarPendenciasModal";
import { criarPayloadAcaoAso, criarPayloadAcoesAso, AcaoAso } from "@/lib/aso-assinatura";

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
        const paraEnviar = pacientes.filter((p) => p.acao === "ASSINADO" || p.acao === "PENDENCIA").length;
        const pendencias = pacientes.filter((p) => p.acao === "PENDENCIA_ENVIADA").length;
        const enviados = pacientes.filter((p) => p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO").length;

        return { paraAssinar, paraEnviar, pendencias, enviados };
    }, [pacientes]);

    const toggleFiltro = (novoFiltro: TipoFiltroStatus) => {
        setFiltroStatus((prev) => (prev === novoFiltro ? "TODOS" : novoFiltro));
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
        setObservacoesEnvioPendencia(Object.fromEntries(
            itens.flatMap((item) => item.id ? [[item.id, item.observacao || ""]] : [])
        ));
    };

    const abrirEnvioPendencias = (itens: Pacientes[]) => abrirPendencias(itens, "ENVIAR");
    const abrirReenvioPendencias = (itens: Pacientes[]) => abrirPendencias(itens, "REENVIAR");

    const fecharEnvioPendencias = () => {
        setPendenciasParaEnviar([]);
        setObservacoesEnvioPendencia({});
    };

    const abrirPendencia = (item: Pacientes) => {
        setItemSelecionado(item);
        setJustificativa("");
        setPendenciaOpen(true);
    };

    const fecharConfirmModal = () => {
        setTipoConfirmacao(null);
        setItemSelecionado(null);
    };

    // Filtro e Ordenação combinados
    const dadosProcessados = useMemo(() => {
        let lista = [...pacientes];

        if (filtroStatus === "ASSINAR") {
            lista = lista.filter((p) => !p.acao);
        } else if (filtroStatus === "ENVIAR") {
            lista = lista.filter((p) => p.acao === "ASSINADO" || p.acao === "PENDENCIA");
        } else if (filtroStatus === "PENDENCIA") {
            lista = lista.filter((p) => p.acao === "PENDENCIA_ENVIADA");
        } else if (filtroStatus === "ENVIADO") {
            lista = lista.filter((p) => p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO");
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
    }, [pacientes, busca, filtroStatus, ordenacao]);

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

    async function enviarAcaoAso(
        pacientesParaEnviar: Pacientes[],
        acao: AcaoAso,
        observacao?: string
    ) {
        const response = await fetch("/api/enviar-asos-concluidos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(criarPayloadAcaoAso(pacientesParaEnviar, acao, observacao)),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro na API:", errorText);
            throw new Error("Falha ao notificar a API");
        }

        return response.json();
    }

    const registrarAcao = async (
        ids: string[],
        acao: "ASSINADO" | "PENDENCIA" | "ENVIADO" | "PENDENCIA_ENVIADA",
        observacao?: string
    ) => {
        const payload: Partial<Pacientes> = { acao };
        if (observacao) payload.observacao = observacao;

        const { error } = await supabase
            .from("pacientes_assinatura")
            .update(payload)
            .in("id", ids);

        if (error) throw error;

        setPacientes((prev: any) =>
            prev.map((p: any) => (ids.includes(p.id) ? { ...p, ...payload } : p))
        );
    };

    // Confirmar Ação Individual
    const confirmarAcao = async () => {
        if (!itemSelecionado?.id || !tipoConfirmacao) return;

        const acao: AcaoAso =
            tipoConfirmacao === "ASSINATURA"
                ? "ASSINADO"
                : tipoConfirmacao === "REENVIO_ASO"
                    ? "REENVIAR-ASO"
                    : "ENVIADO";

        setEnviando(true);
        try {
            await enviarAcaoAso([itemSelecionado], acao);
            if (tipoConfirmacao !== "REENVIO_ASO") {
                await registrarAcao([itemSelecionado.id], acao as any);
            }

            toast.success(
                tipoConfirmacao === "ASSINATURA"
                    ? "ASO assinado!"
                    : tipoConfirmacao === "REENVIO_ASO"
                        ? "ASO reenviado com sucesso!"
                        : "ASO enviado!"
            );
            fecharConfirmModal();
        } catch (err) {
            console.error(err);
            toast.error("Erro ao registrar a ação do ASO.");
        } finally {
            setEnviando(false);
        }
    };

    // Confirmar Envio em Massa
    const enviarEmMassa = async (tipo: "ASO" | "PENDENCIA") => {
        const acaoAtual = tipo === "ASO" ? "ASSINADO" : "PENDENCIA";
        const itensParaEnviar = pacientes.filter((p) => p.id && selecionadosEmMassa.includes(p.id) && p.acao === acaoAtual);
        const ids = itensParaEnviar.flatMap((p) => p.id ? [p.id] : []);
        if (!itensParaEnviar.length) return;
        if (tipo === "PENDENCIA") {
            abrirEnvioPendencias(itensParaEnviar);
            return;
        }

        setEnviando(true);
        try {
            await enviarAcaoAso(itensParaEnviar, "ENVIADO");
            await registrarAcao(ids, "ENVIADO");

            toast.success(`${itensParaEnviar.length} ASO(s) enviados com sucesso!`);
            setSelecionadosEmMassa((prev) => prev.filter((id) => !ids.includes(id)));
        } catch (err) {
            console.error(err);
            toast.error("Erro ao realizar o envio em massa dos ASOs.");
        } finally {
            setEnviando(false);
        }
    };

    const assinarEmMassa = async () => {
        const itens = pacientes.filter(
            (p) => p.id && selecionadosEmMassa.includes(p.id) && !p.acao
        );
        const ids = itens.flatMap((p) => p.id ? [p.id] : []);
        if (!itens.length) return;

        setEnviando(true);
        try {
            await enviarAcaoAso(itens, "ASSINADO");
            await registrarAcao(ids, "ASSINADO");
            setSelecionadosEmMassa((prev) => prev.filter((id) => !ids.includes(id)));
            toast.success(`${itens.length} ASO(s) marcado(s) como assinado(s)!`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao registrar as assinaturas em massa.");
        } finally {
            setEnviando(false);
        }
    };

    const abrirPendenciasEmMassa = () => {
        const itens = pacientes.filter(
            (p) => p.id && selecionadosEmMassa.includes(p.id) && !p.acao
        );
        if (itens.length) abrirPendencias(itens, "REGISTRAR");
    };

    const confirmarEnvioPendencias = async () => {
        const itens = pendenciasParaEnviar.filter((item) => item.id);
        if (itens.some((item) => !observacoesEnvioPendencia[item.id!]?.trim())) {
            toast.warning("Informe a justificativa de todos os pacientes.");
            return;
        }

        setEnviando(true);
        try {
            const registrando = modoPendencia === "REGISTRAR";
            const reenviando = modoPendencia === "REENVIAR";
            const acaoApi: AcaoAso = registrando
                ? "PENDENCIA"
                : reenviando
                    ? "REENVIAR-PENDENCIA"
                    : "ENVIAR-PENDENCIA";

            const response = await fetch("/api/enviar-asos-concluidos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(criarPayloadAcoesAso(itens.map((paciente) => ({
                    paciente,
                    acao: acaoApi,
                    observacao: observacoesEnvioPendencia[paciente.id!].trim(),
                })))),
            });
            if (!response.ok) throw new Error("Falha ao enviar pendências");

            const statusBd = registrando ? ("PENDENCIA" as const) : ("PENDENCIA_ENVIADA" as const);

            const resultados = await Promise.all(itens.map((paciente) => supabase
                .from("pacientes_assinatura")
                .update({
                    acao: statusBd,
                    observacao: observacoesEnvioPendencia[paciente.id!].trim(),
                })
                .eq("id", paciente.id!)));
            const erro = resultados.find((resultado) => resultado.error)?.error;
            if (erro) throw erro;

            const ids = itens.map((item) => item.id!);
            setPacientes((prev) => prev.map((paciente) => paciente.id && ids.includes(paciente.id)
                ? {
                    ...paciente,
                    acao: statusBd,
                    observacao: observacoesEnvioPendencia[paciente.id].trim(),
                }
                : paciente));
            setSelecionadosEmMassa((prev) => prev.filter((id) => !ids.includes(id)));
            toast.success(
                registrando
                    ? `${itens.length} pendência(s) registrada(s) com sucesso!`
                    : reenviando
                        ? `${itens.length} pendência(s) reenviada(s) com sucesso!`
                        : `${itens.length} pendência(s) enviada(s) com sucesso!`
            );
            fecharEnvioPendencias();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar as pendências.");
        } finally {
            setEnviando(false);
        }
    };

    const reenviarAsoEmMassa = async () => {
        const itensParaReenviar = pacientes.filter(
            (p) => p.id && selecionadosEmMassa.includes(p.id) && (p.acao === "ENVIADO" || p.acao === "ENVIADO_DIRETO")
        );
        if (!itensParaReenviar.length) return;

        const ids = itensParaReenviar.flatMap((p) => (p.id ? [p.id] : []));

        setEnviando(true);
        try {
            await enviarAcaoAso(itensParaReenviar, "REENVIAR-ASO");
            toast.success(`${itensParaReenviar.length} ASO(s) reenviado(s) com sucesso!`);
            setSelecionadosEmMassa((prev) => prev.filter((id) => !ids.includes(id)));
        } catch (err) {
            console.error(err);
            toast.error("Erro ao reenviar os ASOs.");
        } finally {
            setEnviando(false);
        }
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

        setEnviando(true);
        try {
            await enviarAcaoAso([itemSelecionado], "PENDENCIA", justificativa.trim());
            await registrarAcao([itemSelecionado.id], "PENDENCIA", justificativa.trim());

            toast.success("Pendência registrada e empresa notificada!");
            setPendenciaOpen(false);
            setItemSelecionado(null);
            setJustificativa("");
        } catch (err) {
            console.error(err);
            toast.error("Erro ao registrar a pendência do ASO.");
        } finally {
            setEnviando(false);
        }
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

    const ThOrdenavel = ({
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
                {isOperador && filtroStatus === "PENDENCIA" && quantidadeSelecionadaPorTipo.reenvioPendencia > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={reenviarPendenciaEmMassa} disabled={enviando} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                            <RotateCcw className="w-4 h-4" /> Reenviar {quantidadeSelecionadaPorTipo.reenvioPendencia} pendência(s)
                        </Button>
                    </div>
                )}

                {/* BOTÃO DE REENVIO EM MASSA DE ASO */}
                {isOperador && filtroStatus === "ENVIADO" && quantidadeSelecionadaPorTipo.reenvioAso > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={reenviarAsoEmMassa} disabled={enviando} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                            <RotateCcw className="w-4 h-4" /> Reenviar {quantidadeSelecionadaPorTipo.reenvioAso} ASO(s)
                        </Button>
                    </div>
                )}
            </header>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-1">
                <CardHeader className="flex flex-col md:flex-row items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                    {/* CARDS DE CONTADORES */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
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
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full pt-1">
                        {filtroStatus !== "TODOS" && (
                            <Badge
                                variant="outline"
                                className="flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => setFiltroStatus("TODOS")}
                            >
                                <span>
                                    Filtrando por: <strong>{filtroStatus}</strong>
                                </span>
                                <X className="w-3.5 h-3.5 text-slate-500" />
                            </Badge>
                        )}

                        <div className="flex items-center gap-2">
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
                                onClick={fetchPacientes}
                                className="h-9 w-9 shrink-0"
                            >
                                <RefreshCw
                                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                                />
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
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
                                            disabled={elegiveisParaAcao.length === 0}
                                        />
                                    </TableHead>
                                )}
                                <ThOrdenavel label="Nome" coluna="nome_paciente" />
                                <ThOrdenavel label="Sequencial da Ficha" coluna="sequencial_ficha" />
                                <ThOrdenavel label="Data de Liberação" coluna="created_at" />
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
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleSelectItem(item.id)}
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
                                                <div className="flex flex-row items-center justify-end gap-2">
                                                    {isEspecialista && filtroStatus === "ASSINAR" && !item.acao && (
                                                        <>
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
                                                        </>
                                                    )}

                                                    {isOperador && filtroStatus === "ENVIAR" && item.acao === "ASSINADO" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => abrirConfirmarEnvio(item)}
                                                            className="w-fit px-2 flex gap-2 font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-600 border border-blue-500/30 ml-auto"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                            <span>Enviar ASO</span>
                                                        </Button>
                                                    )}

                                                    {isOperador && filtroStatus === "ENVIAR" && item.acao === "PENDENCIA" && (
                                                        <Button variant="ghost" size="sm" onClick={() => abrirEnvioPendencias([item])} className="w-fit px-2 flex gap-2 font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 ml-auto">
                                                            <MessageCircleWarning className="w-4 h-4" />
                                                            <span>Enviar pendência</span>
                                                        </Button>
                                                    )}

                                                    {/* REENVIAR ASO */}
                                                    {isOperador && (filtroStatus === "ENVIADO" || filtroStatus === "TODOS") && (item.acao === "ENVIADO" || item.acao === "ENVIADO_DIRETO") && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => abrirConfirmarReenvioAso(item)}
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
                                                            onClick={() => abrirReenvioPendencias([item])}
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
                onClose={() => setPendenciaOpen(false)}
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
