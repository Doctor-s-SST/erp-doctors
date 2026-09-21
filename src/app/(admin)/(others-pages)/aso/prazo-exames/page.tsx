"use client"

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
import { Download, Upload, Clock, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";

import { PrazoExame } from "./types";
import { normalizarNomeExame, normalizarTipoFiltro } from "./utils";
import { PrazoExameModal } from "./components/PrazoExameModal";

export default function PrazosAsoPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
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

    // Gerar e baixar modelo Excel de Exemplo
    const handleDownloadModelo = () => {
        const dadosModelo = prazos.map((item) => ({
            "Nome do Exame": item.nome_exame,
            "Prazo (Dias)": item.prazo_dias,
            "Tipo Filtro": item.tipo_filtro === "clinico" || item.tipo_filtro === "complementar" ? item.tipo_filtro : "",
            "Ignorar Exame": item.ignorar_exame ? "Sim" : "Não",
        }));
        const worksheet = XLSX.utils.json_to_sheet(dadosModelo);
        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(workbook, worksheet, "Prazos_ASO");

        worksheet["!cols"] = [
            { wch: 35 },
            { wch: 15 },
            { wch: 18 },
            { wch: 30 },
        ];

        XLSX.writeFile(workbook, "Modelo_Importacao_Prazos_ASO.xlsx");

        toast.success(
            dadosModelo.length > 0
                ? "Modelo gerado com os prazos cadastrados!"
                : "Modelo vazio gerado com sucesso!"
        );
    };

    // Importar planilha Excel
    const handleImportExcel = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!unidadeId) {
            toast.error("Unidade do usuário não identificada.");
            return;
        }

        setLoading(true);

        try {
            const dataBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(dataBuffer);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) {
                toast.warning("A planilha selecionada está vazia.");
                return;
            }

            const payloadBruto = rows
                .map((row, index) => {
                    const linhaExcel = index + 2;

                    const tipoFiltro = normalizarTipoFiltro(
                        row["Tipo Filtro"] ?? row["tipo_filtro"] ?? ""
                    );

                    const ignorarExameRaw = String(
                        row["Ignorar Exame"] ?? row["ignorar_exame"] ?? ""
                    ).trim().toLowerCase();
                    const ignorarExameValor = ["sim", "true", "1"].includes(ignorarExameRaw);

                    return {
                        linhaExcel,
                        unidade_id: unidadeId,
                        nome_exame: normalizarNomeExame(row["Nome do Exame"] || row["nome_exame"] || ""),
                        prazo_dias: Number(row["Prazo (Dias)"] || row["prazo_dias"] || 0),
                        tipo_filtro: tipoFiltro,
                        ignorar_exame: ignorarExameValor,
                        updated_at: new Date().toISOString(),
                    };
                })
                .filter((item) => item.nome_exame !== "");

            // ============================================================
            // VALIDAÇÃO DO TIPO DE FILTRO
            // ============================================================

            const tiposPermitidos = ["clinico", "complementar", ""];

            const linhasInvalidas = payloadBruto.filter(
                (item) => !tiposPermitidos.includes(item.tipo_filtro)
            );

            if (linhasInvalidas.length > 0) {
                const detalhes = linhasInvalidas
                    .map(
                        (item) =>
                            `• Linha ${item.linhaExcel}: ${item.tipo_filtro || "(vazio)"
                            } → permitido: clinico, complementar ou vazio`
                    )
                    .join("\n");

                toast.error(
                    `Não foi possível importar a planilha.\n\n` +
                    `Existem tipos de filtro inválidos:\n\n${detalhes}`,
                    {
                        duration: 10000,
                    }
                );

                return;
            }

            // ============================================================
            // REMOVE A LINHA AUXILIAR ANTES DO ENVIO AO SUPABASE
            // ============================================================

            const payload = payloadBruto.map(
                ({ linhaExcel, ...item }) => item
            );

            if (payload.length === 0) {
                toast.error(
                    "Formato inválido. Certifique-se de usar a coluna 'Nome do Exame'."
                );
                return;
            }

            const { error } = await supabase
                .from("prazos_exames")
                .upsert(payload, {
                    onConflict: "unidade_id,nome_exame",
                });

            if (error) {
                console.error(error);
                toast.error("Erro ao salvar prazos no banco de dados.");
            } else {
                toast.success(
                    `${payload.length} prazos importados/atualizados com sucesso!`
                );

                fetchPrazos();
            }
        } catch (err) {
            console.error(err);
            toast.error("Erro ao processar arquivo Excel.");
        } finally {
            setLoading(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
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

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadModelo}
                        className="h-9 text-xs font-bold uppercase gap-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    >
                        <Download className="w-3.5 h-3.5" /> Modelo Excel
                    </Button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />
                    <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || !unidadeId}
                        className="h-9 text-xs font-bold uppercase gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                    >
                        <Upload className="w-3.5 h-3.5" /> Importar Planilha
                    </Button>
                </div>
            </header>

            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 gap-1">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
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
                <CardContent className="p-0">
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
                                    Ignorar Exame
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