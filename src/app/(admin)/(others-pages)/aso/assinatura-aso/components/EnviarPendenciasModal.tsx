"use client"

import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pacientes } from "../types";

interface EnviarPendenciasModalProps {
    open: boolean;
    pacientes: Pacientes[];
    observacoes: Record<string, string>;
    enviando: boolean;
    onObservacaoChange: (id: string, value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
    titulo?: string;
    descricao?: string;
    textoConfirmar?: string;
}

export function EnviarPendenciasModal({
    open,
    pacientes,
    observacoes,
    enviando,
    onObservacaoChange,
    onClose,
    onConfirm,
    titulo = "Enviar pendência",
    descricao = "Informe uma justificativa específica para cada paciente.",
    textoConfirmar,
}: EnviarPendenciasModalProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !enviando && !isOpen && onClose()}>
            <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-xl">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle>{titulo}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {descricao}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-2">
                    {pacientes.map((paciente) => {
                        const id = paciente.id || "";
                        return (
                            <div key={id} className="space-y-2 rounded-lg border p-3">
                                <div>
                                    <p className="text-sm font-bold">{paciente.nome_paciente}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Ficha {paciente.sequencial_ficha}
                                    </p>
                                </div>
                                <Label htmlFor={`observacao-pendencia-${id}`} className="text-xs uppercase">
                                    Justificativa
                                </Label>
                                <Textarea
                                    id={`observacao-pendencia-${id}`}
                                    value={observacoes[id] || ""}
                                    onChange={(event) => onObservacaoChange(id, event.target.value)}
                                    placeholder="Descreva a pendência deste paciente..."
                                    disabled={enviando}
                                    className="min-h-20"
                                />
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={enviando} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" disabled={enviando} onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {textoConfirmar || `Enviar pendência${pacientes.length > 1 ? "s" : ""}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
