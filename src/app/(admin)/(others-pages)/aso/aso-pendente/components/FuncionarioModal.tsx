"use client"

import React from "react";
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
} from "lucide-react";
import { FuncionarioModalProps } from "../types";

export function FuncionarioModal({
    open,
    onOpenChange,
    funcionario,
}: FuncionarioModalProps) {
    if (!funcionario) return null;

    const exames = Array.isArray(funcionario.listaExamesResumida)
        ? funcionario.listaExamesResumida
        : [];

    const totalExames = exames.length;
    const examesPendentes = exames.filter((e: any) => e?.isPendente).length;
    const examesConcluidos = totalExames - examesPendentes;
    const percentualConclusao =
        totalExames > 0
            ? Math.round((examesConcluidos / totalExames) * 100)
            : 0;

    const resultadoAso = funcionario.resultadoAsoSoc || "Não informado";
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
            <DialogContent className="flex !w-[50vw] !max-w-[90vw] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 bg-white dark:bg-gray-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
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
                                        {funcionario.nome || "Funcionário"}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                                        <span>
                                            {funcionario.empresa || "Empresa não informada"}
                                        </span>
                                        {funcionario.tipoAso && (
                                            <>
                                                <span className="text-slate-300 dark:text-slate-700">
                                                    •
                                                </span>
                                                <span>{funcionario.tipoAso}</span>
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

                    {/* DADOS DA FICHA */}
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                Dados da ficha
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <InfoItem
                                label="CPF"
                                value={funcionario.cpf}
                                mono
                            />
                            <InfoItem
                                label="Data da ficha"
                                value={funcionario.dataFicha || "Não emitida"}
                            />
                            <InfoItem
                                label="Tipo de ASO"
                                value={funcionario.tipoAso}
                            />
                            <InfoItem
                                label="Sequencial"
                                value={funcionario.sequencialFicha}
                                mono
                            />
                            <InfoItem
                                label="Médico responsável"
                                value={funcionario.medico}
                            />
                            <InfoItem
                                label="CRM"
                                value={funcionario.crmMedico}
                                mono
                            />
                            <InfoItem
                                label="Empresa"
                                value={funcionario.empresa}
                            />
                            <InfoItem
                                label="Resultado"
                                value={resultadoAso}
                            />
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
                            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                {exames.map((exame: any, index: number) => {
                                    const nome =
                                        exame?.descricaoExame ||
                                        exame?.nomeExame ||
                                        exame?.nome ||
                                        exame ||
                                        "Exame não informado";

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

                                                <span
                                                    className="min-w-0 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                                                    title={nome}
                                                >
                                                    {nome}
                                                </span>
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
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center">
                                <FileSearch className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-[10px] font-bold uppercase text-slate-400">
                                    Nenhum exame detalhado disponível
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
