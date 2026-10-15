"use client"

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// UI Components
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CardIndicador } from "@/components/atendimento/dashboards/CardIndicator";

// Icons
import {
    Activity,
    RefreshCw,
    Users,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
} from "lucide-react";

// Types & Utils
import { ViewType, FiltroTipoExame, PrazosMap } from "./types";
import { classificarTipoExame, asoEstaConcluido, asoEstaPendente, possuiAso, normalizarNomeExame } from "./utils";

// Subcomponents
import { ViewDashboard } from "./components/ViewDashboard";
import { ViewExamesPendentes } from "./components/ViewExamesPendentes";
import { ViewExamesConcluidos } from "./components/ViewExamesConcluidos";
import { useConjuntoPersistido } from "./hooks/useConjuntoPersistido";

function obterCpfFuncionario(item: any): string {
    return String(
        item?.cpf ||
        item?.cpfFuncionario ||
        item?.socResumo?.cpf ||
        item?.socResumo?.cpfFuncionario ||
        item?.aso?.cpf ||
        item?.aso?.cpfFuncionario ||
        ""
    );
}

export default function IndicadoresSocged() {
    const [view, setView] = useState<ViewType>("geral");
    const [unidadeId, setUnidadeId] = useState("");

    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [dadosGraficos, setDadosGraficos] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

    const [prazosMap, setPrazosMap] = useState<PrazosMap>({});

    const [funcionariosSalvos, setFuncionariosSalvos] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return new Set();
        const cachedStr = sessionStorage.getItem("aso_funcionarios_salvos") ||
            localStorage.getItem("aso_funcionarios_salvos");
        if (cachedStr) {
            try {
                const parsed = JSON.parse(cachedStr);
                if (Array.isArray(parsed)) return new Set(parsed);
            } catch { }
        }
        return new Set();
    });
    const [filtroTipoExame, setFiltroTipoExame] = useState<FiltroTipoExame>("todos");

    const chaveAtendimentosConcluidos = useMemo(() => {
        if (!unidadeId || !atualizadoEm) return null;
        return `aso_atendimentos_concluidos:${unidadeId}:${atualizadoEm}`;
    }, [unidadeId, atualizadoEm]);

    const chaveAsosEnviadosDireto = useMemo(() => {
        if (!unidadeId || !atualizadoEm) return null;
        return `aso_enviados_direto:${unidadeId}:${atualizadoEm}`;
    }, [unidadeId, atualizadoEm]);

    const {
        itens: cpfsAtendimentosConcluidos,
        adicionar: registrarAtendimentosConcluidos,
    } = useConjuntoPersistido(chaveAtendimentosConcluidos, "os atendimentos concluídos");
    const {
        itens: cpfsEnviadosDireto,
        adicionar: registrarAsosEnviadosDireto,
    } = useConjuntoPersistido(chaveAsosEnviadosDireto, "os ASOs enviados direto");

    /* ============================================================
       CONSULTA DA ÚLTIMA SINCRONIZAÇÃO
    ============================================================ */
    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/consulta-asos", { cache: "no-store" });
            if (!res.ok) {
                toast.error("Não foi possível carregar os dados da sincronização.");
                return;
            }

            const resposta = await res.json();

            const resultado = Array.isArray(resposta)
                ? resposta[0]
                : resposta;

            if (resultado?.status === "empty") {
                setDadosRelatorio([]);
                setDadosGraficos(null);
                setAtualizadoEm(null);
                toast.info("Ainda não existe uma sincronização concluída.");
                return;
            }

            if (resultado?.status === "done") {
                setDadosRelatorio(resultado.data?.funcionarios ?? []);
                setDadosGraficos(resultado.data?.analytics ?? null);
                setAtualizadoEm(resultado.processadoEm ?? null);
                return;
            }

            // Fallback caso retorne diretamente o objeto data
            if (resultado?.data?.funcionarios) {
                setDadosRelatorio(resultado.data.funcionarios);
                setDadosGraficos(resultado.data.analytics ?? null);
                setAtualizadoEm(resultado.processadoEm ?? null);
            }
        } catch (error) {
            console.error("Erro ao carregar dados da importação:", error);
            toast.error("Não foi possível carregar os dados da sincronização.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    /* ============================================================
       CONTEXTO DO USUÁRIO
    ============================================================ */
    useEffect(() => {
        const fetchUserContext = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("unidade_id")
                .eq("id", user.id)
                .single();

            if (profile?.unidade_id) {
                setUnidadeId(profile.unidade_id);
            }
        };

        fetchUserContext();
    }, []);

    /* ============================================================
       CARREGA PRAZOS DOS EXAMES
    ============================================================ */
    useEffect(() => {
        if (!unidadeId) return;

        async function loadPrazos() {
            const { data, error } = await supabase
                .from("prazos_exames")
                .select("nome_exame, prazo_dias, tipo_filtro, ignorar_exame")
                .eq("unidade_id", unidadeId);

            if (error) {
                console.error("Erro ao carregar prazos:", error);
                return;
            }

            if (!data) return;

            const mapa: PrazosMap = {};

            data.forEach((p) => {
                if (!p.nome_exame) return;

                const nomeNormalizado = normalizarNomeExame(p.nome_exame);

                mapa[nomeNormalizado] = {
                    prazo_dias: p.prazo_dias ?? 0,
                    tipo_filtro: p.tipo_filtro || "",
                    ignorar_exame: !!p.ignorar_exame,
                };
            });

            setPrazosMap(mapa);
        }

        loadPrazos();
    }, [unidadeId]);

    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */
    const dadosRelatorioVisiveis = useMemo(() => {
        return dadosRelatorio.filter((item) => {
            const cpf = obterCpfFuncionario(item);
            return !cpf || !cpfsAtendimentosConcluidos.has(cpf);
        });
    }, [dadosRelatorio, cpfsAtendimentosConcluidos]);

    const dadosGraficosVisiveis = useMemo(() => {
        if (!dadosGraficos) return null;

        const pendentes = dadosGraficos.funcionariosComExamesPendentes;
        if (!Array.isArray(pendentes)) return dadosGraficos;

        return {
            ...dadosGraficos,
            funcionariosComExamesPendentes: pendentes.filter((item: any) => {
                const cpf = obterCpfFuncionario(item);
                return !cpf || !cpfsAtendimentosConcluidos.has(cpf);
            }),
        };
    }, [dadosGraficos, cpfsAtendimentosConcluidos]);

    const funcionariosComAso = useMemo(() => {
        return dadosRelatorioVisiveis.filter((item) => possuiAso(item));
    }, [dadosRelatorioVisiveis]);

    const funcionariosFiltradosTipo = useMemo(() => {
        if (filtroTipoExame === "todos") {
            return funcionariosComAso;
        }

        return funcionariosComAso.filter((item) => {
            return classificarTipoExame(item, prazosMap) === filtroTipoExame;
        });
    }, [funcionariosComAso, filtroTipoExame, prazosMap]);

    /* ============================================================
       MÉTRICAS PRINCIPAIS
    ============================================================ */
    const funcionariosConcluidos = useMemo(() => {
        return funcionariosFiltradosTipo.filter((item) =>
            asoEstaConcluido(item, prazosMap)
        ).length;
    }, [funcionariosFiltradosTipo, prazosMap]);

    const funcionariosPendentes = useMemo(() => {
        return funcionariosFiltradosTipo.filter((item) =>
            asoEstaPendente(item, prazosMap)
        ).length;
    }, [funcionariosFiltradosTipo, prazosMap]);

    const totalFuncionarios = funcionariosConcluidos + funcionariosPendentes;

    const dataSincronizacaoFormatada = useMemo(() => {
        if (!atualizadoEm) return null;
        try {
            const data = new Date(atualizadoEm);
            return isNaN(data.getTime()) ? null : data.toLocaleString("pt-BR");
        } catch {
            return null;
        }
    }, [atualizadoEm]);

    const periodoSincronizacaoFormatado = useMemo(() => {
        if (!atualizadoEm) return null;

        const dataFinal = new Date(atualizadoEm);
        if (isNaN(dataFinal.getTime())) return null;

        const dataInicial = new Date(dataFinal);
        dataInicial.setDate(dataInicial.getDate() - 30);

        return `${dataInicial.toLocaleDateString("pt-BR")} a ${dataFinal.toLocaleDateString("pt-BR")}`;
    }, [atualizadoEm]);

    return (
        <div className="min-h-fit mt-2 bg-gray-500/20 rounded-xl p-2">
            {/* HEADER */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400">
                        <Activity className="w-5 h-5" />
                    </div>

                    <div>
                        <h1 className="text-lg font-black text-white uppercase tracking-tight">
                            Gestão de ASOs
                        </h1>
                        {dataSincronizacaoFormatada && (
                            <div className="space-y-0.5 text-xs text-slate-400 font-mono">
                                <p>Última sincronização: {dataSincronizacaoFormatada}</p>
                                {periodoSincronizacaoFormatado && (
                                    <p>Período sincronizado: {periodoSincronizacaoFormatado}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* FILTRO */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                        Filtrar por:
                    </span>

                    <div className="relative">
                        <select
                            value={filtroTipoExame}
                            onChange={(e) =>
                                setFiltroTipoExame(e.target.value as FiltroTipoExame)
                            }
                            className="h-9 min-w-[170px] appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 pr-8 text-[10px] font-bold uppercase tracking-wide text-slate-200 outline-none transition-all cursor-pointer hover:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                        >
                            <option value="todos">Todos os exames</option>
                            <option value="clinico">Exames clínicos</option>
                            <option value="complementar">Exames complementares</option>
                        </select>

                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>

                {/* TABS + ATUALIZAR */}
                <div className="flex flex-col lg:flex-row gap-4 items-center w-full lg:w-auto">
                    <Tabs
                        value={view}
                        onValueChange={(v) => setView(v as ViewType)}
                        className="bg-slate-800 p-1 rounded-lg border border-slate-700"
                    >
                        <TabsList className="bg-transparent h-8 gap-1">
                            <TabsTrigger
                                value="geral"
                                className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Dashboard
                            </TabsTrigger>
                            <TabsTrigger
                                value="pendencias"
                                className="data-[state=active]:bg-blue-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Exames Pendentes
                            </TabsTrigger>
                            <TabsTrigger
                                value="concluidos"
                                className="data-[state=active]:bg-emerald-600 text-[10px] uppercase text-white font-bold transition-all"
                            >
                                Exames Concluídos
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap gap-2 text-sm items-center w-full lg:w-auto justify-end">
                        <Button
                            type="button"
                            onClick={() => carregarDados()}
                            disabled={loading}
                            className="h-10 font-bold uppercase text-[10px] gap-2 tracking-wider bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            {loading ? "Atualizando..." : "Atualizar dados"}
                        </Button>
                    </div>
                </div>
            </header>

            {/* LOADING INICIAL */}
            {loading && dadosRelatorio.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                        Carregando última sincronização...
                    </p>
                </div>
            ) : (
                <>
                    {/* CARDS PRINCIPAIS */}
                    <div className="grid gap-4 my-4 grid-cols-1 md:grid-cols-3">
                        {/* TOTAL */}
                        <CardIndicador
                            titulo="Total ASO'S"
                            valor={totalFuncionarios}
                            subtitulo={
                                filtroTipoExame === "todos"
                                    ? "Todos os ASO's"
                                    : filtroTipoExame === "clinico"
                                        ? "Exames clínicos"
                                        : "Exames complementares"
                            }
                            icon={<Users size={24} className="text-blue-500" />}
                        />

                        {/* CONCLUÍDOS */}
                        <CardIndicador
                            titulo="ASO's Pendentes Liberação"
                            valor={funcionariosConcluidos}
                            subtitulo="Prontos para liberar"
                            icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                        />

                        {/* PENDENTES */}
                        <CardIndicador
                            titulo="ASO's Exames Pendentes"
                            valor={funcionariosPendentes}
                            subtitulo="Possuem exames pendentes"
                            icon={<AlertCircle size={24} className="text-amber-500" />}
                        />
                    </div>

                    {/* VIEW PENDÊNCIAS */}
                    {view === "pendencias" && (
                        <ViewExamesPendentes
                            analytics={dadosGraficosVisiveis}
                            todosFuncionarios={dadosRelatorioVisiveis}
                            filtroTipoExame={filtroTipoExame}
                            funcionariosSalvos={funcionariosSalvos}
                            onFuncionariosSalvos={(cpfs) => {
                                setFuncionariosSalvos((prev) => {
                                    const novoSet = new Set(prev);
                                    cpfs.forEach((cpf) => novoSet.add(cpf));

                                    // Mantém a classificação durante a sessão, inclusive após F5.
                                    const arr = Array.from(novoSet);
                                    try {
                                        sessionStorage.setItem(
                                            "aso_funcionarios_salvos",
                                            JSON.stringify(arr)
                                        );
                                    } catch (e) {
                                        console.warn("Não foi possível persistir os ASOs salvos:", e);
                                    }

                                    return novoSet;
                                });
                            }}

                            unidadeId={unidadeId}
                            prazosMap={prazosMap}
                            cpfsAtendimentosConcluidos={cpfsAtendimentosConcluidos}
                            onAtendimentosConcluidos={registrarAtendimentosConcluidos}
                            cpfsEnviadosDireto={cpfsEnviadosDireto}
                            onAsosEnviadosDireto={registrarAsosEnviadosDireto}
                        />
                    )}

                    {/* VIEW CONCLUÍDOS */}
                    {view === "concluidos" && (
                        <ViewExamesConcluidos
                            todosFuncionarios={dadosRelatorioVisiveis}
                            funcionariosSalvos={funcionariosSalvos}
                            onFuncionariosSalvos={(cpfs) => {
                                setFuncionariosSalvos((prev) => {
                                    const novoSet = new Set(prev);
                                    cpfs.forEach((cpf) => novoSet.add(cpf));

                                    // Mantém a classificação durante a sessão, inclusive após F5.
                                    const arr = Array.from(novoSet);
                                    try {
                                        sessionStorage.setItem(
                                            "aso_funcionarios_salvos",
                                            JSON.stringify(arr)
                                        );
                                    } catch (e) {
                                        console.warn("Não foi possível persistir os ASOs salvos:", e);
                                    }

                                    return novoSet;
                                });
                            }}
                            filtroTipoExame={filtroTipoExame}
                            unidadeId={unidadeId}
                            prazosMap={prazosMap}
                            cpfsAtendimentosConcluidos={cpfsAtendimentosConcluidos}
                            onAtendimentosConcluidos={registrarAtendimentosConcluidos}
                            cpfsEnviadosDireto={cpfsEnviadosDireto}
                            onAsosEnviadosDireto={registrarAsosEnviadosDireto}
                        />
                    )}

                    {/* VIEW DASHBOARD */}
                    {view === "geral" && (
                        <ViewDashboard
                            analytics={dadosGraficosVisiveis}
                            todosFuncionarios={dadosRelatorioVisiveis}
                            filtroTipoExame={filtroTipoExame}
                            prazosMap={prazosMap}
                        />
                    )}
                </>
            )}
        </div>
    );
}
