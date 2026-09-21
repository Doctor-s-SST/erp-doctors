"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    UserCheck,
    Layers,
    CheckCircle2,
    AlertCircle,
    FileText,
    Stethoscope,
    FileSearch,
    FolderArchive,
    Download,
    Loader2,
    FileCheck,
    Eye,
} from "lucide-react";
import { FuncionarioModalProps, DocumentoGed, ArquivoGed } from "../types";

export function FuncionarioModal({
    open,
    onOpenChange,
    funcionario,
}: FuncionarioModalProps) {
    const [downloadingGedId, setDownloadingGedId] = useState<string | null>(null);

    if (!funcionario) return null;

    const aso = funcionario.aso || {};
    const exames = Array.isArray(aso.listaExamesResumida)
        ? aso.listaExamesResumida
        : Array.isArray(funcionario.listaExamesResumida)
            ? funcionario.listaExamesResumida
            : [];

    const totalExames = Number(aso.totalExames ?? exames.length);
    const examesPendentes = Number(
        aso.examesPendentes ?? exames.filter((e: any) => e?.isPendente).length
    );
    const examesConcluidos = Number(
        aso.examesConcluidos ?? Math.max(0, totalExames - examesPendentes)
    );
    const percentualConclusao =
        totalExames > 0
            ? Math.round((examesConcluidos / totalExames) * 100)
            : 0;

    const nomeFuncionario = funcionario.nomeFuncionario || funcionario.nome || "Funcionário";
    const cpfFuncionario = funcionario.cpfFuncionario || funcionario.cpf || "-";
    const razaoSocial = funcionario.razaoSocial || funcionario.empresa || "Empresa não informada";
    const codigoEmpresa = funcionario.codigoEmpresa || "-";
    const codigoFuncionario = funcionario.codigoFuncionario || "-";

    const resultadoAso = aso.resultadoAsoSoc || funcionario.resultadoAsoSoc || "Não informado";
    const resultadoNormalizado = String(resultadoAso)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const resultadoPositivo =
        resultadoNormalizado.includes("apto") ||
        resultadoNormalizado.includes("conclui") ||
        resultadoNormalizado.includes("pronto");

    const resultadoNegativo =
        resultadoNormalizado.includes("inapto") ||
        resultadoNormalizado.includes("pend");

    const resultadoClassName = resultadoPositivo
        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        : resultadoNegativo
            ? "bg-red-500/10 text-red-500 border-red-500/20"
            : "bg-blue-500/10 text-blue-500 border-blue-500/20";

    const documentosGed: DocumentoGed[] = Array.isArray(funcionario.documentosGed)
        ? funcionario.documentosGed
        : [];

    const handleVisualizarArquivo = async (
        doc: DocumentoGed,
        arquivo: ArquivoGed | string
    ) => {
        const codigoArquivo =
            typeof arquivo === "object"
                ? arquivo.codigoArquivo
                : undefined;

        const nomeArquivo =
            typeof arquivo === "object"
                ? arquivo.nomeArquivo || arquivo.codigoArquivo
                : String(arquivo);

        const arquivoId =
            `${doc.codigoGed || "ged"}-${codigoArquivo || nomeArquivo}`;

        setDownloadingGedId(arquivoId);

        // Abre a janela imediatamente para evitar bloqueio de popup
        const novaJanela = window.open(
            "",
            "visualizadorGED",
            "width=900,height=700,resizable=yes,scrollbars=yes"
        );

        if (!novaJanela) {
            setDownloadingGedId(null);

            toast.warning(
                "O navegador bloqueou a janela. Permita pop-ups para este site."
            );

            return;
        }

        // Opcional: mostra uma mensagem enquanto carrega
        novaJanela.document.write(`
        <html>
            <head>
                <title>Carregando documento...</title>
            </head>
            <body style="
                margin:0;
                display:flex;
                align-items:center;
                justify-content:center;
                height:100vh;
                font-family:Arial,sans-serif;
            ">
                Carregando documento...
            </body>
        </html>
    `);

        try {
            const payload = {
                codigoGed: doc.codigoGed,
                codigoArquivo,

                codigoEmpresa:
                    codigoEmpresa !== "-"
                        ? codigoEmpresa
                        : doc.codigoEmpresa,

                codigoFuncionario:
                    codigoFuncionario !== "-"
                        ? codigoFuncionario
                        : doc.codigoFuncionario,

                nomeGed: doc.nomeGed,
                nomeArquivo,

                sequencialFicha: doc.sequencialFicha,
                tipoFicha: doc.tipoFicha,

                dataEmissao:
                    doc.dataEmissao || doc.dataFicha,
            };

            const response = await fetch(
                "/api/download-documento-ged",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                const errData =
                    await response.json().catch(() => ({}));

                throw new Error(
                    errData.error ||
                    "Falha ao buscar o arquivo GED."
                );
            }

            const blob = await response.blob();

            if (!blob.size) {
                throw new Error(
                    "O documento retornado está vazio."
                );
            }

            const url =
                window.URL.createObjectURL(blob);

            novaJanela.location.href = url;

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 60_000);

        } catch (error: any) {
            novaJanela.close();

            console.error(
                "Erro ao visualizar arquivo GED:",
                error
            );

            toast.error(
                error.message ||
                "Erro ao visualizar o arquivo GED."
            );

        } finally {
            setDownloadingGedId(null);
        }
    };

    const InfoItem = ({
        label,
        value,
        mono = false,
    }: {
        label: string;
        value?: any;
        mono?: boolean;
    }) => (
        <div className="min-w-0">
            <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                {label}
            </span>
            <span
                className={`block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200 ${mono ? "font-mono" : ""
                    }`}
                title={value || "-"}
            >
                {value || "-"}
            </span>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex !w-[55vw] !max-w-[95vw] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 bg-white dark:bg-gray-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
                {/* HEADER */}
                <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-gray-950 px-6 py-5 pr-12">
                    <DialogHeader className="space-y-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                                    <UserCheck className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-base font-black text-slate-800 dark:text-slate-100">
                                        {nomeFuncionario}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                                        <span>{razaoSocial}</span>
                                        {(aso.tipoAso || funcionario.tipoAso) && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span>{aso.tipoAso || funcionario.tipoAso}</span>
                                            </>
                                        )}
                                        {codigoFuncionario !== "-" && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <span className="font-mono">Cód: {codigoFuncionario}</span>
                                            </>
                                        )}
                                    </DialogDescription>
                                </div>
                            </div>

                            <Badge
                                className={`shrink-0 border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${resultadoClassName}`}
                            >
                                {resultadoAso}
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                {/* CONTEÚDO */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* INDICADORES */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* TOTAL */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                    Total
                                </span>
                                <Layers className="w-4 h-4 text-blue-500" />
                            </div>
                            <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">
                                {totalExames}
                            </p>
                            <span className="text-[9px] text-slate-400">
                                exames
                            </span>
                        </div>

                        {/* CONCLUÍDOS */}
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                    Concluídos
                                </span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
                                {examesConcluidos}
                            </p>
                            <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70">
                                realizados
                            </span>
                        </div>

                        {/* PENDENTES */}
                        <div
                            className={`rounded-xl border p-3 ${examesPendentes > 0
                                ? "border-red-500/20 bg-red-500/5"
                                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span
                                    className={`text-[9px] font-bold uppercase tracking-wide ${examesPendentes > 0
                                        ? "text-red-500"
                                        : "text-slate-400"
                                        }`}
                                >
                                    Pendentes
                                </span>
                                <AlertCircle
                                    className={`w-4 h-4 ${examesPendentes > 0
                                        ? "text-red-500"
                                        : "text-slate-400"
                                        }`}
                                />
                            </div>
                            <p
                                className={`mt-1 text-xl font-black ${examesPendentes > 0
                                    ? "text-red-500"
                                    : "text-slate-700 dark:text-slate-200"
                                    }`}
                            >
                                {examesPendentes}
                            </p>
                            <span className="text-[9px] text-slate-400">
                                aguardando
                            </span>
                        </div>
                    </div>

                    {/* PROGRESSO */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Progresso dos exames
                            </span>
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                {percentualConclusao}%
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${percentualConclusao}%` }}
                            />
                        </div>
                    </div>

                    {/* DADOS DO FUNCIONÁRIO & ASO */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                Dados do ASO & Funcionário
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/40">
                            <InfoItem
                                label="Nome"
                                value={nomeFuncionario}
                            />
                            <InfoItem
                                label="CPF"
                                value={cpfFuncionario}
                                mono
                            />
                            <InfoItem
                                label="Empresa"
                                value={razaoSocial}
                            />
                            <InfoItem
                                label="Cód. Empresa"
                                value={codigoEmpresa}
                                mono
                            />
                            <InfoItem
                                label="Cód. Funcionário"
                                value={codigoFuncionario}
                                mono
                            />
                            <InfoItem
                                label="Resultado ASO"
                                value={resultadoAso}
                            />
                            <InfoItem
                                label="Data ASO"
                                value={aso.dataAso || funcionario.dataAso || "-"}
                            />
                            <InfoItem
                                label="Data Ficha"
                                value={aso.dataFicha || funcionario.dataFicha || "Não emitida"}
                            />
                            <InfoItem
                                label="Médico responsável"
                                value={aso.medico || funcionario.medico || "-"}
                            />
                            <InfoItem
                                label="CRM Médico"
                                value={aso.crmMedico || funcionario.crmMedico || "-"}
                                mono
                            />
                            <InfoItem
                                label="Tipo de ASO"
                                value={aso.tipoAso || funcionario.tipoAso || "-"}
                            />
                            <InfoItem
                                label="Sequencial Ficha"
                                value={aso.sequencialFicha || funcionario.sequencialFicha || "-"}
                                mono
                            />
                            {aso.codigoGed && (
                                <InfoItem
                                    label="Cód. GED ASO"
                                    value={aso.codigoGed}
                                    mono
                                />
                            )}
                        </div>
                    </section>

                    {/* EXAMES */}
                    <section>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Stethoscope className="w-4 h-4 text-violet-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    Exames realizados
                                </h3>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400">
                                {totalExames} {totalExames === 1 ? "exame" : "exames"}
                            </span>
                        </div>

                        {exames.length > 0 ? (
                            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                                {exames.map((exame: any, index: number) => {
                                    const nome =
                                        exame?.descricaoExame ||
                                        exame?.nomeExame ||
                                        exame?.nome ||
                                        exame ||
                                        "Exame não informado";

                                    const dataExame = String(exame?.dataExame || "").trim();
                                    const possuiDataExame =
                                        Boolean(dataExame) && dataExame !== "-";

                                    const pendente = Boolean(exame?.isPendente);

                                    return (
                                        <div
                                            key={`${nome}-${index}`}
                                            className={`group flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors ${pendente
                                                ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10"
                                                : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${pendente
                                                        ? "bg-red-500/10"
                                                        : "bg-emerald-500/10"
                                                        }`}
                                                >
                                                    {pendente ? (
                                                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    )}
                                                </div>

                                                <div className="min-w-0">
                                                    <span
                                                        className="block min-w-0 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                                        title={nome}
                                                    >
                                                        {nome}
                                                    </span>

                                                    {possuiDataExame && (
                                                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                                                            Data do exame: {dataExame}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <Badge
                                                variant="outline"
                                                className={`shrink-0 text-[9px] font-bold ${pendente
                                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    }`}
                                            >
                                                {pendente ? "Pendente" : "Concluído"}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center">
                                <FileSearch className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-[10px] font-bold uppercase text-slate-400">
                                    Nenhum exame detalhado disponível
                                </p>
                            </div>
                        )}
                    </section>

                    {/* DOCUMENTOS GED */}
                    <section>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <FolderArchive className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                    Documentos GED do Funcionário
                                </h3>
                            </div>
                        </div>

                        {documentosGed.length > 0 ? (
                            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                {documentosGed.map((doc: DocumentoGed, index: number) => {
                                    const gedId = doc.codigoGed || doc.nomeGed || String(index);
                                    const temArquivo = Array.isArray(doc.arquivos) && doc.arquivos.length > 0;

                                    return (
                                        <div
                                            key={`${gedId}-${index}`}
                                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                                        >
                                            {/* CABEÇALHO DO DOCUMENTO GED */}
                                            <div className="flex items-start justify-between gap-3 min-w-0">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 mt-0.5">
                                                        <FileCheck className="h-4 w-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p
                                                            className="truncate text-[12px] font-bold text-slate-800 dark:text-slate-100"
                                                            title={doc.nomeGed || "Documento GED"}
                                                        >
                                                            Nome Ged: {doc.nomeGed || "Documento GED"}
                                                        </p>

                                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                            {(doc.dataEmissao || doc.dataFicha) && (
                                                                <span>Data: <strong className="font-mono text-slate-700 dark:text-slate-300">{doc.dataEmissao || doc.dataFicha}</strong></span>
                                                            )}
                                                            {doc.codigoGed && (
                                                                <span>Cód. GED: <strong className="font-mono text-slate-700 dark:text-slate-300">{doc.codigoGed}</strong></span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {!temArquivo && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[9px] font-bold text-slate-400 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 shrink-0"
                                                    >
                                                        Sem arquivo disponível
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* ARQUIVOS DO DOCUMENTO */}
                                            {temArquivo && (
                                                <div className="mt-3 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                        Arquivos ({(doc.arquivos || []).length})
                                                    </p>

                                                    <div className="space-y-1.5">
                                                        {(doc.arquivos || []).map((arquivo: ArquivoGed | string, aIdx: number) => {
                                                            const codigoArq = typeof arquivo === "object" ? arquivo.codigoArquivo : undefined;
                                                            const nomeArq = typeof arquivo === "object" ? (arquivo.nomeArquivo || arquivo.codigoArquivo) : String(arquivo);
                                                            const dataUpload = typeof arquivo === "object" ? arquivo.dataUpload : undefined;
                                                            const horaUpload = typeof arquivo === "object" ? arquivo.horaUpload : undefined;

                                                            const arquivoKey = codigoArq || `${gedId}-${aIdx}`;
                                                            const arquivoId = `${doc.codigoGed || 'ged'}-${codigoArq || nomeArq}`;
                                                            const isDownloading = downloadingGedId === arquivoId;

                                                            return (
                                                                <div
                                                                    key={arquivoKey}
                                                                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-950 px-3 py-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                                                                        <div className="min-w-0">
                                                                            <p
                                                                                className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                                                                title={nomeArq}
                                                                            >
                                                                                {nomeArq}
                                                                            </p>
                                                                            {dataUpload && (
                                                                                <span className="text-[9px] text-slate-400 font-mono">
                                                                                    Upload: {dataUpload} {horaUpload || ""}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        disabled={isDownloading}
                                                                        onClick={() => handleVisualizarArquivo(doc, arquivo)}
                                                                        className="h-7 shrink-0 px-2.5 text-[9px] font-bold uppercase gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 transition-all cursor-pointer"
                                                                    >
                                                                        {isDownloading ? (
                                                                            <>
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                                Abrindo...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Eye className="h-3 w-3" />
                                                                                Visualizar
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-8 text-center bg-slate-50/50 dark:bg-slate-900/30">
                                <FolderArchive className="w-7 h-7 text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-[10px] font-bold uppercase text-slate-400">
                                    Nenhum documento GED encontrado para este funcionário.
                                </p>
                            </div>
                        )}
                    </section>
                </div>

                {/* FOOTER */}
                <div className="shrink-0 flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-8 px-4 text-[10px] font-bold uppercase tracking-wide"
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}