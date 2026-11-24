"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { supabase } from "@/lib/supabase"
import {
    DndContext,
    closestCenter,
    DragEndEvent,
    DragStartEvent,
    useSensor,
    useSensors,
    PointerSensor,
    DragOverlay,
    useDroppable,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Stethoscope, Activity, Trash2, Loader2, Link2, Columns3, Workflow } from "lucide-react"
import type { ExameFluxo } from "@/components/kanban/FluxoEspecialidades"
import ImportarExames from "@/components/kanban/ImportarExames"

// React Flow mede o DOM: só no navegador.
const FluxoEspecialidades = dynamic(() => import("@/components/kanban/FluxoEspecialidades"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[75vh] items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        </div>
    ),
})

// ================= TYPES =================

type Exame = {
    id: string
    nome: string
    especialidade_id: string
    observacao?: string
    ordem?: number
    // dependencia_id?: string
    // depende_de_exame_id?: string
    obrigatorio_checkbox?: boolean
}

type Especialidade = {
    depende_de_especialidades: string[]
    id: string
    nome: string
    exames: Exame[]
    tempo_finalizacao_segundos?: number
    obrigar_check_exames?: boolean
    tempo_meta_minutos?: number | null
    tolerancia_meta_percentual?: number | null
    finaliza_com_especialidade_id?: string | null
}

// ================= COMPONENTS =================

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1
    }
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    )
}

function DroppableColumn({ id, children }: { id: string, children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({ id })
    return <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[150px]">{children}</div>
}

export default function KanbanExames() {
    const [data, setData] = useState<Especialidade[]>([])
    const [loading, setLoading] = useState(true)
    const [openModal, setOpenModal] = useState(false)
    const [tipoModal, setTipoModal] = useState<"especialidade" | "exame">("exame")

    const [editandoExame, setEditandoExame] = useState<Exame | null>(null)
    const [editandoEspecialidade, setEditandoEspecialidade] = useState<Especialidade | null>(null)
    const [form, setForm] = useState<any>({
        depende_de_especialidades: []
    })
    const [activeExame, setActiveExame] = useState<Exame | null>(null)
    const [unidadeId, setUnidadeId] = useState<string | null>(null);
    const [visao, setVisao] = useState<"kanban" | "fluxo">("kanban");

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const allExames = data.flatMap(esp => esp.exames)

    async function fetchData(currentUnidadeId: string, silencioso = false) { // Recebe o ID como argumento
        if (!silencioso) {
            setLoading(true)
            setData([]);
        }
        const { data: rawData, error: errorExames } = await supabase
            .from("especialidades")
            .select(`
                id, 
                nome, 
            `)
            .select(`id, nome, tempo_finalizacao_segundos, obrigar_check_exames, tempo_meta_minutos, tolerancia_meta_percentual, finaliza_com_especialidade_id, exames (*)`)
            .eq("unidade_id", currentUnidadeId)
            .order('nome', { ascending: true });

        // const { data: depsData, error: errorDeps } = await supabase
        //     .from("exame_dependencias")
        //     .select("*")

        const { data: depsEspecialidades, error: errorDeps } = await supabase
            .from("especialidade_dependencias")
            .select("*")


        if (errorExames || errorDeps) {
            toast.error("Erro ao carregar dados")
            setLoading(false)
            return
        }

        // const ordered = (rawData || []).map((c: any) => ({
        //     ...c,
        //     exames: (c.exames || [])
        //         .map((exame: any) => {
        //             const dep = depsData?.find(d => d.exame_id === exame.id)
        //             return {
        //                 ...exame,
        //                 depende_de_exame_id: dep?.depende_de_exame_id,
        //                 dependencia_id: dep?.id
        //             }
        //         })
        //         .sort((a: Exame, b: Exame) => (a.ordem ?? 0) - (b.ordem ?? 0)),
        // }))

        const ordered = (rawData || []).map((esp: any) => ({
            ...esp,
            depende_de_especialidades:
                depsEspecialidades
                    ?.filter(d => d.especialidade_id === esp.id)
                    .map(d => d.depende_de_especialidade_id) || [],

            exames: (esp.exames || []).sort(
                (a: Exame, b: Exame) => (a.ordem ?? 0) - (b.ordem ?? 0)
            )
        }))

        setData(ordered)
        setLoading(false)
    }

    useEffect(() => {
        const fetchUserContext = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('unidade_id, role')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    const idParaUsar = profile.unidade_id;

                    if (idParaUsar) {
                        setUnidadeId(idParaUsar);
                        fetchData(idParaUsar);
                    }
                }
            }
        };
        fetchUserContext();
    }, []);

    const findColumnByItem = (itemId: string) => data.find((col) => col.exames.some((e) => e.id === itemId))

    function handleDragStart(event: DragStartEvent) {
        const exame = data.flatMap(c => c.exames).find(e => e.id === event.active.id)
        if (exame) setActiveExame(exame)
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        setActiveExame(null)
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const sourceCol = findColumnByItem(activeId)
        const targetCol = data.find((c) => c.id === overId) || findColumnByItem(overId)

        if (!sourceCol || !targetCol) return

        if (sourceCol.id !== targetCol.id) {
            setData(prev => prev.map(col => {
                if (col.id === sourceCol.id) return { ...col, exames: col.exames.filter(e => e.id !== activeId) }
                if (col.id === targetCol.id) return { ...col, exames: [...col.exames, { ...sourceCol.exames.find(e => e.id === activeId)!, especialidade_id: targetCol.id }] }
                return col
            }))
            await supabase.from("exames").update({ especialidade_id: targetCol.id }).eq("id", activeId)
            toast.success("Especialidade alterada")
            return
        }

        const oldIndex = sourceCol.exames.findIndex((e) => e.id === activeId)
        const newIndex = sourceCol.exames.findIndex((e) => e.id === overId)

        if (oldIndex !== newIndex) {
            const newItems = arrayMove(sourceCol.exames, oldIndex, newIndex)
            setData(prev => prev.map(col => col.id === sourceCol.id ? { ...col, exames: newItems } : col))

            const updates = newItems.map((item, idx) =>
                supabase.from("exames").update({ ordem: idx }).eq("id", item.id)
            )
            await Promise.all(updates)
        }
    }

    async function salvar() {
        if (!form.nome?.trim()) {
            toast.error("Informe o nome")
            return
        }

        try {
            if (!unidadeId) {
                toast.error("Unidade não identificada.")
                return
            }

            // ================= ESPECIALIDADE =================
            if (tipoModal === "especialidade") {

                if (!form.tempo_finalizacao_segundos) {
                    toast.error("Informe o tempo de finalização")
                    return
                }

                const metaInformada = form.tempo_meta_minutos !== undefined && form.tempo_meta_minutos !== null && String(form.tempo_meta_minutos).trim() !== ""
                const tempoMeta = metaInformada ? Number(String(form.tempo_meta_minutos).replace(",", ".")) : null
                const tolerancia = form.tolerancia_meta_percentual === undefined || form.tolerancia_meta_percentual === null || String(form.tolerancia_meta_percentual).trim() === ""
                    ? 20
                    : Number(form.tolerancia_meta_percentual)

                if (tempoMeta !== null && (!Number.isFinite(tempoMeta) || tempoMeta <= 0)) {
                    toast.error("A meta de tempo deve ser maior que zero")
                    return
                }

                if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 500) {
                    toast.error("A tolerância deve ser um número inteiro entre 0 e 500")
                    return
                }

                const payloadEspecialidade = {
                    nome: form.nome.toUpperCase(),
                    tempo_finalizacao_segundos: Number(form.tempo_finalizacao_segundos),
                    obrigar_check_exames:
                        form.obrigar_check_exames ?? false,
                    tempo_meta_minutos: tempoMeta,
                    tolerancia_meta_percentual: tolerancia,
                    // Especialidade vinculada: finalizada junto com a escolhida (trigger no banco).
                    finaliza_com_especialidade_id: form.finaliza_com_especialidade_id || null,
                    unidade_id: unidadeId,
                    status: `EM ${form.nome.toUpperCase()}`
                }

                // Uma única gravação: antes havia um update/insert repetido aqui,
                // que criava a especialidade nova em dobro.
                let especialidadeId = editandoEspecialidade?.id;

                if (editandoEspecialidade) {
                    const { error } = await supabase
                        .from("especialidades")
                        .update(payloadEspecialidade)
                        .eq("id", especialidadeId);

                    if (error) throw error;
                } else {
                    const { data: novaEspecialidade, error } = await supabase
                        .from("especialidades")
                        .insert(payloadEspecialidade)
                        .select()
                        .single();

                    if (error) throw error;

                    especialidadeId = novaEspecialidade.id;
                }

                await supabase
                    .from("especialidade_dependencias")
                    .delete()
                    .eq("especialidade_id", especialidadeId);

                if (
                    form.depende_de_especialidades &&
                    form.depende_de_especialidades.length > 0
                ) {
                    await supabase
                        .from("especialidade_dependencias")
                        .insert(
                            form.depende_de_especialidades.map(
                                (depId: string) => ({
                                    especialidade_id: especialidadeId,
                                    depende_de_especialidade_id: depId
                                })
                            )
                        );
                }
            }

            // ================= EXAME =================
            else {

                if (!form.especialidade_id) {
                    toast.error("Selecione a especialidade")
                    return
                }

                const payloadExame = {
                    nome: form.nome.toUpperCase(),
                    especialidade_id: form.especialidade_id,
                    obrigatorio_checkbox:
                        form.obrigatorio_checkbox ?? false
                }

                let exameId = editandoExame?.id

                if (editandoExame) {
                    await supabase
                        .from("exames")
                        .update(payloadExame)
                        .eq("id", exameId)
                } else {
                    const { data: n, error } = await supabase
                        .from("exames")
                        .insert(payloadExame)
                        .select()
                        .single()

                    if (error) throw error

                    exameId = n.id
                }

                // await supabase
                //     .from("exame_dependencias")
                //     .delete()
                //     .eq("exame_id", exameId)

                // if (form.depende_de_exame_id) {
                //     await supabase
                //         .from("exame_dependencias")
                //         .insert({
                //             exame_id: exameId,
                //             depende_de_exame_id: form.depende_de_exame_id
                //         })
                // }
            }

            toast.success("Salvo com sucesso")

            fecharModal()
            fetchData(unidadeId, true)

        } catch (err) {
            console.error(err)
            toast.error("Erro ao salvar")
        }
    }

    async function deletarEspecialidade(id: string) {
        if (!confirm("Excluir especialidade?")) return;

        const especialidade = data.find(e => e.id === id);

        if (especialidade?.exames?.length) {
            toast.error("Remova os exames antes de excluir a especialidade");
            return;
        }

        const { error } = await supabase
            .from("especialidades")
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Erro ao remover especialidade");
            return;
        }

        toast.success("Especialidade removida");

        if (unidadeId) {
            fetchData(unidadeId, true);
        }
    }

    async function deletarExame() {
        // 1. Verificações de segurança
        if (!editandoExame || !confirm("Excluir exame?")) return;

        if (!unidadeId) {
            toast.error("Unidade não identificada");
            return;
        }

        await supabase.from("exames")
            .delete()
            .eq("id", editandoExame.id)

        toast.success("Removido");
        fecharModal();
        fetchData(unidadeId, true);
    }

    function abrirEdicaoEspecialidade(col: Especialidade) {
        setTipoModal("especialidade")
        setEditandoEspecialidade(col)
        setForm({
            nome: col.nome,
            tempo_finalizacao_segundos: col.tempo_finalizacao_segundos || "",
            obrigar_check_exames: col.obrigar_check_exames ?? false,
            tempo_meta_minutos: col.tempo_meta_minutos ?? "",
            tolerancia_meta_percentual: col.tolerancia_meta_percentual ?? 20,
            finaliza_com_especialidade_id: col.finaliza_com_especialidade_id ?? "",
            depende_de_especialidades: col.depende_de_especialidades || []
        })
        setOpenModal(true)
    }

    function abrirEdicaoExame(exame: Exame) {
        setTipoModal("exame")
        setEditandoExame(exame)
        setForm({ ...exame })
        setOpenModal(true)
    }

    function abrirNovaEspecialidade() {
        setTipoModal("especialidade")
        setOpenModal(true)
    }

    function abrirNovoExame(especialidadeId?: string) {
        setTipoModal("exame")
        setForm({ depende_de_especialidades: [], ...(especialidadeId ? { especialidade_id: especialidadeId } : {}) })
        setOpenModal(true)
    }

    async function adicionarDependencia(especialidadeId: string, dependeDeId: string) {
        const { error } = await supabase
            .from("especialidade_dependencias")
            .insert({ especialidade_id: especialidadeId, depende_de_especialidade_id: dependeDeId })
        if (error) {
            toast.error("Erro ao criar a dependência")
            return
        }
        toast.success("Dependência criada")
        if (unidadeId) await fetchData(unidadeId, true)
    }

    async function removerDependencia(especialidadeId: string, dependeDeId: string) {
        const { error } = await supabase
            .from("especialidade_dependencias")
            .delete()
            .eq("especialidade_id", especialidadeId)
            .eq("depende_de_especialidade_id", dependeDeId)
        if (error) {
            toast.error("Erro ao remover a dependência")
            return
        }
        toast.success("Dependência removida")
        if (unidadeId) await fetchData(unidadeId, true)
    }

    const fecharModal = () => {
        setOpenModal(false)
        setEditandoExame(null)
        setEditandoEspecialidade(null)

        setForm({
            depende_de_especialidades: []
        })
    }

    const renderExameCard = (exame: Exame, isOverlay = false) => {
        // Encontra o nome do exame do qual este depende
        // const nomeDependencia = allExames.find(e => e.id === exame.depende_de_exame_id)?.nome

        return (
            <Card className={`border-none bg-white dark:bg-slate-800 shadow-sm transition-all ${!isOverlay ? 'hover:ring-1 ring-emerald-500 cursor-grab' : 'shadow-2xl ring-2 ring-emerald-500 scale-105'}`}>
                <CardContent className="p-3 space-y-2">
                    <div className="font-black text-slate-800 dark:text-slate-100 uppercase text-[12px] leading-tight line-clamp-2">
                        {exame.nome}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                        {/* Dependência Visual ao lado do tempo */}
                        {/* {exame.depende_de_exame_id && (
                            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                <Link2 className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                                <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase truncate max-w-[80px]">
                                    {nomeDependencia || "DEP"}
                                </span>
                            </div>
                        )} */}

                        {/* </div> */}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
    )

    return (
        <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
            <div className="w-full mx-auto space-y-4">
                {/* HEADER */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-3 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 p-1.5 rounded-lg"><Stethoscope className="w-5 h-5 text-emerald-400" /></div>
                        <div>
                            <h1 className="text-lg font-black text-white uppercase leading-none tracking-tight">Fluxo de Exames</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Especialidades/Exames</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-9 items-center rounded-lg border border-gray-700 bg-gray-800 p-0.5" role="group" aria-label="Visualização">
                            {([
                                ["kanban", "Kanban", Columns3],
                                ["fluxo", "Fluxo", Workflow],
                            ] as const).map(([valor, rotulo, Icone]) => (
                                <button
                                    key={valor}
                                    type="button"
                                    onClick={() => setVisao(valor)}
                                    aria-pressed={visao === valor}
                                    className={`flex h-full items-center gap-1.5 rounded-md px-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${visao === valor ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-gray-700"}`}
                                >
                                    <Icone className="h-3.5 w-3.5" />
                                    {rotulo}
                                </button>
                            ))}
                        </div>
                        <ImportarExames
                            especialidades={data}
                            onImportado={() => { if (unidadeId) fetchData(unidadeId, true) }}
                        />
                        <Button onClick={abrirNovaEspecialidade} variant="outline" className="h-9 border-slate-700 text-white text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500">
                            + Especialidade
                        </Button>
                        <Button onClick={() => abrirNovoExame()} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest">
                            + Exame
                        </Button>
                    </div>
                </div>

                {/* FLUXO */}
                {visao === "fluxo" && (
                    <FluxoEspecialidades
                        unidadeId={unidadeId}
                        especialidades={data}
                        onEditarEspecialidade={(id) => {
                            const col = data.find(e => e.id === id)
                            if (col) abrirEdicaoEspecialidade(col)
                        }}
                        onEditarExame={(exame: ExameFluxo) => {
                            const original = data.flatMap(e => e.exames).find(e => e.id === exame.id)
                            if (original) abrirEdicaoExame(original)
                        }}
                        onNovoExame={abrirNovoExame}
                        onAdicionarDependencia={adicionarDependencia}
                        onRemoverDependencia={removerDependencia}
                    />
                )}

                {/* KANBAN BOARD */}
                {visao === "kanban" && (
                <div className="pb-4 scrollbar-hide">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                        <div className="w-full flex gap-4 overflow-x-auto pb-4 items-start custom-scroll justify-center">
                            {data.map((col) => (
                                <div
                                    key={col.id}
                                    className="flex flex-col max-w-[200px] max-h-[70vh] bg-gray-500 dark:bg-gray-900/40 rounded-xl p-2 border border-gray-800 dark:border-gray-600 shrink-0"
                                >
                                    {/* Título Fixo no topo da coluna */}
                                    <div className="flex justify-between items-center mb-3 px-1 shrink-0 gap-2">
                                        <Badge className="h-4 px-2 py-1 text-[12px] bg-white dark:bg-slate-800 text-slate-500 border-none shadow-sm">{col.exames.length}</Badge>
                                        <h2 className="font-black text-slate-900 dark:text-slate-300 uppercase text-[9px] tracking-widest truncate group-hover:text-emerald-500 transition-colors">
                                            <button
                                                type="button"
                                                onClick={() => abrirEdicaoEspecialidade(col)}
                                                className="font-black text-slate-900 dark:text-slate-300 uppercase text-[9px] tracking-widest truncate hover:text-emerald-500 transition-colors"
                                            >
                                                {col.nome}
                                                {col.finaliza_com_especialidade_id && (
                                                    <span className="ml-1 rounded bg-violet-100 px-1 py-0.5 text-[8px] text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                                                        com {data.find(e => e.id === col.finaliza_com_especialidade_id)?.nome ?? "outra"}
                                                    </span>
                                                )}
                                            </button>
                                        </h2>

                                        <button
                                            onClick={() => deletarEspecialidade(col.id)}
                                            className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition"
                                        >
                                            <Trash2 className="w-4.5 h-4.5 bg-white dark:bg-transparent p-0.5 rounded" />
                                        </button>
                                    </div>

                                    {/* Lista de Exames */}
                                    <div className="overflow-y-auto flex-1 custom-scroll px-2 pt-2 pb-4">
                                        <SortableContext items={col.exames.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                            <DroppableColumn id={col.id}>
                                                <div className="flex flex-col gap-2"> {/* Wrapper para garantir espaçamento entre cards */}
                                                    {col.exames.map((exame) => (
                                                        <SortableItem key={exame.id} id={exame.id}>
                                                            <div
                                                                className="" // Pequeno respiro para a borda do card não ser cortada
                                                                onClick={() => abrirEdicaoExame(exame)}
                                                            >
                                                                {renderExameCard(exame)}
                                                            </div>
                                                        </SortableItem>
                                                    ))}
                                                </div>
                                            </DroppableColumn>
                                        </SortableContext>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DragOverlay>
                            {activeExame ? renderExameCard(activeExame, true) : null}
                        </DragOverlay>
                    </DndContext>
                </div>
                )}
            </div>

            {/* MODAL UNIFICADO */}
            <Dialog open={openModal} onOpenChange={fecharModal}>
                <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-none shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
                    <DialogHeader className="space-y-3">
                        <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mx-auto">
                            {tipoModal === "exame" ? <Activity className="w-8 h-8 text-emerald-500" /> : <Stethoscope className="w-8 h-8 text-emerald-500" />}
                        </div>
                        <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
                            {tipoModal === "exame"
                                ? (editandoExame ? "Editar Exame" : "Novo Exame")
                                : (editandoEspecialidade ? "Editar Especialidade" : "Nova Especialidade")}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome</Label>
                            <Input
                                className="h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold uppercase text-xs focus:ring-emerald-500"
                                value={form.nome || ""}
                                onChange={e => setForm({ ...form, nome: e.target.value.toUpperCase() })}
                            />
                        </div>

                        {tipoModal === "especialidade" && (
                            <div className="space-y-5">
                                {/* ATENDIMENTO */}
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                        Atendimento
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                                Contador de finalização (s)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                required
                                                className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs"
                                                value={form.tempo_finalizacao_segundos || ""}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    tempo_finalizacao_segundos: e.target.value,
                                                })} />
                                        </div>
                                        <label className="flex h-11 cursor-pointer items-center gap-2.5 self-end rounded-md border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
                                            <input
                                                type="checkbox"
                                                checked={form.obrigar_check_exames ?? false}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    obrigar_check_exames: e.target.checked
                                                })}
                                                className="h-4 w-4" />
                                            <span className="text-[11px] font-bold uppercase leading-tight">
                                                Exigir checklist dos exames
                                            </span>
                                        </label>
                                    </div>
                                </section>

                                {/* META DE TEMPO */}
                                <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                            Meta de tempo
                                        </h4>
                                        <p className="text-[11px] text-slate-500">Farol da Gestão de Produtividade e alerta de atendimento prolongado.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                                Meta (min)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0.5}
                                                step={0.5}
                                                placeholder="Sem meta"
                                                className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs"
                                                value={form.tempo_meta_minutos ?? ""}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    tempo_meta_minutos: e.target.value,
                                                })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                                Tolerância (%)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={500}
                                                step={1}
                                                className="h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs"
                                                value={form.tolerancia_meta_percentual ?? 20}
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    tolerancia_meta_percentual: e.target.value,
                                                })} />
                                        </div>
                                    </div>
                                </section>

                                {/* ORDEM E VÍNCULO */}
                                <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                        Ordem e vínculo
                                    </h4>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                            Depende de
                                        </Label>
                                        <p className="text-[11px] text-slate-500 ml-1">Só é liberada depois que as especialidades marcadas terminarem.</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {data
                                                .filter(e => e.id !== editandoEspecialidade?.id)
                                                .map(esp => {
                                                    const marcada = (form.depende_de_especialidades || []).includes(esp.id)
                                                    return (
                                                        <button
                                                            key={esp.id}
                                                            type="button"
                                                            aria-pressed={marcada}
                                                            onClick={() => setForm({
                                                                ...form,
                                                                depende_de_especialidades: marcada
                                                                    ? (form.depende_de_especialidades || []).filter((id: string) => id !== esp.id)
                                                                    : [...(form.depende_de_especialidades || []), esp.id]
                                                            })}
                                                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${marcada
                                                                ? "border-emerald-500 bg-emerald-500 text-white"
                                                                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                                }`}
                                                        >
                                                            {esp.nome}
                                                        </button>
                                                    )
                                                })}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                            Finaliza junto com
                                        </Label>
                                        <select
                                            className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                                            value={form.finaliza_com_especialidade_id || ""}
                                            onChange={e => setForm({ ...form, finaliza_com_especialidade_id: e.target.value })}
                                        >
                                            <option value="">Não (especialidade normal)</option>
                                            {data
                                                .filter(esp => esp.id !== editandoEspecialidade?.id && !esp.finaliza_com_especialidade_id)
                                                .map(esp => (
                                                    <option key={esp.id} value={esp.id}>
                                                        {esp.nome}
                                                    </option>
                                                ))}
                                        </select>
                                        <p className="text-[11px] text-slate-500 ml-1">
                                            Não é chamada: finaliza com a especialidade escolhida, mesma sala e profissional. Se o atendimento não tiver essa especialidade, é chamada normalmente.
                                        </p>
                                    </div>
                                </section>
                            </div>
                        )}

                        {tipoModal === "exame" && (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Especialidade</Label>
                                    <select
                                        className="flex h-12 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={form.especialidade_id || ""}
                                        onChange={e => setForm({ ...form, especialidade_id: e.target.value })}
                                    >
                                        <option value="" disabled>SELECIONE UMA ESPECIALIDADE</option>
                                        {data.map(esp => (
                                            <option key={esp.id} value={esp.id}>
                                                {esp.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                        Confirmação obrigatória?
                                    </Label>

                                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer bg-slate-50 dark:bg-slate-800">
                                        <input
                                            type="checkbox"
                                            checked={
                                                form.obrigatorio_checkbox ?? false
                                            }
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    obrigatorio_checkbox:
                                                        e.target.checked
                                                })
                                            }
                                            className="h-5 w-5"
                                        />

                                        <div>
                                            <p className="font-bold text-xs uppercase">
                                                Obrigatório no checklist
                                            </p>

                                            <p className="text-[11px] text-slate-500">
                                                Este exame deve ser marcado
                                                para liberar o botão finalizar
                                            </p>
                                        </div>
                                    </label>
                                </div>
                                {/* <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Depende de qual exame?</Label>
                                    <select
                                        className="flex h-12 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold uppercase"
                                        value={form.depende_de_exame_id || ""}
                                        onChange={e => setForm({ ...form, depende_de_exame_id: e.target.value })}
                                    >
                                        <option value="">NENHUMA DEPENDÊNCIA</option>
                                        {allExames
                                            .filter(e => e.id !== editandoExame?.id)
                                            .map(e => <option key={e.id} value={e.id}>{e.nome}</option>)
                                        }
                                    </select>
                                </div> */}
                            </>
                        )}
                    </div>

                    <div className="space-y-3">
                        {tipoModal === "exame" && editandoExame && (
                            <Button variant="ghost" className="w-full text-rose-500 bg-rose-500/10 font-bold uppercase text-[10px] hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={deletarExame}>
                                <Trash2 className="w-3 h-3 mr-2" /> Excluir Exame
                            </Button>
                        )}
                        <DialogFooter>
                            <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest transition-all" onClick={salvar}>
                                Salvar Alterações
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}