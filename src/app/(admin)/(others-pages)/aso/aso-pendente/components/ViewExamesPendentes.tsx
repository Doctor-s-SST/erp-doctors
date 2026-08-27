"use client"

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Search,
    UserCheck,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from "lucide-react";
import { FuncionarioModal } from "./FuncionarioModal";
import { ViewExamesPendentesProps, PrazosMap } from "../types";
import {
    classificarTipoExame,
    compararValores,
    obterMaiorPrazo,
    obterStatusVencimento,
    calcularStatusVencimentoVisual,
} from "../utils";

export function ViewExamesPendentes({
    analytics,
    todosFuncionarios,
    filtroTipoExame,
}: ViewExamesPendentesProps) {
    const pendencias = analytics?.funcionariosComExamesPendentes || [];

    const [prazosMap, setPrazosMap] = useState<PrazosMap>({});
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [busca, setBusca] = useState("");
    const [sortKey, setSortKey] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(15);

    /* ============================================================
       CARREGA PRAZOS
    ============================================================ */
    useEffect(() => {
        async function loadPrazos() {
            const { data } = await supabase
                .from("prazos_exames")
                .select("nome_exame, prazo_dias");

            if (!data) return;

            const mapa: Record<string, number> = {};
            data.forEach((p) => {
                if (p.nome_exame) {
                    mapa[p.nome_exame.trim().toLowerCase()] = p.prazo_dias;
                }
            });

            setPrazosMap(mapa);
        }

        loadPrazos();
    }, []);

    /* ============================================================
       ORDENAÇÃO
    ============================================================ */
    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
       MAPA FUNCIONÁRIOS
    ============================================================ */
    const funcionariosMapeados = useMemo(() => {
        const map = new Map<string, any>();

        todosFuncionarios?.forEach((item) => {
            const res = item.socResumo || item;
            if (!res) return;

            const cpf = res.cpfFuncionario || res.cpf;
            if (!cpf) return;

            map.set(cpf, {
                nome: res.nomeFuncionario || res.nome,
                cpf,
                empresa: res.razaoSocial || res.empresa || "-",
                codigoEmpresa: res.codigoEmpresa || "-",
                codigoFuncionario: res.codigoFuncionario || "-",
                dataAso: res.dataAso || res.dataPedido || null,
                dataFicha: res.dataFicha || res.dataPedido || null,
                resultadoAsoSoc: res.resultadoAsoSoc || "Pendente",
                medico: res.medico || "Não informado",
                crmMedico: res.crmMedico || "-",
                totalExames: res.totalExames || 0,
                examesPendentes: res.examesPendentes || 0,
                examesConcluidos: res.examesConcluidos || 0,
                sequencialFicha: res.sequencialFicha || "",
                tipoAso: res.tipoAso || "",
                listaExamesResumida: res.listaExamesResumida || [],
            });
        });

        return map;
    }, [todosFuncionarios]);

    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */
    const pendenciasFiltradas = useMemo(() => {
        if (filtroTipoExame === "todos") {
            return pendencias;
        }

        return pendencias.filter((item: any) => {
            const cpf = item.cpfFuncionario || item.cpf;
            const funcionario = funcionariosMapeados.get(cpf);

            if (!funcionario) return false;

            return classificarTipoExame(funcionario) === filtroTipoExame;
        });
    }, [pendencias, funcionariosMapeados, filtroTipoExame]);

    /* ============================================================
       PROCESSA + FILTRA + ORDENA
    ============================================================ */
    const pendenciasProcessadas = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const lista = pendenciasFiltradas.map((item: any) => {
            const cpf = item.cpfFuncionario || item.cpf;
            const fDados = funcionariosMapeados.get(cpf);

            const nome =
                item.nomeFuncionario ||
                item.nome ||
                fDados?.nome ||
                "Não Informado";

            const empresa =
                fDados?.empresa || item.empresa || item.unidade || "-";

            const dataFicha = fDados?.dataFicha || item.dataFicha || null;

            const examesList: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            const maiorPrazo = obterMaiorPrazo(examesList, prazosMap);
            const statusVencimento = calcularStatusVencimentoVisual(
                dataFicha,
                maiorPrazo
            );

            return {
                ...item,
                cpf,
                nome,
                empresa,
                dataFicha,
                examesList,
                maiorPrazo,
                statusVencimento,
            };
        });

        const filtrada = lista.filter((item: any) => {
            if (!termo) return true;

            return (
                String(item.nome).toLowerCase().includes(termo) ||
                String(item.empresa).toLowerCase().includes(termo)
            );
        });

        filtrada.sort((a: any, b: any) => {
            const resultado = compararValores(a, b, sortKey);
            return sortDirection === "asc" ? resultado : -resultado;
        });

        return filtrada;
    }, [
        pendenciasFiltradas,
        funcionariosMapeados,
        prazosMap,
        busca,
        sortKey,
        sortDirection,
    ]);

    /* ============================================================
       PAGINAÇÃO DOS RESULTADOS
    ============================================================ */
    const totalPaginas = Math.ceil(
        pendenciasProcessadas.length / itensPorPagina
    );

    const indiceInicial = (paginaAtual - 1) * itensPorPagina;
    const indiceFinal = indiceInicial + itensPorPagina;
    const pendenciasPaginadas = pendenciasProcessadas.slice(
        indiceInicial,
        indiceFinal
    );

    /* ============================================================
       RESET DA PAGINAÇÃO
    ============================================================ */
    useEffect(() => {
        setPaginaAtual(1);
    }, [busca, filtroTipoExame, sortKey, sortDirection]);

    /* ============================================================
       GARANTE QUE A PÁGINA NÃO FIQUE INVÁLIDA
    ============================================================ */
    useEffect(() => {
        if (totalPaginas > 0 && paginaAtual > totalPaginas) {
            setPaginaAtual(totalPaginas);
        }
    }, [totalPaginas, paginaAtual]);

    /* ============================================================
       INDICADORES DE ASO
    ============================================================ */
    const indicadoresAso = useMemo(() => {
        let vencidos = 0;
        let dentroDoPrazo = 0;

        pendenciasFiltradas.forEach((item: any) => {
            const cpf = item.cpfFuncionario || item.cpf;
            const funcionario = funcionariosMapeados.get(cpf);
            const dataFicha =
                funcionario?.dataFicha || item.dataFicha || null;

            const examesList: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            const maiorPrazo = obterMaiorPrazo(examesList, prazosMap);
            const status = obterStatusVencimento(dataFicha, maiorPrazo);

            if (status === "vencido") {
                vencidos++;
            } else if (status === "no_prazo") {
                dentroDoPrazo++;
            }
        });

        return {
            vencidos,
            dentroDoPrazo,
        };
    }, [pendenciasFiltradas, funcionariosMapeados, prazosMap]);

    /* ============================================================
       TOTAIS
    ============================================================ */
    const totalFuncionariosPendentes = pendenciasFiltradas.length;
    const totalGeralFuncionarios =
        analytics?.totalFuncionarios || funcionariosMapeados.size;
    const totalFuncionariosConcluidos = Math.max(
        0,
        totalGeralFuncionarios - totalFuncionariosPendentes
    );

    /* ============================================================
       MODAL
    ============================================================ */
    const handleRowClick = (cpf: string, itemPendente: any) => {
        const fCompleto = funcionariosMapeados.get(cpf);

        if (fCompleto) {
            setSelectedFuncionario(fCompleto);
        } else {
            setSelectedFuncionario({
                nome: itemPendente.nomeFuncionario || itemPendente.nome,
                cpf: itemPendente.cpfFuncionario || itemPendente.cpf,
                empresa: itemPendente.empresa || "-",
                dataAso: itemPendente.dataAso || null,
                dataFicha: itemPendente.dataFicha || null,
                resultadoAsoSoc: "Pendente",
                totalExames: itemPendente.examesPendentes?.length || 0,
                examesPendentes: itemPendente.examesPendentes?.length || 0,
                examesConcluidos: 0,
                sequencialFicha: itemPendente.sequencialFicha,
                tipoAso: itemPendente.tipoAso,
                listaExamesResumida: (itemPendente.examesPendentes || []).map(
                    (e: string) => ({
                        descricaoExame: e,
                        isPendente: true,
                        dataExame: "-",
                    })
                ),
            });
        }

        setModalOpen(true);
    };

    /* ============================================================
       EMPTY STATE
    ============================================================ */
    if (!analytics || pendenciasFiltradas.length === 0) {
        return (
            <div className="text-center py-20 text-xs font-mono text-slate-400 uppercase bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-700">
                {analytics
                    ? "Nenhum funcionário com exames pendentes!"
                    : "Importe uma planilha Excel para ver os exames pendentes."}
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
            className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none"
            onClick={() => handleSort(sortKeyValue)}
        >
            <div className="flex items-center gap-1">
                {label}
                {sortKey === sortKeyValue ? (
                    sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                    ) : (
                        <ArrowDown className="w-3 h-3" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
            </div>
        </TableHead>
    );

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="border-b border-gray-300 dark:border-gray-700 pb-3">
                {/* TÍTULO + BUSCA */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <CardTitle className="text-sm font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        Funcionários com Exames Pendentes
                        <Badge
                            variant="outline"
                            className="text-sm border-red-500/30 text-red-500 bg-red-500/5"
                        >
                            {pendenciasFiltradas.length}
                        </Badge>
                    </CardTitle>

                    {/* INDICADORES DE ASO */}
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
                                {indicadoresAso.vencidos}
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
                                {indicadoresAso.dentroDoPrazo}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar funcionário ou empresa..."
                                className="pl-9 h-9 text-xs"
                            />
                        </div>

                        {/* PROGRESSO */}
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                            <div>
                                <div className="text-[9px] uppercase font-bold text-slate-400">
                                    Progresso
                                </div>
                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                    {totalFuncionariosConcluidos} de {totalGeralFuncionarios} concluídos
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            {/* TABELA */}
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                            <SortHeader label="Funcionário" sortKeyValue="nome" />
                            <SortHeader label="Empresa / Unidade" sortKeyValue="empresa" />
                            <SortHeader label="Data Ficha" sortKeyValue="dataFicha" />
                            <SortHeader label="Exames Pendentes" sortKeyValue="examesList" />
                            <SortHeader label="Maior Prazo" sortKeyValue="maiorPrazo" />
                            <SortHeader label="Status Vencimento" sortKeyValue="statusVencimento" />
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {pendenciasPaginadas.map((item: any, idx: number) => (
                            <TableRow
                                key={`${item.cpf}-${idx}`}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                            >
                                {/* FUNCIONÁRIO */}
                                <TableCell className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                    <button
                                        type="button"
                                        onClick={() => handleRowClick(item.cpf, item)}
                                        className="text-left font-bold flex items-center gap-1.5"
                                    >
                                        {item.nome}
                                    </button>
                                </TableCell>

                                {/* EMPRESA */}
                                <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                    {item.empresa}
                                </TableCell>

                                {/* DATA FICHA */}
                                <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                    {item.dataFicha || "-"}
                                </TableCell>

                                {/* EXAMES */}
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {item.examesList.map((exame: string, eIdx: number) => {
                                            const prazoExame =
                                                prazosMap[exame.trim().toLowerCase()];

                                            return (
                                                <Badge
                                                    key={eIdx}
                                                    variant="outline"
                                                    className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] gap-1"
                                                >
                                                    {exame}
                                                    {prazoExame !== undefined && (
                                                        <span className="text-[9px] font-bold text-amber-500">
                                                            ({prazoExame}d)
                                                        </span>
                                                    )}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </TableCell>

                                {/* MAIOR PRAZO */}
                                <TableCell className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {item.maiorPrazo !== null ? (
                                        <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                                            {item.maiorPrazo} dia(s)
                                        </Badge>
                                    ) : (
                                        <span className="text-slate-400 font-mono text-[10px]">
                                            Não definido
                                        </span>
                                    )}
                                </TableCell>

                                {/* STATUS */}
                                <TableCell>
                                    <Badge
                                        className={`font-bold text-[10px] border ${item.statusVencimento.color}`}
                                    >
                                        {item.statusVencimento.label}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            {/* PAGINAÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/30">
                {/* INFORMAÇÕES */}
                <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase font-bold">
                    <span>
                        {pendenciasProcessadas.length > 0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                pendenciasProcessadas.length
                            )} de ${pendenciasProcessadas.length}`
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
