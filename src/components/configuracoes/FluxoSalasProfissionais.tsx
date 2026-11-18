"use client"

/**
 * Fluxo de Salas e Profissionais: Profissionais -> Especialidades -> Salas.
 *
 * - profissionais à esquerda (com a jornada); os de recepção ligados ao nó Recepção;
 * - especialidades no meio;
 * - salas à direita, agrupadas por andar;
 * - puxar uma linha liga profissional -> especialidade (profissional_especialidades)
 *   ou especialidade -> sala (sala_especialidades); clicar na linha desvincula;
 * - passar o mouse acende as ligações do cartão; clicar abre a edição na lista;
 * - posições ficam salvas no navegador ("Reorganizar" volta ao automático).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MiniMap,
    Panel,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Clock, DoorOpen, Eye, EyeOff, LayoutGrid, Stethoscope, UserCog, UserRound } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import type { EspecialidadeConfiguracao, ProfissionalConfiguracao, SalaConfiguracao } from "@/app/(admin)/(others-pages)/configuracoes/types"

interface Props {
    unidadeId: string | null
    profissionais: ProfissionalConfiguracao[]
    especialidades: EspecialidadeConfiguracao[]
    salas: SalaConfiguracao[]
    onAtualizar: () => Promise<void> | void
    onEditarProfissional: (profissional: ProfissionalConfiguracao) => void
    onEditarSala: (sala: SalaConfiguracao) => void
}

const COR = {
    profissional: "#10b981",
    sala: "#f97316",
    recepcao: "#3b82f6",
}

const X_PROFISSIONAIS = 0
const X_ESPECIALIDADES = 420
const X_SALAS = 840
const ALTURA_LINHA = 64

// ---------------------------------------------------------------- nós

type DadosProfissional = { profissional: ProfissionalConfiguracao; onEditar: () => void }
type DadosEspecialidade = { especialidade: EspecialidadeConfiguracao; qtdProfissionais: number; qtdSalas: number }
type DadosSala = { sala: SalaConfiguracao; onEditar: () => void }
type DadosAndar = { titulo: string; largura: number; altura: number }

function horario(h?: string | null) {
    return h ? h.slice(0, 5) : null
}

function NoProfissional({ data }: NodeProps<Node<DadosProfissional>>) {
    const { profissional, onEditar } = data
    const jornada = horario(profissional.hora_inicio) && horario(profissional.hora_fim)
        ? `${horario(profissional.hora_inicio)}–${horario(profissional.hora_fim)}`
        : null
    return (
        <button
            type="button"
            onClick={onEditar}
            title="Editar na lista"
            className={`flex w-[200px] items-center gap-2 rounded-xl border-2 bg-white px-2.5 py-2 text-left shadow-lg transition-shadow hover:shadow-emerald-500/30 dark:bg-slate-900 ${profissional.ativo === false ? "border-slate-300 opacity-50" : profissional.recepcao ? "border-blue-300" : "border-emerald-300"}`}
        >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${profissional.recepcao ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"}`}>
                <UserCog className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[11px] font-black uppercase text-slate-800 dark:text-white">{profissional.nome}</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-500">
                    {profissional.ativo === false ? "inativo" : jornada ? <><Clock className="h-2.5 w-2.5" /> {jornada}</> : "sem jornada"}
                </span>
            </span>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500" />
        </button>
    )
}

function NoEspecialidade({ data }: NodeProps<Node<DadosEspecialidade>>) {
    const { especialidade, qtdProfissionais, qtdSalas } = data
    return (
        <div className="w-[200px] rounded-2xl border-2 border-violet-300 bg-white px-3 py-2.5 shadow-xl dark:bg-slate-900">
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500" />
            <span className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                    <Stethoscope className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-[11px] font-black uppercase text-slate-800 dark:text-white">{especialidade.nome}</span>
                    <span className="block text-[9px] text-slate-500">
                        {qtdProfissionais} prof. · {qtdSalas} {qtdSalas === 1 ? "sala" : "salas"}
                    </span>
                </span>
            </span>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-orange-500" />
        </div>
    )
}

function NoRecepcao() {
    return (
        <div className="flex w-[200px] items-center gap-2 rounded-2xl border-2 border-blue-400 bg-blue-50 px-3 py-2.5 shadow-xl dark:bg-blue-950">
            <Handle type="target" position={Position.Left} isConnectable={false} className="!h-3 !w-3 !border-2 !border-white !bg-blue-500" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                <UserRound className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-200">Recepção</span>
        </div>
    )
}

function NoSala({ data }: NodeProps<Node<DadosSala>>) {
    const { sala, onEditar } = data
    return (
        <button
            type="button"
            onClick={onEditar}
            title="Editar na lista"
            className="flex w-[170px] items-center gap-2 rounded-xl border-2 border-orange-300 bg-white px-2.5 py-2 text-left shadow-lg transition-shadow hover:shadow-orange-500/30 dark:bg-slate-900"
        >
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-orange-500" />
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                <DoorOpen className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[11px] font-black uppercase text-slate-800 dark:text-white">Sala {sala.numero}</span>
                <span className="block text-[9px] text-slate-500">
                    {sala.sala_especialidades?.length ?? 0} {(sala.sala_especialidades?.length ?? 0) === 1 ? "especialidade" : "especialidades"}
                </span>
            </span>
        </button>
    )
}

/** Área de fundo de um andar (agrupa as salas). */
function NoAndar({ data }: NodeProps<Node<DadosAndar>>) {
    return (
        <div
            style={{ width: data.largura, height: data.altura }}
            className="rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/20"
        >
            <span className="ml-4 mt-2 inline-block text-[10px] font-black uppercase tracking-widest text-orange-500">{data.titulo}</span>
        </div>
    )
}

const TIPOS_NO = {
    profissional: NoProfissional,
    especialidade: NoEspecialidade,
    recepcao: NoRecepcao,
    sala: NoSala,
    andar: NoAndar,
}

// ---------------------------------------------------------------- posições salvas

type Posicoes = Record<string, { x: number; y: number }>

const chave = (unidadeId: string | null) => `fluxo_salas_profissionais_posicoes_${unidadeId ?? "sem-unidade"}`

function lerPosicoes(unidadeId: string | null): Posicoes {
    try {
        const salvo = localStorage.getItem(chave(unidadeId))
        return salvo ? (JSON.parse(salvo) as Posicoes) : {}
    } catch {
        return {}
    }
}

function salvarPosicoes(unidadeId: string | null, posicoes: Posicoes) {
    try {
        localStorage.setItem(chave(unidadeId), JSON.stringify(posicoes))
    } catch {
        // armazenamento indisponível: posição vale só nesta visita
    }
}

function nomeAndar(andar: number | string | null | undefined) {
    const n = Number(andar ?? 0)
    return !Number.isFinite(n) || n === 0 ? "Térreo" : `${n}º andar`
}

// ---------------------------------------------------------------- componente

export default function FluxoSalasProfissionais({
    unidadeId,
    profissionais,
    especialidades,
    salas,
    onAtualizar,
    onEditarProfissional,
    onEditarSala,
}: Props) {
    const [mostrarInativos, setMostrarInativos] = useState(false)
    const [versaoLayout, setVersaoLayout] = useState(0)
    const [foco, setFoco] = useState<string | null>(null)
    const [escuro] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"))

    const profissionaisVisiveis = useMemo(
        () => profissionais.filter((p) => mostrarInativos || p.ativo !== false),
        [profissionais, mostrarInativos]
    )

    const montar = useCallback(() => {
        const salvas = lerPosicoes(unidadeId)
        const nos: Node[] = []
        const arestas: Edge[] = []

        // Profissionais: recepção primeiro, depois por nome.
        const profs = [...profissionaisVisiveis].sort(
            (a, b) => Number(b.recepcao) - Number(a.recepcao) || a.nome.localeCompare(b.nome, "pt-BR")
        )
        profs.forEach((p, i) => {
            const id = `prof:${p.id}`
            nos.push({
                id,
                type: "profissional",
                position: salvas[id] ?? { x: X_PROFISSIONAIS, y: i * ALTURA_LINHA },
                data: { profissional: p, onEditar: () => onEditarProfissional(p) } satisfies DadosProfissional,
            })

            if (p.recepcao) {
                arestas.push({
                    id: `rec:${p.id}`,
                    source: id,
                    target: "recepcao",
                    deletable: false,
                    style: { stroke: COR.recepcao, strokeWidth: 1.5, strokeDasharray: "5 4" },
                })
            }

            for (const v of p.profissional_especialidades ?? []) {
                arestas.push({
                    id: `pe:${v.id}`,
                    source: id,
                    target: `esp:${v.especialidade_id}`,
                    deletable: false,
                    data: { tipo: "profissional", vinculoId: v.id, profissionalId: p.id, especialidadeId: v.especialidade_id },
                    style: { stroke: COR.profissional, strokeWidth: 1.8 },
                })
            }
        })

        // Recepção e especialidades.
        const temRecepcao = profs.some((p) => p.recepcao)
        if (temRecepcao) {
            nos.push({ id: "recepcao", type: "recepcao", position: salvas.recepcao ?? { x: X_ESPECIALIDADES, y: 0 }, data: {} })
        }
        const desloc = temRecepcao ? 1 : 0
        especialidades.forEach((e, i) => {
            const id = `esp:${e.id}`
            nos.push({
                id,
                type: "especialidade",
                position: salvas[id] ?? { x: X_ESPECIALIDADES, y: (i + desloc) * (ALTURA_LINHA + 10) },
                data: {
                    especialidade: e,
                    qtdProfissionais: profs.filter((p) => p.profissional_especialidades?.some((v) => v.especialidade_id === e.id)).length,
                    qtdSalas: salas.filter((s) => s.sala_especialidades?.some((v) => v.especialidade_id === e.id)).length,
                } satisfies DadosEspecialidade,
            })
        })

        // Salas agrupadas por andar.
        const andares = Array.from(new Set(salas.map((s) => Number(s.andar ?? 0)))).sort((a, b) => a - b)
        let yAndar = 0
        for (const andar of andares) {
            const doAndar = salas
                .filter((s) => Number(s.andar ?? 0) === andar)
                .sort((a, b) => String(a.numero).localeCompare(String(b.numero), "pt-BR", { numeric: true }))
            const altura = 44 + doAndar.length * ALTURA_LINHA
            nos.push({
                id: `andar:${andar}`,
                type: "andar",
                position: { x: X_SALAS - 24, y: yAndar },
                data: { titulo: nomeAndar(andar), largura: 220, altura } satisfies DadosAndar,
                draggable: false,
                selectable: false,
                zIndex: -1,
            })
            doAndar.forEach((s, i) => {
                const id = `sala:${s.id}`
                nos.push({
                    id,
                    type: "sala",
                    position: salvas[id] ?? { x: X_SALAS, y: yAndar + 36 + i * ALTURA_LINHA },
                    data: { sala: s, onEditar: () => onEditarSala(s) } satisfies DadosSala,
                })
                for (const v of s.sala_especialidades ?? []) {
                    arestas.push({
                        id: `se:${v.id}`,
                        source: `esp:${v.especialidade_id}`,
                        target: id,
                        deletable: false,
                        data: { tipo: "sala", vinculoId: v.id, salaId: s.id, especialidadeId: v.especialidade_id },
                        style: { stroke: COR.sala, strokeWidth: 1.8, strokeDasharray: "2 4" },
                    })
                }
            })
            yAndar += altura + 30
        }

        // Ligações para nós ocultos (ex.: profissional inativo) não são desenhadas.
        const ids = new Set(nos.map((n) => n.id))
        return { nos, arestas: arestas.filter((a) => ids.has(a.source) && ids.has(a.target)) }
    }, [unidadeId, profissionaisVisiveis, especialidades, salas, onEditarProfissional, onEditarSala])

    const inicial = useMemo(() => montar(), [montar])
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(inicial.nos)
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(inicial.arestas)

    useEffect(() => {
        const timer = setTimeout(() => {
            const { nos, arestas } = montar()
            setNodes(nos)
            setEdges(arestas)
        }, 0)
        return () => clearTimeout(timer)
    }, [montar, versaoLayout, setNodes, setEdges])

    // Destaque: o cartão em foco e o que está ligado a ele (até a ponta da cadeia).
    const acesos = useMemo(() => {
        if (!foco) return null
        const vizinhos = new Map<string, Set<string>>()
        const ligar = (a: string, b: string) => {
            if (!vizinhos.has(a)) vizinhos.set(a, new Set())
            if (!vizinhos.has(b)) vizinhos.set(b, new Set())
            vizinhos.get(a)!.add(b)
            vizinhos.get(b)!.add(a)
        }
        edges.forEach((e) => ligar(e.source, e.target))

        const resultado = new Set<string>([foco])
        const tipoDe = (id: string) => id.split(":")[0]
        // Profissional/sala: vizinhos diretos (especialidades) e os vizinhos delas do outro lado.
        // Especialidade: vizinhos diretos.
        for (const v of vizinhos.get(foco) ?? []) {
            resultado.add(v)
            if (tipoDe(foco) !== "esp" && tipoDe(v) === "esp") {
                for (const w of vizinhos.get(v) ?? []) {
                    if (tipoDe(w) !== tipoDe(foco)) resultado.add(w)
                }
            }
        }
        return resultado
    }, [foco, edges])

    const nosExibidos = useMemo(() => {
        if (!acesos) return nodes
        return nodes.map((n) =>
            n.type === "andar"
                ? n
                : { ...n, style: { ...n.style, opacity: acesos.has(n.id) ? 1 : 0.15, transition: "opacity 150ms" } }
        )
    }, [nodes, acesos])

    const arestasExibidas = useMemo(() => {
        if (!acesos) return edges
        return edges.map((e) => {
            const acesa = acesos.has(e.source) && acesos.has(e.target)
            return {
                ...e,
                animated: acesa,
                style: { ...e.style, opacity: acesa ? 1 : 0.08, transition: "opacity 150ms" },
            }
        })
    }, [edges, acesos])

    const conectar = useCallback(
        async ({ source, target }: Connection) => {
            if (!source || !target || !unidadeId) return

            if (source.startsWith("prof:") && target.startsWith("esp:")) {
                const profissionalId = source.slice(5)
                const especialidadeId = target.slice(4)
                const prof = profissionais.find((p) => p.id === profissionalId)
                if (prof?.profissional_especialidades?.some((v) => v.especialidade_id === especialidadeId)) {
                    toast.info("Esse profissional já atende essa especialidade.")
                    return
                }
                const { error } = await supabase
                    .from("profissional_especialidades")
                    .insert({ profissional_id: profissionalId, especialidade_id: especialidadeId, unidade_id: unidadeId })
                if (error) return void toast.error("Erro ao vincular o profissional")
                toast.success("Profissional vinculado")
                await onAtualizar()
                return
            }

            if (source.startsWith("esp:") && target.startsWith("sala:")) {
                const especialidadeId = source.slice(4)
                const salaId = target.slice(5)
                const sala = salas.find((s) => s.id === salaId)
                if (sala?.sala_especialidades?.some((v) => v.especialidade_id === especialidadeId)) {
                    toast.info("Essa sala já atende essa especialidade.")
                    return
                }
                const { error } = await supabase
                    .from("sala_especialidades")
                    .insert({ sala_id: salaId, especialidade_id: especialidadeId, unidade_id: unidadeId })
                if (error) return void toast.error("Erro ao vincular a sala")
                toast.success("Sala vinculada")
                await onAtualizar()
                return
            }

            toast.info("Ligue um profissional a uma especialidade, ou uma especialidade a uma sala.")
        },
        [unidadeId, profissionais, salas, onAtualizar]
    )

    const clicarAresta = useCallback(
        async (_: unknown, aresta: Edge) => {
            const dados = aresta.data as { tipo?: string; vinculoId?: string; profissionalId?: string; salaId?: string; especialidadeId?: string } | undefined
            if (!dados?.vinculoId) return
            const nomeEsp = especialidades.find((e) => e.id === dados.especialidadeId)?.nome ?? "?"

            if (dados.tipo === "profissional") {
                const nomeProf = profissionais.find((p) => p.id === dados.profissionalId)?.nome ?? "?"
                if (!confirm(`Desvincular ${nomeProf} de ${nomeEsp}?`)) return
                const { error } = await supabase.from("profissional_especialidades").delete().eq("id", dados.vinculoId)
                if (error) return void toast.error("Erro ao desvincular o profissional")
            } else if (dados.tipo === "sala") {
                const numero = salas.find((s) => s.id === dados.salaId)?.numero ?? "?"
                if (!confirm(`Desvincular a sala ${numero} de ${nomeEsp}?`)) return
                const { error } = await supabase.from("sala_especialidades").delete().eq("id", dados.vinculoId)
                if (error) return void toast.error("Erro ao desvincular a sala")
            } else {
                return
            }

            toast.success("Vínculo removido")
            await onAtualizar()
        },
        [especialidades, profissionais, salas, onAtualizar]
    )

    const aoSoltarNo = useCallback(
        (_: unknown, _no: Node, todos: Node[]) => {
            const posicoes = lerPosicoes(unidadeId)
            for (const n of todos) if (n.type !== "andar") posicoes[n.id] = n.position
            salvarPosicoes(unidadeId, posicoes)
        },
        [unidadeId]
    )

    return (
        <div className="h-[75vh] w-full overflow-hidden rounded-2xl border border-gray-300 bg-slate-50 dark:border-gray-700 dark:bg-slate-950">
            <ReactFlow
                nodes={nosExibidos}
                edges={arestasExibidas}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={aoSoltarNo}
                onNodeDragStart={() => setFoco(null)}
                onNodeMouseEnter={(_, no) => no.type !== "andar" && setFoco(no.id)}
                onNodeMouseLeave={() => setFoco(null)}
                onConnect={(c) => void conectar(c)}
                onEdgeClick={(e, a) => void clicarAresta(e, a)}
                nodeTypes={TIPOS_NO}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.2}
                deleteKeyCode={null}
                forceColorMode={escuro ? "dark" : "light"}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
                <Controls showInteractive={false} />
                <MiniMap
                    pannable
                    zoomable
                    nodeStrokeWidth={3}
                    nodeColor={(no) =>
                        no.type === "profissional" ? COR.profissional : no.type === "sala" ? COR.sala : no.type === "recepcao" ? COR.recepcao : no.type === "andar" ? "transparent" : "#8b5cf6"
                    }
                    maskColor="rgba(148, 163, 184, 0.15)"
                />

                <Panel position="top-left">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/90 p-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-slate-900/90">
                        <button
                            type="button"
                            onClick={() => setMostrarInativos((v) => !v)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-gray-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
                        >
                            {mostrarInativos ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {mostrarInativos ? "Ocultar inativos" : "Mostrar inativos"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                salvarPosicoes(unidadeId, {})
                                setVersaoLayout((v) => v + 1)
                            }}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-gray-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
                        >
                            <LayoutGrid className="h-3 w-3" /> Reorganizar
                        </button>
                    </div>
                </Panel>

                <Panel position="top-right">
                    <div className="space-y-1 rounded-xl border border-gray-200 bg-white/90 p-2.5 text-[10px] text-slate-600 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-slate-900/90 dark:text-slate-300">
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 rounded bg-emerald-500" /> profissional atende a especialidade</p>
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 border-t-2 border-dotted border-orange-500" /> especialidade usa a sala</p>
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 border-t-2 border-dashed border-blue-500" /> profissional da recepção</p>
                        <p className="pt-1 text-slate-400">Puxe uma linha para vincular; clique na linha para desvincular.</p>
                        <p className="text-slate-400">Clique num profissional ou sala para editar na lista.</p>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    )
}
