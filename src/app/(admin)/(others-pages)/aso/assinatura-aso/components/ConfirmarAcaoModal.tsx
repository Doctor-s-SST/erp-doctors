"use client"

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Pacientes, TipoConfirmacao } from "../types";

interface ConfirmarAcaoModalProps {
    open: boolean;
    tipoConfirmacao: TipoConfirmacao;
    itemSelecionado: Pacientes | null;
    enviando: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function ConfirmarAcaoModal({
    open,
    tipoConfirmacao,
    itemSelecionado,
    enviando,
    onClose,
    onConfirm,
}: ConfirmarAcaoModalProps) {
    const isEnvio = tipoConfirmacao === "ENVIO";
    const isEnvioPendencia = tipoConfirmacao === "ENVIO_PENDENCIA";
    const isReenvioAso = tipoConfirmacao === "REENVIO_ASO";

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !enviando && !isOpen && onClose()}>
            <DialogContent className="sm:max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div
                            className={`p-2 rounded-lg ${isReenvioAso
                                    ? "bg-cyan-500/10 text-cyan-600"
                                    : isEnvio || isEnvioPendencia
                                        ? isEnvioPendencia
                                            ? "bg-red-500/10 text-red-600"
                                            : "bg-blue-500/10 text-blue-600"
                                        : "bg-emerald-500/10 text-emerald-600"
                                }`}
                        >
                            {isReenvioAso ? (
                                <RotateCcw className="w-5 h-5" />
                            ) : isEnvio || isEnvioPendencia ? (
                                <Send className="w-5 h-5" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5" />
                            )}
                        </div>
                        <DialogTitle className="text-base font-bold">
                            {isReenvioAso
                                ? "Confirmar reenvio do ASO"
                                : isEnvioPendencia
                                    ? "Confirmar envio da pendência"
                                    : isEnvio
                                        ? "Confirmar envio do ASO"
                                        : "Confirmar assinatura do ASO"}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-slate-500 pt-2">
                        Confirma que o ASO de{" "}
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                            {itemSelecionado?.nome_paciente}
                        </span>{" "}
                        (ficha {itemSelecionado?.sequencial_ficha}){" "}
                        {isReenvioAso
                            ? "será reenviado"
                            : `foi ${isEnvioPendencia ? "enviado a pendência" : isEnvio ? "enviado" : "assinado"}`}?
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={enviando}
                        onClick={onClose}
                        className="h-9 text-xs uppercase"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        disabled={enviando}
                        onClick={onConfirm}
                        className={`h-9 text-xs uppercase text-white ${isReenvioAso
                                ? "bg-cyan-600 hover:bg-cyan-700"
                                : isEnvio || isEnvioPendencia
                                    ? isEnvioPendencia
                                        ? "bg-red-600 hover:bg-red-700"
                                        : "bg-blue-600 hover:bg-blue-700"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                    >
                        {enviando ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isReenvioAso ? (
                            "Reenviar ASO"
                        ) : (
                            "Confirmar"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
