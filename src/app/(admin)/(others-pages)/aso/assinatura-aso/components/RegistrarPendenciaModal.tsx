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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Pacientes } from "../types";

interface RegistrarPendenciaModalProps {
    open: boolean;
    itemSelecionado: Pacientes | null;
    justificativa: string;
    enviando: boolean;
    onJustificativaChange: (value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}

export function RegistrarPendenciaModal({
    open,
    itemSelecionado,
    justificativa,
    enviando,
    onJustificativaChange,
    onClose,
    onConfirm,
}: RegistrarPendenciaModalProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !enviando && !isOpen && onClose()}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500/10 p-2 rounded-lg text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-base font-bold">
                            Registrar pendência do ASO
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-xs text-slate-500 pt-2">
                        {itemSelecionado?.nome_paciente} (ficha {itemSelecionado?.sequencial_ficha})
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5 py-2">
                    <Label htmlFor="justificativa" className="text-xs font-bold uppercase">
                        Justificativa
                    </Label>
                    <Textarea
                        id="justificativa"
                        placeholder="Descreva o motivo da pendência..."
                        value={justificativa}
                        onChange={(e) => onJustificativaChange(e.target.value)}
                        className="min-h-24 text-sm"
                        autoFocus
                    />
                </div>

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
                        className="h-9 text-xs uppercase bg-red-600 hover:bg-red-700 text-white"
                    >
                        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
