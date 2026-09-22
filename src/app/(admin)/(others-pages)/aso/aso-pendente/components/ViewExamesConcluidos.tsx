"use client"

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Search,
    Save,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { FuncionarioModal } from "./FuncionarioModal";
import { ViewExamesConcluidosProps, FuncionarioItem, StatusVencimentoVisual } from "../types";
import {
    classificarTipoExame,
    possuiAsoMontado,
    asoEstaConcluido,
    obterPrazoAso,
    calcularStatusVencimentoVisual,
} from "../utils";

type FuncionarioComPrazo = FuncionarioItem & {
    prazoAso: { maiorPrazo: number; dataBase: Date; dataLimite: Date } | null;
    statusPrazo: StatusVencimentoVisual;
};

export function ViewExamesConcluidos({
    todosFuncionarios,
    funcionariosSalvos,
    onFuncionariosSalvos,
    filtroTipoExame,
    unidadeId,
    prazosMap,
}: ViewExamesConcluidosProps) {
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    // Aba Ativa: "pendentes" (disponíveis para montagem) ou "salvos" (montados/salvos)
    const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "salvos">("pendentes");

    const [busca, setBusca] = useState("");
    const [sortKey, setSortKey] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(15);

    /* ============================================================
   FUNCIONÁRIOS CONCLUÍDOS
   ============================================================ */
    const funcionariosConcluidos = useMemo(() => {

        const lista: FuncionarioItem[] = [];

        todosFuncionarios.forEach((item) => {

            const aso =
                item.aso ||
                item.socResumo ||
                item;

            if (!aso) return;

            /*
             * A conclusão agora é determinada diretamente
             * pelas regras dos exames:
             *
             * Clínico:
             *   dataExame
             *
             * Complementar:
             *   dataExame + temRelacao
             */
            if (!asoEstaConcluido(item, prazosMap)) {
                return;
            }

            const cpf = String(
                item.cpfFuncionario ||
                item.cpf ||
                aso.cpfFuncionario ||
                aso.cpf ||
                ""
            ).trim();

            if (!cpf) return;

            lista.push({
                ...item,

                nome:
                    item.nomeFuncionario ||
                    item.nome ||
                    aso.nomeFuncionario ||
                    "Não informado",

                nomeFuncionario:
                    item.nomeFuncionario ||
                    item.nome ||
                    aso.nomeFuncionario ||
                    "Não informado",

                cpf,
                cpfFuncionario: cpf,

                empresa:
                    item.razaoSocial ||
                    item.empresa ||
                    aso.razaoSocial ||
                    "-",

                razaoSocial:
                    item.razaoSocial ||
                    item.empresa ||
                    aso.razaoSocial ||
                    "-",

                codigoEmpresa:
                    item.codigoEmpresa ||
                    aso.codigoEmpresa ||
                    "-",

                codigoFuncionario:
                    item.codigoFuncionario ||
                    aso.codigoFuncionario ||
                    "-",

                codigoGed:
                    aso.codigoGed ||
                    item.codigoGed ||
                    "-",

                dataCriacaoGed:
                    aso.dataCriacaoGed ||
                    item.dataCriacaoGed ||
                    "-",

                sequencial_ficha:
                    aso.sequencialFicha ||
                    item.sequencialFicha ||
                    "-",

                sequencialFicha:
                    aso.sequencialFicha ||
                    item.sequencialFicha ||
                    "-",

                dataAso:
                    aso.dataAso ||
                    item.dataAso ||
                    null,

                dataFicha:
                    aso.dataFicha ||
                    item.dataFicha ||
                    null,

                resultadoAsoSoc:
                    aso.resultadoAsoSoc ||
                    item.resultadoAsoSoc ||
                    "Concluído",

                medico:
                    aso.medico ||
                    item.medico ||
                    "Não informado",

                crmMedico:
                    aso.crmMedico ||
                    item.crmMedico ||
                    "-",

                observacao:
                    item.observacao || "",

                totalExames:
                    Number(
                        aso.totalExames || 0
                    ),

                examesPendentes: 0,

                examesConcluidos:
                    Number(
                        aso.examesConcluidos ||
                        aso.totalExames ||
                        0
                    ),

                tipoAso:
                    aso.tipoAso ||
                    item.tipoAso ||
                    "",

                listaExamesResumida:
                    aso.listaExamesResumida ||
                    item.listaExamesResumida ||
                    [],

                aso:
                    item.aso ||
                    aso,

                /*
                 * IMPORTANTE:
                 * documentosGed pode estar no item ou
                 * dentro do objeto ASO.
                 */
                documentosGed:
                    item.documentosGed ||
                    aso.documentosGed ||
                    [],
            });
        });

        return lista;

    }, [todosFuncionarios, prazosMap]);

    const funcionariosConcluidosFiltrados = useMemo(() => {
        if (filtroTipoExame === "todos") {
            return funcionariosConcluidos;
        }

        return funcionariosConcluidos.filter((funcionario) => {
            return (
                classificarTipoExame(funcionario, prazosMap) ===
                filtroTipoExame
            );
        });
    }, [
        funcionariosConcluidos,
        filtroTipoExame,
        prazosMap,
    ]);

    /* ============================================================
   PRAZO DO ASO
   Só existe para funcionários já concluídos.
   ============================================================ */
    const funcionariosComPrazo = useMemo<FuncionarioComPrazo[]>(() => {
        return funcionariosConcluidosFiltrados.map(
            (funcionario): FuncionarioComPrazo => {
                const prazoAso = obterPrazoAso(funcionario, prazosMap);

                const statusPrazo = calcularStatusVencimentoVisual(
                    prazoAso?.dataLimite || null
                );

                return {
                    ...funcionario,
                    prazoAso,
                    statusPrazo,
                };
            }
        );
    }, [funcionariosConcluidosFiltrados, prazosMap]);

    /* ============================================================
       INDICADORES DE VENCIMENTO DO ASO
    ============================================================ */
    const indicadoresVencimento = useMemo(() => {
        let vencidos = 0;
        let noPrazo = 0;

        funcionariosComPrazo.forEach((item: any) => {
            if (!item.prazoAso) return;

            if (item.statusPrazo?.estaVencido) {
                vencidos++;
            } else {
                noPrazo++;
            }
        });

        return {
            vencidos,
            noPrazo,
        };
    }, [funcionariosComPrazo]);

    const isFuncionarioMontado = (funcionario: any) => {
        if (!funcionario) return false;
        return (
            funcionariosSalvos.has(funcionario.cpf) ||
            possuiAsoMontado(funcionario.observacao)
        );
    };

    /* ============================================================
       FILTRA POR BUSCA, ABA E ORDENAÇÃO
    ============================================================ */
    const funcionariosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const lista = funcionariosComPrazo.filter((f) => {
            const jaMontado = isFuncionarioMontado(f);

            // Aba pendentes = somente quem ainda não foi montado
            if (abaAtiva === "pendentes" && jaMontado) {
                return false;
            }

            // Aba salvos = somente quem já foi montado
            if (abaAtiva === "salvos" && !jaMontado) {
                return false;
            }

            if (!termo) return true;

            return (
                String(f.nome || f.nomeFuncionario || "").toLowerCase().includes(termo) ||
                String(f.empresa || f.razaoSocial || "").toLowerCase().includes(termo) ||
                String(f.cpf || f.cpfFuncionario || "").includes(termo)
            );
        });

        lista.sort((a: any, b: any) => {
            const av = a[sortKey] ?? "";
            const bv = b[sortKey] ?? "";

            const resultado =
                typeof av === "number" && typeof bv === "number"
                    ? av - bv
                    : String(av).localeCompare(String(bv), "pt-BR", {
                        numeric: true,
                        sensitivity: "base",
                    });

            return sortDirection === "asc" ? resultado : -resultado;
        });

        return lista;
    }, [
        funcionariosComPrazo,
        busca,
        sortKey,
        sortDirection,
        funcionariosSalvos,
        abaAtiva,
    ]);

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const totalPaginas = Math.ceil(
        funcionariosFiltrados.length / itensPorPagina
    );

    const indiceInicial = (paginaAtual - 1) * itensPorPagina;
    const indiceFinal = indiceInicial + itensPorPagina;
    const funcionariosPaginados = funcionariosFiltrados.slice(
        indiceInicial,
        indiceFinal
    );

    /* ============================================================
       RESET E VALIDAÇÃO DE PÁGINA
    ============================================================ */
    useEffect(() => {
        setPaginaAtual(1);
    }, [busca, filtroTipoExame, sortKey, sortDirection, abaAtiva, prazosMap]);

    useEffect(() => {
        if (totalPaginas > 0 && paginaAtual > totalPaginas) {
            setPaginaAtual(totalPaginas);
        }
    }, [totalPaginas, paginaAtual]);

    useEffect(() => {
        setSelectedCpfs(new Set());
    }, [todosFuncionarios]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
       SELEÇÃO
    ============================================================ */
    const cpfsSelecionaveis = funcionariosFiltrados
        .filter((f) => !isFuncionarioMontado(f))
        .map((f) => f.cpf!);

    const allChecked =
        cpfsSelecionaveis.length > 0 &&
        cpfsSelecionaveis.every((cpf) => selectedCpfs.has(cpf));

    const disponiveisNaAba = cpfsSelecionaveis.length;

    const quantidadeSalvos = funcionariosConcluidosFiltrados.filter(
        (f) =>
            funcionariosSalvos.has(f.cpf!) || possuiAsoMontado(f.observacao)
    ).length;

    const quantidadePendentes =
        funcionariosConcluidosFiltrados.length - quantidadeSalvos;

    const handleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedCpfs(new Set());
            return;
        }

        const disponiveis = funcionariosFiltrados
            .filter((f) => !isFuncionarioMontado(f))
            .map((f) => f.cpf!);

        setSelectedCpfs(new Set(disponiveis));
    };

    const handleSelectOne = (cpf: string, checked: boolean) => {
        const funcionario = funcionariosConcluidosFiltrados.find(
            (f) => f.cpf === cpf
        );

        if (!funcionario || isFuncionarioMontado(funcionario)) {
            return;
        }

        setSelectedCpfs((prev) => {
            const novoSet = new Set(prev);
            if (checked) {
                novoSet.add(cpf);
            } else {
                novoSet.delete(cpf);
            }
            return novoSet;
        });
    };

    /* ============================================================
       SALVAR EM LOTE
    ============================================================ */
    const handleSaveSelection = async () => {
        if (selectedCpfs.size === 0) {
            toast.warning("Selecione ao menos um funcionário para salvar.");
            return;
        }

        setSaving(true);

        try {
            const selecionados = funcionariosConcluidosFiltrados.filter(
                (f) => selectedCpfs.has(f.cpf!) && !isFuncionarioMontado(f)
            );

            if (selecionados.length === 0) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const response = await fetch("/api/enviar-asos-concluidos", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    selecionados,
                }),
            });

            if (!response.ok) {
                throw new Error("Erro ao enviar funcionários.");
            }

            // Inserção em lote no Supabase com novo schema e fallbacks
            const dadosParaInserir = selecionados.map((f) => ({
                nome_paciente: f.nomeFuncionario || f.nome,
                sequencial_ficha: f.aso?.sequencialFicha || f.sequencial_ficha,
                codigo_empresa_soc: f.codigoEmpresa,
                codigo_ged_soc: f.aso?.codigoGed || f.codigoGed,
                data_criacao_ged_soc: f.aso?.dataCriacaoGed || f.dataCriacaoGed,
                unidade_id: unidadeId,
            }));

            const saveBd = await supabase
                .from("pacientes_assinatura")
                .insert(dadosParaInserir);

            if (saveBd.error) {
                toast.error("Erro ao salvar funcionários.");
                return;
            }

            await response.json();

            const cpfsSalvos = selecionados.map((f) => f.cpf!);
            onFuncionariosSalvos(cpfsSalvos);

            setSelectedCpfs((prev) => {
                const novo = new Set(prev);
                cpfsSalvos.forEach((cpf) => novo.delete(cpf));
                return novo;
            });

            toast.success(
                `${selecionados.length} funcionário(s) salvo(s) com sucesso!`
            );
        } catch (error) {
            toast.error(
                "Não foi possível salvar os funcionários selecionados."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleRowClick = (f: any) => {
        setSelectedFuncionario(f);
        setModalOpen(true);
    };

    if (funcionariosConcluidosFiltrados.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nenhum funcionário concluído
                </p>
                <p className="text-xs text-slate-400 mt-1 text-center">
                    Os funcionários com todos os exames concluídos aparecerão aqui.
                </p>
            </div>
        );
    }

    const SortHeader = ({
        label,
        sortKeyValue,
    }: {
        label: string;
        sortKeyValue: string;
    }) => (
        <TableHead
            className="font-black text-[10px] uppercase text-slate-500 cursor-pointer select-none whitespace-nowrap transition-colors hover:text-slate-800 dark:hover:text-slate-200"
            onClick={() => handleSort(sortKeyValue)}
        >
            <div className="flex items-center gap-1.5">
                {label}
                {sortKey === sortKeyValue ? (
                    sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-blue-500" />
                    ) : (
                        <ArrowDown className="w-3 h-3 text-blue-500" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                )}
            </div>
        </TableHead>
    );

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
            {/* HEADER */}
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-col gap-4">
                    {/* TÍTULO + INDICADORES */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                </span>
                                Funcionários Concluídos
                            </CardTitle>

                            {/* ABAS */}
                            <div className="mt-3 flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAbaAtiva("pendentes");
                                        setSelectedCpfs(new Set());
                                        setPaginaAtual(1);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${abaAtiva === "pendentes"
                                        ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <Clock3 className="w-3.5 h-3.5" />
                                    Pendentes
                                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10">
                                        {quantidadePendentes}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setAbaAtiva("salvos");
                                        setSelectedCpfs(new Set());
                                        setPaginaAtual(1);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${abaAtiva === "salvos"
                                        ? "bg-white dark:bg-gray-900 text-emerald-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Montados
                                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10">
                                        {quantidadeSalvos}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* INDICADORES DE VENCIMENTO DO ASO */}
                        <div className="flex flex-row justify-center gap-3">
                            {/* ASOS VENCIDOS */}
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10">
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-bold tracking-wide text-slate-400">
                                            ASOs Vencidos
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Prazo expirado
                                        </div>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-red-500">
                                    {indicadoresVencimento.vencidos}
                                </span>
                            </div>

                            {/* ASOS NO PRAZO */}
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-bold tracking-wide text-slate-400">
                                            ASOs no Prazo
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Dentro do prazo
                                        </div>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-emerald-500">
                                    {indicadoresVencimento.noPrazo}
                                </span>
                            </div>
                        </div>

                        {/* LINHA DE AÇÕES */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            {/* BUSCA */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Buscar por nome, empresa ou CPF..."
                                    className="h-9 pl-9 pr-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                />
                                {busca && (
                                    <button
                                        type="button"
                                        onClick={() => setBusca("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {busca && (
                                <div className="flex items-center px-2 text-[10px] text-slate-400">
                                    {funcionariosFiltrados.length} resultado(s)
                                </div>
                            )}

                            {/* SALVAR SELECIONADOS */}
                            {abaAtiva === "pendentes" && (
                                <Button
                                    type="button"
                                    onClick={handleSaveSelection}
                                    disabled={saving || selectedCpfs.size === 0}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-wide gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0 text-white"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3.5 h-3.5" />
                                            Salvar
                                            {selectedCpfs.size > 0 &&
                                                ` (${selectedCpfs.size})`}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">



                    </div>
                </div>
            </CardHeader>

            {/* TABELA */}
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center">
                                <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(checked) =>
                                        handleSelectAll(!!checked)
                                    }
                                    disabled={disponiveisNaAba === 0}
                                />
                            </TableHead>

                            <SortHeader label="Funcionário" sortKeyValue="nome" />
                            <SortHeader label="Empresa / Unidade" sortKeyValue="empresa" />
                            <SortHeader label="Médico Examinador" sortKeyValue="medico" />
                            <SortHeader label="Seq. Ficha" sortKeyValue="sequencialFicha" />
                            <SortHeader label="Data Ficha" sortKeyValue="dataFicha" />
                            <SortHeader
                                label="Prazo ASO"
                                sortKeyValue="prazoAso"
                            />

                            <SortHeader
                                label="Vencimento"
                                sortKeyValue="dataLimite"
                            />

                            {/* <SortHeader label="Exames" sortKeyValue="examesConcluidos" /> */}
                            <SortHeader label="Observação" sortKeyValue="observacao" />
                            <SortHeader label="Status" sortKeyValue="resultadoAsoSoc" />
                        </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {funcionariosPaginados.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={11}
                                    className="text-center py-8 text-xs text-slate-400"
                                >
                                    {abaAtiva === "pendentes"
                                        ? "Nenhum funcionário pendente para montagem."
                                        : "Nenhum funcionário salvo ou com ASO montado nesta lista."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            funcionariosPaginados.map((item) => {
                                const isSelected = selectedCpfs.has(item.cpf!);
                                const jaMontado = isFuncionarioMontado(item);

                                return (
                                    <TableRow
                                        key={item.cpf}
                                        className={`transition-colors ${jaMontado
                                            ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]"
                                            : isSelected
                                                ? "bg-blue-500/[0.06] hover:bg-blue-500/[0.09]"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            }`}
                                    >
                                        {/* CHECKBOX */}
                                        <TableCell className="text-center">
                                            {jaMontado ? (
                                                <div
                                                    className="mx-auto flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15"
                                                    title="ASO já montado"
                                                >
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                </div>
                                            ) : (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) =>
                                                        handleSelectOne(
                                                            item.cpf!,
                                                            !!checked
                                                        )
                                                    }
                                                />
                                            )}
                                        </TableCell>

                                        {/* FUNCIONÁRIO */}
                                        <TableCell>
                                            <button
                                                type="button"
                                                onClick={() => handleRowClick(item)}
                                                className="text-left group w-full"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {/* Avatar */}
                                                    <div
                                                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${jaMontado
                                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-blue-500/10 text-blue-500"
                                                            }`}
                                                    >
                                                        {jaMontado ? (
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        ) : (
                                                            item.nome
                                                                ?.charAt(0)
                                                                ?.toUpperCase()
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div
                                                            className={`text-xs font-bold truncate ${jaMontado
                                                                ? "text-emerald-700 dark:text-emerald-400"
                                                                : "text-blue-600 dark:text-blue-400"
                                                                } group-hover:underline`}
                                                        >
                                                            {item.nome}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 mt-0.5">
                                                            Clique para visualizar detalhes
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        </TableCell>

                                        {/* EMPRESA */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div
                                                className="max-w-[220px] truncate"
                                                title={item.empresa}
                                            >
                                                {item.empresa}
                                            </div>
                                        </TableCell>

                                        {/* MÉDICO EXAMINADOR */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div
                                                className="max-w-[180px] truncate"
                                                title={item.medico || "Não informado"}
                                            >
                                                {item.medico || "Não informado"}
                                            </div>
                                        </TableCell>

                                        {/* SEQ. FICHA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.sequencialFicha || item.sequencial_ficha || "-"}
                                        </TableCell>

                                        {/* DATA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.dataFicha || "-"}
                                        </TableCell>

                                        {/* PRAZO ASO */}
                                        <TableCell>
                                            {item.prazoAso ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {item.prazoAso.maiorPrazo}{" "}
                                                        {item.prazoAso.maiorPrazo === 1
                                                            ? "dia útil"
                                                            : "dias úteis"}
                                                    </span>

                                                    <span className="text-[9px] text-slate-400">
                                                        Base:{" "}
                                                        {item.prazoAso.dataBase.toLocaleDateString(
                                                            "pt-BR"
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    Sem prazo
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* VENCIMENTO */}
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-bold gap-1 rounded-full ${item.statusPrazo.color}`}
                                            >
                                                {item.statusPrazo.estaVencido ? (
                                                    <Clock3 className="w-3 h-3" />
                                                ) : (
                                                    <CheckCircle2 className="w-3 h-3" />
                                                )}

                                                {item.statusPrazo.label}
                                            </Badge>

                                            {item.prazoAso && (
                                                <div className="text-[9px] text-slate-400 mt-1">
                                                    Limite:{" "}
                                                    {item.prazoAso.dataLimite.toLocaleDateString(
                                                        "pt-BR"
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* EXAMES */}
                                        {/* <TableCell>
                                            <div
                                                className="flex items-center gap-1.5"
                                                title={(item.aso?.listaExamesResumida || item.listaExamesResumida || [])
                                                    .map(
                                                        (e: any) =>
                                                            `${e?.descricaoExame || e?.nomeExame || e?.nome || "Exame"}: ${e?.dataExame || "-"
                                                            }`
                                                    )
                                                    .join("\n")}
                                            >
                                                <span
                                                    className={`text-xs font-bold ${jaMontado
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-slate-600 dark:text-slate-300"
                                                        }`}
                                                >
                                                    {item.examesConcluidos}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    / {item.totalExames}
                                                </span>
                                                {jaMontado && (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-1" />
                                                )}
                                            </div>
                                        </TableCell> */}

                                        {/* OBSERVAÇÃO */}
                                        <TableCell className="text-xs">
                                            {item.observacao || ""}
                                        </TableCell>

                                        {/* STATUS */}
                                        <TableCell>
                                            {jaMontado ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 rounded-full"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    ASO MONTADO
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 rounded-full"
                                                >
                                                    <Clock3 className="w-3 h-3" />
                                                    PRONTO
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* PAGINAÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/30">
                {/* INFORMAÇÕES */}
                <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase font-bold">
                    <span>
                        {funcionariosFiltrados.length > 0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                funcionariosFiltrados.length
                            )} de ${funcionariosFiltrados.length}`
                            : "Nenhum resultado"}
                    </span>

                    {/* ITENS POR PÁGINA */}
                    <div className="flex items-center gap-1.5">
                        <span>Linhas:</span>
                        <Select
                            value={String(itensPorPagina)}
                            onValueChange={(value) => {
                                setItensPorPagina(Number(value));
                                setPaginaAtual(1);
                            }}
                        >
                            <SelectTrigger className="h-7 w-[65px] text-[10px] font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="15">15</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* CONTROLES */}
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual === 1}
                        onClick={() =>
                            setPaginaAtual((prev) => Math.max(1, prev - 1))
                        }
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    {/* PÁGINAS */}
                    {Array.from({ length: totalPaginas }, (_, index) => index + 1)
                        .filter((pagina) => {
                            if (totalPaginas <= 7) return true;
                            return (
                                pagina === 1 ||
                                pagina === totalPaginas ||
                                Math.abs(pagina - paginaAtual) <= 1
                            );
                        })
                        .map((pagina, index, array) => {
                            const paginaAnterior = array[index - 1];
                            const mostrarReticencias =
                                paginaAnterior && pagina - paginaAnterior > 1;

                            return (
                                <React.Fragment key={pagina}>
                                    {mostrarReticencias && (
                                        <span className="px-1 text-[10px] text-slate-400">
                                            ...
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant={
                                            paginaAtual === pagina
                                                ? "default"
                                                : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setPaginaAtual(pagina)}
                                        className="h-7 min-w-7 px-2 text-[10px] font-bold"
                                    >
                                        {pagina}
                                    </Button>
                                </React.Fragment>
                            );
                        })}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual === totalPaginas}
                        onClick={() =>
                            setPaginaAtual((prev) =>
                                Math.min(totalPaginas, prev + 1)
                            )
                        }
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* MODAL */}
            <FuncionarioModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                funcionario={selectedFuncionario}
            />
        </Card>
    );
}