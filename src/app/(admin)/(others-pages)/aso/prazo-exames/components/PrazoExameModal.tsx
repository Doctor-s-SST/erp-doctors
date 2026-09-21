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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrazoExame } from "../types";

interface PrazoExameModalProps {
    open: boolean;
    selectedItem: PrazoExame | null;
    nomeExame: string;
    prazoDias: number | "";
    tipo_filtro: string;
    ignorar_exame: boolean;
    saving: boolean;
    onNomeExameChange: (value: string) => void;
    onPrazoDiasChange: (value: number | "") => void;
    onTipoFiltroChange: (value: string) => void;
    onIgnorarExameChange: (value: boolean) => void;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
}

export function PrazoExameModal({
    open,
    selectedItem,
    nomeExame,
    prazoDias,
    tipo_filtro,
    ignorar_exame,
    saving,
    onNomeExameChange,
    onPrazoDiasChange,
    onTipoFiltroChange,
    onIgnorarExameChange,
    onClose,
    onSave,
}: PrazoExameModalProps) {
    return (
        <Dialog open={open} onOpenChange={(isOpen) => !saving && !isOpen && onClose()}>
            <DialogContent className="sm:max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <form onSubmit={onSave}>
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            {selectedItem ? "Editar Prazo de Exame" : "Novo Prazo de Exame"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Digite o nome exato do exame e a quantidade de dias limite para entrega do ASO.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nome_exame" className="text-xs font-bold uppercase">
                                Nome do Exame
                            </Label>
                            <Input
                                id="nome_exame"
                                placeholder="Ex: Audiometria, Raio X de Tórax..."
                                value={nomeExame}
                                onChange={(e) => onNomeExameChange(e.target.value)}
                                required
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="prazo_dias" className="text-xs font-bold uppercase">
                                Prazo em Dias
                            </Label>
                            <Input
                                id="prazo_dias"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={prazoDias}
                                onChange={(e) =>
                                    onPrazoDiasChange(
                                        e.target.value === "" ? "" : Number(e.target.value)
                                    )
                                }
                                required
                                className="h-9 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tipo_filtro" className="text-xs font-bold uppercase">
                                Tipo de Filtro
                            </Label>
                            <Select
                                value={tipo_filtro}
                                onValueChange={onTipoFiltroChange}
                            >
                                <SelectTrigger className="w-full h-9 text-sm">
                                    <SelectValue placeholder="Selecione o tipo de filtro" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="clinico">Clínico</SelectItem>
                                    <SelectItem value="complementar">Complementar</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ignorar_exame" className="text-xs font-bold uppercase">
                                Ignorar Exame
                            </Label>
                            <Input
                                id="ignorar_exame"
                                type="checkbox"
                                checked={ignorar_exame}
                                onChange={(e) => onIgnorarExameChange(e.target.checked)}
                                className="h-9 text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="h-9 text-xs uppercase"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="h-9 text-xs uppercase bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
