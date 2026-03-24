"use client"

import { useEffect, useMemo, useState } from "react"
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
    useDroppable
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

// ================= TYPES =================

type Exame = {
    id: string
    nome: string
    especialidade_id: string
    tempo_execucao_segundos: number
    observacao?: string
    ordem?: number
    dependencia_id?: string | null
}

type Especialidade = {
    id: string
    nome: string
    exames: Exame[]
}

// ================= DRAG ITEM =================

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = { transform: CSS.Transform.toString(transform), transition }
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <div className={`transition-shadow ${isDragging ? "shadow-2xl" : ""}`}>
                {children}
            </div>
        </div>
    )
}

function getColorTempo(segundos: number) {
    if (segundos <= 120) return "bg-green-500 text-white"
    if (segundos <= 300) return "bg-yellow-500 text-white"
    return "bg-red-500 text-white"
}

export default function KanbanExames() {
    const [data, setData] = useState<Especialidade[]>([])
    const [loading, setLoading] = useState(true)

    const [openModal, setOpenModal] = useState(false)
    const [tipoModal, setTipoModal] = useState<"especialidade" | "exame">("exame")
    const [editandoEspecialidade, setEditandoEspecialidade] = useState<string | null>(null)
    const [editandoExame, setEditandoExame] = useState<Exame | null>(null)

    const [form, setForm] = useState<any>({})
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    async function fetchData() {
        const { data, error } = await supabase
            .from("especialidades")
            .select(`
                    id,
                    nome,
                    exames (
                    *,
                    exame_dependencias!exame_dependencias_exame_id_fkey (
                        depende_de_exame_id
                    )
                    )
                `)

        if (error) {
            console.error(error)
            toast.error("Erro ao carregar")
            return
        }

        // ordenar por ordem
        const ordered = (data || []).map((c: any) => ({
            ...c,
            exames: (c.exames || []).map((e: any) => ({
                ...e,
                dependencia_id: e.exame_dependencias?.[0]?.depende_de_exame_id || null
            })).sort((a: Exame, b: Exame) => (a.ordem ?? 0) - (b.ordem ?? 0)),
        }))

        setData(ordered)
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    // helpers
    const findColumnByItem = (itemId: string) => {
        return data.find((col) => col.exames.some((e) => e.id === itemId))
    }

    const getExameById = (id: string | null) => {
        if (!id) return null
        for (const col of data) {
            const e = col.exames.find((x) => x.id === id)
            if (e) return e
        }
        return null
    }

    // ================= DRAG =================

    function handleDragStart(e: DragStartEvent) {
        setActiveId(e.active.id as string)
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        setActiveId(null)
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const sourceCol = findColumnByItem(activeId)
        const targetCol = data.find((c) => c.id === overId) || findColumnByItem(overId)

        if (!sourceCol || !targetCol) return

        // mover entre colunas
        if (sourceCol.id !== targetCol.id) {
            await supabase.from("exames").update({ especialidade_id: targetCol.id }).eq("id", activeId)
            toast.success("Movido de coluna")
            return fetchData()
        }

        // reorder na mesma coluna
        const oldIndex = sourceCol.exames.findIndex((e) => e.id === activeId)
        const newIndex = sourceCol.exames.findIndex((e) => e.id === overId)

        if (oldIndex !== newIndex) {
            const newItems = arrayMove(sourceCol.exames, oldIndex, newIndex)

            // persistir ordem
            await Promise.all(
                newItems.map((item, idx) =>
                    supabase.from("exames").update({ ordem: idx }).eq("id", item.id)
                )
            )

            toast.success("Ordem atualizada")
            fetchData()
        }
    }

    // ================= CRUD =================

    async function salvar() {
        if (tipoModal === "especialidade") {
            if (editandoEspecialidade) {
                await supabase.from("especialidades").update({ nome: form.nome }).eq("id", editandoEspecialidade)
                toast.success("Atualizado")
            } else {
                await supabase.from("especialidades").insert({ nome: form.nome })
                toast.success("Criado")
            }
        }

        if (tipoModal === "exame") {
            if (tipoModal === "exame" && editandoExame) {
                await supabase
                    .from("exames")
                    .update({
                        nome: form.nome,
                        especialidade_id: form.especialidade_id,
                        tempo_execucao_segundos: Number(form.tempo),
                        observacao: form.observacao,
                    })
                    .eq("id", editandoExame.id)

                // dependência (simplificado: 1 dependência)
                if (form.dependencia) {
                    await supabase.from("exame_dependencias").delete().eq("exame_id", editandoExame.id)
                    await supabase.from("exame_dependencias").insert({
                        exame_id: editandoExame.id,
                        depende_de_exame_id: form.dependencia,
                    })
                }

                toast.success("Exame atualizado")
            } else {
                const { data: novo } = await supabase
                    .from("exames")
                    .insert({
                        nome: form.nome,
                        especialidade_id: form.especialidade_id,
                        tempo_execucao_segundos: Number(form.tempo),
                        observacao: form.observacao,
                    })
                    .select()
                    .single()

                if (form.dependencia) {
                    await supabase.from("exame_dependencias").insert({
                        exame_id: novo.id,
                        depende_de_exame_id: form.dependencia,
                    })
                }

                toast.success("Exame criado")
            }
        }

        setOpenModal(false)
        setEditandoEspecialidade(null)
        setEditandoExame(null)
        setForm({})
        fetchData()
    }

    async function deletarExame(id: string) {
        await supabase.from("exames").delete().eq("id", id)
        toast.success("Excluído")
        fetchData()
    }

    if (loading) return <div className="p-6">Carregando...</div>

    function DroppableColumn({ id, children }: any) {
        const { setNodeRef } = useDroppable({ id })

        return (
            <div ref={setNodeRef}>
                {children}
            </div>
        )
    }

    return (
        <>
            {/* HEADER */}
            <div className="p-6">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 flex flex-col md:flex-row justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold">KANBAN - Especialidades e Exames</h1>
                        <p className="text-sm text-gray-500">Unidade: (não definida)</p>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => {
                            setTipoModal("especialidade")

                            setEditandoEspecialidade(null)
                            setForm({})

                            setOpenModal(true)
                        }}>+ Especialidade</Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setTipoModal("exame")
                                setEditandoExame(null)
                                setForm({})

                                setOpenModal(true)
                            }}
                        >
                            + Exame
                        </Button>
                    </div>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto px-6 pb-6">
                    {data.map((col) => (
                        <DroppableColumn key={col.id} id={col.id}>
                            <div className="w-80 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 shadow">
                                <div className="flex justify-between items-center mb-4 cursor-pointer"
                                    onClick={() => {
                                        setTipoModal("especialidade")
                                        setEditandoEspecialidade(col.id)
                                        setForm({ nome: col.nome })
                                        setOpenModal(true)
                                    }}>
                                    <h2 className="font-bold text-lg">{col.nome}</h2>
                                    <span className="text-xs text-gray-400">editar</span>
                                </div>

                                <SortableContext items={col.exames.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                                    <div className="flex flex-col gap-3 min-h-[50px]">
                                        {col.exames.map((exame) => (
                                            <SortableItem key={exame.id} id={exame.id}>
                                                <Card
                                                    className="cursor-grab active:cursor-grabbing hover:shadow-lg transition"
                                                    onClick={() => {
                                                        setTipoModal("exame")
                                                        setEditandoExame(exame)
                                                        setForm({
                                                            nome: exame.nome,
                                                            especialidade_id: exame.especialidade_id,
                                                            tempo: exame.tempo_execucao_segundos,
                                                            observacao: exame.observacao,
                                                        })
                                                        setOpenModal(true)
                                                    }}
                                                >
                                                    <CardContent className="px-3 flex flex-col gap-2">
                                                        <div className="font-semibold">{exame.nome}</div>

                                                        <div className="flex gap-2 mt-2 flex-wrap">
                                                            <Badge className={getColorTempo(exame.tempo_execucao_segundos)}>
                                                                ⏱ {exame.tempo_execucao_segundos}s
                                                            </Badge>
                                                        </div>

                                                        {exame.dependencia_id && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Depende de {getExameById(exame.dependencia_id)?.nome || "exame desconhecido"}
                                                            </Badge>
                                                        )}

                                                        {exame.observacao && (
                                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                                {exame.observacao}
                                                            </p>
                                                        )}

                                                        <div className="flex justify-end mt-2">
                                                            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deletarExame(exame.id) }}>
                                                                Excluir
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </SortableItem>
                                        ))}
                                    </div>
                                </SortableContext>
                            </div>
                        </DroppableColumn>
                    ))}
                </div>

                <DragOverlay>
                    {activeId ? (
                        <Card className="shadow-2xl">
                            <CardContent className="p-3">{getExameById(activeId)?.nome}</CardContent>
                        </Card>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* MODAL */}
            <Dialog
                open={openModal}
                onOpenChange={(open) => {
                    setOpenModal(open)

                    if (!open) {
                        setEditandoExame(null)
                        setEditandoEspecialidade(null)
                        setForm({})
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {tipoModal === "especialidade"
                                ? editandoEspecialidade ? "Editar Especialidade" : "Nova Especialidade"
                                : editandoExame ? "Editar Exame" : "Novo Exame"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 min-h-[80px]">
                        <Input placeholder="Nome" value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />

                        {tipoModal === "exame" && (
                            <>
                                <select className="border rounded p-2" value={form.especialidade_id || ""}
                                    onChange={(e) => setForm({ ...form, especialidade_id: e.target.value })}>
                                    <option value="">Selecione especialidade</option>
                                    {data.map((e) => (
                                        <option key={e.id} value={e.id}>{e.nome}</option>
                                    ))}
                                </select>

                                <Input placeholder="Tempo estimado (s)" value={form.tempo || ""}
                                    onChange={(e) => setForm({ ...form, tempo: e.target.value })} />

                                <Textarea placeholder="Observação" value={form.observacao || ""}
                                    onChange={(e) => setForm({ ...form, observacao: e.target.value })} />

                                <select className="border rounded p-2"
                                    onChange={(e) => setForm({ ...form, dependencia: e.target.value })}>
                                    <option value="">Dependência (opcional)</option>
                                    {data.flatMap((c) => c.exames).map((e) => (
                                        <option key={e.id} value={e.id}>{e.nome}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        <Button onClick={salvar}>Salvar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
