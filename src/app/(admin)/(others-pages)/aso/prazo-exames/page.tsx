"use client"

import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Clock, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";

import { PrazoExame } from "./types";
import { normalizarNomeExame } from "./utils";
import { PrazoExameModal } from "./components/PrazoExameModal";
import { ImportarPrazosExames } from "./components/ImportarPrazosExames";

export default function PrazosAsoPage() {
    const [prazos, setPrazos] = useState<PrazoExame[]>([]);
    const [loading, setLoading] = useState(false);
    const [unidadeId, setUnidadeId] = useState<string | null>(null);

    // Estados para Modal de Criação / Edição
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PrazoExame | null>(null);
    const [nomeExame, setNomeExame] = useState("");
    const [prazoDias, setPrazoDias] = useState<number | "">(0);
    const [tipoFiltro, setTipoFiltro] = useState("");
    const [ignorarExame, setIgnorarExame] = useState(false)
    // Carrega o contexto do usuário (unidade_id)
    useEffect(() => {
        const fetchUserContext = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("unidade_id")
                    .eq("id", user.id)
                    .single();

                if (profile?.unidade_id) {
                    setUnidadeId(profile.unidade_id);
                }
            }
        };
        fetchUserContext();
    }, []);

    // Carrega prazos do Supabase isolados pela unidadeId
    const fetchPrazos = useCallback(async () => {
        if (!unidadeId) return;

        setLoading(true);
        const { data, error } = await supabase
            .from("prazos_exames")
            .select("*")
            .eq("unidade_id", unidadeId)
            .order("nome_exame", { ascending: true });

        if (error) {
            toast.error("Erro ao carregar prazos cadastrados.");
        } else {
            setPrazos(data || []);
        }
        setLoading(false);
    }, [unidadeId]);

    useEffect(() => {
        if (unidadeId) {
            fetchPrazos();
        }
    }, [unidadeId, fetchPrazos]);

    // Handler para abrir modal de CRIAÇÃO
    const handleOpenCreateModal = () => {
        setSelectedItem(null);
        setNomeExame("");
        setPrazoDias(0);
        setIgnorarExame(false)
        setIsDialogOpen(true);
    };

    // Handler para abrir modal de EDIÇÃO
    const handleOpenEditModal = (item: PrazoExame) => {
        setSelectedItem(item);
        setNomeExame(item.nome_exame);
        setPrazoDias(item.prazo_dias);
        setTipoFiltro(item.tipo_filtro || "");
        setIgnorarExame(item.ignorar_exame || false);
        setIsDialogOpen(true);
    };

    // Salvar / Atualizar Manualmente
    const handleSaveManual = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!unidadeId) {
            toast.error("Unidade não identificada.");
            return;
        }

        setSaving(true);

        try {
            const nomeExameNormalizado = normalizarNomeExame(nomeExame);

            if (!nomeExameNormalizado) {
                toast.warning("Informe o nome do exame.");
                return;
            }

            const payload = {
                unidade_id: unidadeId,
                nome_exame: nomeExameNormalizado,
                prazo_dias: Number(prazoDias) || 0,
                tipo_filtro: tipoFiltro,
                ignorar_exame: ignorarExame,
                updated_at: new Date().toISOString(),
            };

            let error = null;

            if (selectedItem?.id) {
                // Atualização por ID
                const res = await supabase
                    .from("prazos_exames")
                    .update(payload)
                    .eq("id", selectedItem.id);
                error = res.error;
            } else {
                // Inserção/Upsert por conflito (unidade_id, nome_exame)
                const res = await supabase
                    .from("prazos_exames")
                    .upsert(payload, { onConflict: "unidade_id,nome_exame" });
                error = res.error;
            }

            if (error) {
                console.error(error);
                toast.error("Erro ao salvar o prazo.");
            } else {
                toast.success(
                    selectedItem
                        ? "Prazo atualizado com sucesso!"
                        : "Prazo cadastrado com sucesso!"
                );
                setIsDialogOpen(false);
                fetchPrazos();
            }
        } catch (err) {
            console.error(err);
            toast.error("Erro ao salvar no banco de dados.");
        } finally {
            setSaving(false);
        }
    };

    // Deletar Item
    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este prazo?")) return;

        const { error } = await supabase
            .from("prazos_exames")
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Erro ao excluir o registro.");
        } else {
            toast.success("Prazo excluído com sucesso!");
            fetchPrazos();
        }
    };

    return (
        <div className="min-h-fit mt-2 space-y-4 bg-gray-500/20 rounded-xl p-2">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20 text-blue-400">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-tight">
                            Cadastro de Prazos de ASO por Exame
                        </h1>
                        <p className="text-xs text-slate-400 font-mono">
                            Defina os prazos em dias para entrega de cada tipo de exame
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        type="button"
                        onClick={handleOpenCreateModal}
                        disabled={!unidadeId}
                        className="h-9 text-xs font-bold uppercase gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="w-3.5 h-3.5" /> Novo Prazo
                    </Button>

                    <ImportarPrazosExames
                        unidadeId={unidadeId}
                        prazos={prazos}
                        onImportado={fetchPrazos}
                    />
                </div>
            </header>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-1">
                <CardHeader className="flex flex-col items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800 sm:flex-row sm:items-center">
                    <CardTitle className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                        <div className="flex flex-col gap-1">
                            <p> Prazos Cadastrados ({prazos.length})</p>
                            <p className="text-red-500 text-[11px]">
                                Atenção: os nomes dos exames cadastrados devem ser exatamente como no SOC
                            </p>
                        </div>
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={fetchPrazos}
                        className="h-8 w-8"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                        />
                    </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow>
                                <TableHead className="font-bold text-xs uppercase">
                                    Nome do Exame
                                </TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right">
                                    Prazo p/ ASO (Dias)
                                </TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right">
                                    Tipo Filtro
                                </TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right">
                                    Dispensa Documento GED
                                </TableHead>
                                <TableHead className="font-bold text-xs uppercase text-right w-24">
                                    Ações
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prazos.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="text-center py-8 text-xs text-slate-400 font-mono"
                                    >
                                        Nenhum prazo cadastrado nesta unidade. Clique em &quot;Novo Prazo&quot; ou importe a planilha.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                prazos.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        <TableCell className="font-medium text-sm text-slate-800 dark:text-slate-200">
                                            {item.nome_exame}
                                        </TableCell>
                                        <TableCell className="text-sm text-right font-bold text-blue-500">
                                            {item.prazo_dias} dia(s)
                                        </TableCell>
                                        <TableCell className="font-medium text-right text-sm text-slate-800 dark:text-slate-200s">
                                            {item.tipo_filtro}
                                        </TableCell>
                                        <TableCell className="font-medium text-right text-sm text-slate-800 dark:text-slate-200s">
                                            {item.ignorar_exame ? "Sim" : "Não"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenEditModal(item)}
                                                    className="h-7 w-7 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        item.id && handleDelete(item.id)
                                                    }
                                                    className="h-7 w-7 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal de Criação / Edição */}
            <PrazoExameModal
                open={isDialogOpen}
                selectedItem={selectedItem}
                nomeExame={nomeExame}
                prazoDias={prazoDias}
                tipo_filtro={tipoFiltro}
                ignorar_exame={ignorarExame}
                saving={saving}
                onNomeExameChange={setNomeExame}
                onPrazoDiasChange={setPrazoDias}
                onTipoFiltroChange={setTipoFiltro}
                onIgnorarExameChange={setIgnorarExame}
                onClose={() => setIsDialogOpen(false)}
                onSave={handleSaveManual}
            />
        </div>
    );
}
