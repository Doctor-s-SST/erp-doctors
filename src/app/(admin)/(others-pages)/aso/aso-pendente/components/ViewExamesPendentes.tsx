"use client"

import React, { useEffect, useState, useMemo } from "react";
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
    Search,
    UserCheck,
    Clock3,
    CheckCircle2,
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
    normalizarNomeExame,
    parseDateBR,
    adicionarDiasUteis,
    calcularStatusVencimentoVisual,
} from "../utils";

export function ViewExamesPendentes({
    analytics,
    todosFuncionarios,
    filtroTipoExame,
    prazosMap,
}: ViewExamesPendentesProps) {
    const pendencias = analytics?.funcionariosComExamesPendentes || [];

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

            const cpf = res.cpfFuncionario || res.cpf || item.cpfFuncionario || item.cpf;
            if (!cpf) return;

            map.set(cpf, item);
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
            const funcionario = funcionariosMapeados.get(cpf) || item;

            return (
                classificarTipoExame(funcionario, prazosMap) ===
                filtroTipoExame
            );
        });
    }, [
        pendencias,
        funcionariosMapeados,
        filtroTipoExame,
        prazosMap,
    ]);

    /* ============================================================
       PROCESSA PENDÊNCIAS COM STATUS DE EXAME
       (sem filtro de busca, para que indicadores fiquem estáveis)
    ============================================================ */
    const pendenciasComStatus = useMemo(() => {
        return pendenciasFiltradas.map((item: any) => {
            const cpf = item.cpfFuncionario || item.cpf;
            const fDados = funcionariosMapeados.get(cpf);

            const nome =
                item.nomeFuncionario ||
                item.nome ||
                fDados?.nomeFuncionario ||
                fDados?.nome ||
                "Não Informado";

            const empresa =
                fDados?.razaoSocial || fDados?.empresa || item.empresa || item.unidade || "-";

            const dataFicha = fDados?.aso?.dataFicha || fDados?.dataFicha || item.dataFicha || null;

            const examesListOriginal: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            // remove exames marcados para ignorar
            const examesList: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            const temPendenciaReal = examesList.some(
                (nomeExame) => !prazosMap[normalizarNomeExame(nomeExame)]?.ignorar_exame
            );

            const listaCompletaExames: any[] =
                fDados?.aso?.listaExamesResumida || fDados?.listaExamesResumida || [];

            const examesDetalhados = examesList.map((nomeExame: string) => {
                const nomeNormalizado = normalizarNomeExame(nomeExame);
                const prazoConfig = prazosMap[nomeNormalizado];
                const ignorado = Boolean(prazoConfig?.ignorar_exame);

                const info = listaCompletaExames.find(
                    (e: any) =>
                        normalizarNomeExame(
                            e?.descricaoExame || e?.nomeExame || e?.nome || ""
                        ) === nomeNormalizado
                );

                const dataExame = info?.dataExame || null;
                const temRelacao = info?.temRelacao ?? null;

                let statusPrazoExame = null;

                // Exame ignorado nunca entra no cálculo de prazo/vencimento,
                // mas continua aparecendo como item.
                if (dataExame && !ignorado && prazoConfig?.prazo_dias) {
                    const dataBase = parseDateBR(dataExame);

                    if (dataBase) {
                        const dataLimite = adicionarDiasUteis(
                            dataBase,
                            Number(prazoConfig.prazo_dias)
                        );
                        statusPrazoExame = calcularStatusVencimentoVisual(dataLimite);
                    }
                }

                return { nome: nomeExame, dataExame, temRelacao, statusPrazoExame, ignorado };
            });

            const medicoExaminador =
                fDados?.aso?.medico || item.medico || "Não informado";

            const sequencialFicha =
                fDados?.aso?.sequencialFicha || item.sequencialFicha || "-";

            return {
                ...item,
                cpf,
                nome,
                empresa,
                dataFicha,
                examesList,
                examesDetalhados,
                medicoExaminador,
                sequencialFicha,
                temPendenciaReal
            };
        });
    }, [
        pendenciasFiltradas,
        funcionariosMapeados,
        prazosMap,
    ]);
    const pendenciasVisiveis = useMemo(
        () => pendenciasComStatus.filter((item: any) => item.temPendenciaReal),
        [pendenciasComStatus]
    );

    const pendenciasProcessadas = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const filtrada = pendenciasVisiveis.filter((item: any) => {
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
        pendenciasVisiveis,
        busca,
        sortKey,
        sortDirection,
    ]);

    const indicadoresExamesPendentes = useMemo(() => {
        let vencidos = 0;
        let noPrazo = 0;

        pendenciasVisiveis.forEach((item: any) => {
            const examesComStatus = (item.examesDetalhados || []).filter(
                (exame: any) => exame.statusPrazoExame
            );

            if (examesComStatus.length === 0) {
                return;
            }

            const algumVencido = examesComStatus.some(
                (exame: any) => exame.statusPrazoExame.estaVencido
            );

            if (algumVencido) {
                vencidos++;
            } else {
                noPrazo++;
            }
        });

        return { vencidos, noPrazo };
    }, [pendenciasVisiveis]);

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
    }, [busca, filtroTipoExame, sortKey, sortDirection, prazosMap]);

    /* ============================================================
       GARANTE QUE A PÁGINA NÃO FIQUE INVÁLIDA
    ============================================================ */
    useEffect(() => {
        if (totalPaginas > 0 && paginaAtual > totalPaginas) {
            setPaginaAtual(totalPaginas);
        }
    }, [totalPaginas, paginaAtual]);

    /* ============================================================
       TOTAIS
    ============================================================ */
    const totalFuncionariosPendentes = pendenciasVisiveis.length;
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
                nomeFuncionario: itemPendente.nomeFuncionario || itemPendente.nome,
                cpfFuncionario: itemPendente.cpfFuncionario || itemPendente.cpf,
                razaoSocial: itemPendente.empresa || "-",
                codigoEmpresa: itemPendente.codigoEmpresa || "-",
                codigoFuncionario: itemPendente.codigoFuncionario || "-",
                aso: {
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
                },
                documentosGed: [],
            });
        }

        setModalOpen(true);
    };

    /* ============================================================
       EMPTY STATE
    ============================================================ */
    if (!analytics || pendenciasVisiveis.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 text-center">
                    {analytics
                        ? "Nenhum funcionário com exames pendentes!"
                        : "Importe uma planilha Excel para ver os exames pendentes."}
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
            className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white"
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
            <CardHeader className="border-b border-gray-200 dark:border-gray-800 pb-4">
                <div className="flex flex-col gap-4">
                    {/* TÍTULO + INDICADORES */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                            </span>
                            Funcionários com Exames Pendentes
                            <Badge
                                variant="outline"
                                className="text-sm border-red-500/30 text-red-500 bg-red-500/5"
                            >
                                {pendenciasVisiveis.length}
                            </Badge>
                        </CardTitle>

                        {/* INDICADORES DE VENCIMENTO POR ASO (FUNCIONÁRIO) */}
                        <div className="flex flex-row justify-center gap-3">
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
                                            Exame já realizado, prazo expirado
                                        </div>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-red-500">
                                    {indicadoresExamesPendentes.vencidos}
                                </span>
                            </div>

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
                                            Exame já realizado, dentro do prazo
                                        </div>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-emerald-500">
                                    {indicadoresExamesPendentes.noPrazo}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* BUSCA + PROGRESSO */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                placeholder="Buscar funcionário ou empresa..."
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>

            {/* TABELA */}
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                        <TableRow className="hover:bg-transparent">
                            <SortHeader label="Funcionário" sortKeyValue="nome" />
                            <SortHeader label="Empresa / Unidade" sortKeyValue="empresa" />
                            <SortHeader label="Médico Examinador" sortKeyValue="medicoExaminador" />
                            <SortHeader label="Seq. Ficha" sortKeyValue="sequencialFicha" />
                            <SortHeader label="Data Ficha" sortKeyValue="dataFicha" />
                            <SortHeader label="Exames Pendentes" sortKeyValue="examesList" />
                        </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pendenciasPaginadas.map((item: any, idx: number) => (
                            <TableRow
                                key={`${item.cpf}-${idx}`}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            >
                                {/* FUNCIONÁRIO */}
                                <TableCell>
                                    <button
                                        type="button"
                                        onClick={() => handleRowClick(item.cpf, item)}
                                        className="text-left group flex items-center gap-2.5"
                                    >
                                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black bg-red-500/10 text-red-500">
                                            {String(item.nome || "?").charAt(0).toUpperCase()}
                                        </span>
                                        <span className="font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                                            {item.nome}
                                        </span>
                                    </button>
                                </TableCell>

                                {/* EMPRESA */}
                                <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                    <div className="max-w-[220px] truncate" title={item.empresa}>
                                        {item.empresa}
                                    </div>
                                </TableCell>

                                {/* MÉDICO EXAMINADOR */}
                                <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                    <div className="max-w-[180px] truncate" title={item.medicoExaminador}>
                                        {item.medicoExaminador}
                                    </div>
                                </TableCell>

                                {/* SEQ. FICHA */}
                                <TableCell className="text-xs font-mono text-slate-500">
                                    {item.sequencialFicha}
                                </TableCell>

                                {/* DATA FICHA */}
                                <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                    {item.dataFicha || "-"}
                                </TableCell>

                                {/* EXAMES */}
                                <TableCell className="max-w-[280px]">
                                    <div className="flex flex-wrap gap-1.5">
                                        {item.examesDetalhados.map((exame: any, eIdx: number) => {
                                            const corBadge = exame.ignorado
                                                ? "bg-slate-500/10 text-slate-400 border-slate-500/20 opacity-70"
                                                : !exame.dataExame
                                                    ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                                                    : exame.statusPrazoExame?.estaVencido
                                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

                                            return (
                                                <Badge
                                                    key={eIdx}
                                                    variant="outline"
                                                    className={`flex flex-col items-start gap-0 leading-tight py-1 px-2.5 text-[10px] font-semibold rounded-full ${corBadge}`}
                                                    title={
                                                        exame.ignorado
                                                            ? "Exame configurado para não entrar no cálculo de prazo/conclusão"
                                                            : exame.dataExame
                                                                ? `Exame realizado em ${exame.dataExame}${exame.temRelacao === false ? " — aguardando vínculo GED" : ""}`
                                                                : "Exame ainda não realizado"
                                                    }
                                                >
                                                    <span>{exame.nome}{exame.ignorado ? " (ignorado)" : ""}</span>
                                                </Badge>
                                            );
                                        })}
                                    </div>
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