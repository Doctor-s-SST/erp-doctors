"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { normalizarNomeExame } from "../utils";

export type TipoGrupoExames = "exato" | "contem";

export interface GrupoFiltroExames {
    id: string;
    nome: string;
    tipo: TipoGrupoExames;
    exames: string[];
}

interface Props {
    unidadeId: string;
    examesDisponiveis: string[];
    grupoSelecionado: GrupoFiltroExames | null;
    onGrupoSelecionadoChange: (grupo: GrupoFiltroExames | null) => void;
}

const chaveGrupos = (unidadeId: string) => `aso_grupos_filtros_exames:${unidadeId}`;

export function correspondeAoGrupoExames(
    examesFuncionario: string[],
    grupo: GrupoFiltroExames | null
): boolean {
    if (!grupo) return true;

    const exames = new Set(examesFuncionario.map(normalizarNomeExame).filter(Boolean));
    const selecionados = new Set(grupo.exames.map(normalizarNomeExame).filter(Boolean));
    if (!selecionados.size) return false;

    const contemTodos = [...selecionados].every(exame => exames.has(exame));
    const contemAlgum = [...selecionados].some(exame => exames.has(exame));

    return grupo.tipo === "contem"
        ? contemAlgum
        : contemTodos && exames.size === selecionados.size;
}

export function FiltroGrupoExames({
    unidadeId,
    examesDisponiveis,
    grupoSelecionado,
    onGrupoSelecionadoChange,
}: Props) {
    const [grupos, setGrupos] = useState<GrupoFiltroExames[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editando, setEditando] = useState<GrupoFiltroExames | null>(null);
    const [nome, setNome] = useState("");
    const [tipo, setTipo] = useState<TipoGrupoExames>("exato");
    const [exames, setExames] = useState<string[]>([]);
    const [busca, setBusca] = useState("");
    const [detalhesOpen, setDetalhesOpen] = useState(false);

    useEffect(() => {
        if (!unidadeId) return;
        let ativo = true;
        Promise.resolve().then(() => {
            if (!ativo) return;
            try {
                const salvos = JSON.parse(localStorage.getItem(chaveGrupos(unidadeId)) || "[]");
                setGrupos(Array.isArray(salvos) ? salvos : []);
            } catch {
                setGrupos([]);
            }
        });
        return () => { ativo = false; };
    }, [unidadeId]);

    const persistir = (novosGrupos: GrupoFiltroExames[]) => {
        setGrupos(novosGrupos);
        localStorage.setItem(chaveGrupos(unidadeId), JSON.stringify(novosGrupos));
    };

    const abrirNovo = () => {
        setEditando(null);
        setNome("");
        setTipo("exato");
        setExames([]);
        setBusca("");
        setDialogOpen(true);
    };

    const abrirEdicao = (grupo: GrupoFiltroExames) => {
        setEditando(grupo);
        setNome(grupo.nome);
        setTipo(grupo.tipo);
        setExames(grupo.exames);
        setBusca("");
        setDialogOpen(true);
    };

    const salvar = () => {
        if (!nome.trim()) return toast.warning("Informe o nome do grupo.");
        if (!exames.length) return toast.warning("Selecione ao menos um exame.");

        const grupo: GrupoFiltroExames = {
            id: editando?.id || crypto.randomUUID(),
            nome: nome.trim(),
            tipo,
            exames: [...new Set(exames)].sort((a, b) => a.localeCompare(b, "pt-BR")),
        };
        const novos = editando
            ? grupos.map(item => item.id === editando.id ? grupo : item)
            : [...grupos, grupo];
        persistir(novos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        if (grupoSelecionado?.id === grupo.id) onGrupoSelecionadoChange(grupo);
        setDialogOpen(false);
        toast.success(editando ? "Grupo atualizado." : "Grupo criado.");
    };

    const excluir = (grupo: GrupoFiltroExames) => {
        if (!confirm(`Excluir o grupo “${grupo.nome}”?`)) return;
        persistir(grupos.filter(item => item.id !== grupo.id));
        if (grupoSelecionado?.id === grupo.id) onGrupoSelecionadoChange(null);
        toast.success("Grupo removido.");
    };

    const examesFiltrados = useMemo(() => {
        const termo = normalizarNomeExame(busca);
        return examesDisponiveis
            .filter(exame => !termo || normalizarNomeExame(exame).includes(termo))
            .sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [busca, examesDisponiveis]);

    return (
        <>
            <div className="flex h-10 w-full min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 shadow-sm transition-colors focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Layers3 className="h-3.5 w-3.5" />
                </div>
                <Select
                    value={grupoSelecionado?.id || "todos"}
                    onValueChange={id => {
                        setDetalhesOpen(false);
                        onGrupoSelecionadoChange(id === "todos" ? null : grupos.find(grupo => grupo.id === id) || null);
                    }}
                >
                    <SelectTrigger className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0 dark:bg-transparent">
                        <SelectValue placeholder="Grupo de exames" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Sem grupo de exames</SelectItem>
                        {grupos.map(grupo => (
                            <SelectItem key={grupo.id} value={grupo.id}>{grupo.nome} · {grupo.exames.length} exame(s)</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {grupoSelecionado && (
                    <Popover open={detalhesOpen} onOpenChange={setDetalhesOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" className="h-8 shrink-0 gap-1 px-2 text-[10px] font-bold uppercase text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40" title="Ver exames do grupo">
                                <Eye className="h-3.5 w-3.5" /> {grupoSelecionado.exames.length}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-96 p-0">
                            <PopoverHeader className="border-b bg-slate-50 p-4 dark:bg-slate-900">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <PopoverTitle className="truncate font-black">{grupoSelecionado.nome}</PopoverTitle>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {grupoSelecionado.tipo === "exato" ? "Conjunto exato, sem exames adicionais" : "Possui pelo menos um dos exames selecionados"}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                        {grupoSelecionado.tipo === "exato" ? "Somente" : "Contendo"}
                                    </Badge>
                                </div>
                            </PopoverHeader>
                            <div className="p-4">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Exames do grupo</p>
                                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                    {grupoSelecionado.exames.map((exame, indice) => (
                                        <div key={exame} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[9px] font-black text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">{indice + 1}</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{exame}</span>
                                        </div>
                                    ))}
                                </div>
                                <Button type="button" className="mt-4 h-9 w-full gap-2 bg-blue-600 text-xs hover:bg-blue-700" onClick={() => { setDetalhesOpen(false); abrirEdicao(grupoSelecionado); }}>
                                    <Pencil className="h-3.5 w-3.5" /> Editar grupo
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300" onClick={abrirNovo} title="Criar grupo de exames">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl overflow-hidden p-0">
                    <DialogHeader>
                        <div className="border-b bg-slate-900 p-5 text-white dark:bg-slate-950">
                            <DialogTitle className="flex items-center gap-3 text-white">
                                <span className="rounded-lg bg-white/15 p-2"><Layers3 className="h-5 w-5" /></span>
                                {editando ? "Editar grupo de exames" : "Novo grupo de exames"}
                            </DialogTitle>
                            <p className="mt-2 text-xs text-slate-300">Escolha o comportamento do filtro e os exames que fazem parte do grupo.</p>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 p-5 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nome do grupo</label>
                            <Input value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex.: Clínico + Audiometria" />
                        </div>
                        <Select value={tipo} onValueChange={valor => setTipo(valor as TipoGrupoExames)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="exato">Somente estes exames</SelectItem>
                                <SelectItem value="contem">Contendo um destes exames</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {tipo === "exato"
                                ? "Mostra somente funcionários cujo conjunto de exames seja exatamente igual ao grupo."
                                : "Mostra funcionários que possuam pelo menos um dos exames do grupo, permitindo exames adicionais."}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Exames do grupo</span>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{exames.length} selecionado(s)</Badge>
                        </div>
                        <Input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar exame..." />
                        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border bg-slate-50/60 p-2 dark:bg-slate-900/50">
                            {examesFiltrados.map(exame => (
                                <label key={exame} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-all ${exames.includes(exame) ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30" : "border-transparent bg-white hover:border-slate-200 dark:bg-slate-800"}`}>
                                    <Checkbox
                                        checked={exames.includes(exame)}
                                        onCheckedChange={marcado => setExames(anterior => marcado
                                            ? [...anterior, exame]
                                            : anterior.filter(item => item !== exame))}
                                    />
                                    <span className="flex-1 font-medium">{exame}</span>
                                </label>
                            ))}
                            {!examesFiltrados.length && <p className="py-8 text-center text-xs text-muted-foreground">Nenhum exame encontrado.</p>}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t pt-4">
                            <div>
                                {editando && (
                                    <Button type="button" variant="destructive" onClick={() => { excluir(editando); setDialogOpen(false); }}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                                <Button type="button" onClick={salvar}>{editando ? "Salvar alterações" : "Criar grupo"}</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
