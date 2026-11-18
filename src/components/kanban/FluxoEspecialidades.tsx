"use client"

/**
 * Visualização em fluxo (estilo "rede neural") das especialidades e exames.
 * Mesmos dados e diálogos do Kanban; muda só a forma de ver e algumas interações:
 *
 * - especialidades em camadas, da esquerda para a direita, pela ordem das
 *   dependências (Recepção -> sem dependência -> dependentes);
 * - exames como nós menores ligados à especialidade (podem ser ocultados);
 * - seta animada = "depende de"; puxar uma linha entre duas especialidades cria a
 *   dependência e clicar na seta remove;
 * - linha tracejada lilás = "finaliza junto com" (editado no diálogo);
 * - clicar num nó abre o mesmo diálogo de edição do Kanban; o nó Recepção abre
 *   as configurações da recepção (encaixe e meta de tempo);
 * - os nós podem ser arrastados; a posição fica salva no navegador;
 * - passar o mouse numa especialidade destaca o caminho dela (o que vem antes e
 *   o que vem depois) e apaga o resto.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Background,
    BackgroundVariant,
    Controls,
    Handle,
    MarkerType,
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
import { Activity, Eye, EyeOff, Hourglass, LayoutGrid, Link2, Plus, Settings2, Stethoscope, Timer, UserRound } from "lucide-react"
import { toast } from "sonner"

import {
    CONFIG_RECEPCAO_PADRAO,
    DialogRecepcaoFluxo,
    carregarConfigRecepcao,
    type ConfigRecepcao,
} from "@/components/kanban/DialogRecepcaoFluxo"

export interface ExameFluxo {
    id: string
    nome: string
    especialidade_id: string
    obrigatorio_checkbox?: boolean
}

export interface EspecialidadeFluxo {
    id: string
    nome: string
    exames: ExameFluxo[]
    depende_de_especialidades: string[]
    finaliza_com_especialidade_id?: string | null
    tempo_meta_minutos?: number | null
}

interface Props {
    unidadeId: string | null
    especialidades: EspecialidadeFluxo[]
    onEditarEspecialidade: (id: string) => void
    onEditarExame: (exame: ExameFluxo) => void
    onNovoExame: (especialidadeId: string) => void
    onAdicionarDependencia: (especialidadeId: string, dependeDeId: string) => Promise<void>
    onRemoverDependencia: (especialidadeId: string, dependeDeId: string) => Promise<void>
}

const COR = {
    dependencia: "#10b981",
    vinculo: "#8b5cf6",
    recepcao: "#3b82f6",
    exame: "#94a3b8",
}

const LARGURA_NIVEL_COM_EXAMES = 560
const LARGURA_NIVEL_SEM_EXAMES = 320
const ALTURA_ESPECIALIDADE = 96
const ALTURA_EXAME = 40
const ESPACO_ENTRE = 36

// ---------------------------------------------------------------- nós

type DadosEspecialidade = {
    especialidade: EspecialidadeFluxo
    vinculadaCom?: string
    onEditar: () => void
    onNovoExame: () => void
}

type DadosExame = { exame: ExameFluxo; onEditar: () => void }

type DadosRecepcao = { config: ConfigRecepcao; onEditar: () => void }

function NoRecepcao({ data }: NodeProps<Node<DadosRecepcao>>) {
    const { config, onEditar } = data
    return (
        <button
            type="button"
            onClick={onEditar}
            title="Configurações da recepção"
            className="group w-[200px] rounded-2xl border-2 border-blue-400 bg-blue-50 p-3 text-left shadow-xl shadow-blue-500/20 transition-shadow hover:shadow-blue-500/40 dark:bg-blue-950"
        >
            <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                    <UserRound className="h-4 w-4" />
                </span>
                <span className="flex-1 text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-200">Recepção</span>
                <Settings2 className="h-3.5 w-3.5 text-blue-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="mt-2 flex flex-wrap gap-1">
                <span className="flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    <Timer className="h-2.5 w-2.5" /> encaixe {config.tempo_finalizacao_encaixe_minutos} min
                </span>
                {config.tempo_meta_recepcao_minutos ? (
                    <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        <Hourglass className="h-2.5 w-2.5" /> meta {config.tempo_meta_recepcao_minutos} min
                    </span>
                ) : null}
            </span>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-blue-500" />
        </button>
    )
}

function NoEspecialidade({ data }: NodeProps<Node<DadosEspecialidade>>) {
    const { especialidade, vinculadaCom, onEditar, onNovoExame } = data
    return (
        <div
            className={`group relative w-[220px] rounded-2xl border-2 bg-white p-3 shadow-xl transition-shadow hover:shadow-emerald-500/30 dark:bg-slate-900 ${vinculadaCom ? "border-violet-400" : "border-emerald-400"}`}
        >
            <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500" />
            <button type="button" onClick={onEditar} className="block w-full text-left">
                <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${vinculadaCom ? "bg-violet-100 text-violet-600 dark:bg-violet-500/20" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20"}`}>
                        <Stethoscope className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-black uppercase text-slate-800 dark:text-white">{especialidade.nome}</span>
                        <span className="block text-[10px] text-slate-500">
                            {especialidade.exames.length} {especialidade.exames.length === 1 ? "exame" : "exames"}
                        </span>
                    </span>
                </div>
                <div className="mt-2 flex min-h-[18px] flex-wrap gap-1">
                    {especialidade.tempo_meta_minutos ? (
                        <span className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                            <Hourglass className="h-2.5 w-2.5" /> meta {especialidade.tempo_meta_minutos} min
                        </span>
                    ) : null}
                    {vinculadaCom && (
                        <span className="flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                            <Link2 className="h-2.5 w-2.5" /> com {vinculadaCom}
                        </span>
                    )}
                </div>
            </button>
            <button
                type="button"
                onClick={onNovoExame}
                title="Novo exame nesta especialidade"
                className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-600 opacity-0 shadow transition-opacity hover:bg-emerald-50 group-hover:opacity-100 dark:bg-slate-900"
            >
                <Plus className="h-3 w-3" /> exame
            </button>
            <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-emerald-500" />
        </div>
    )
}

function NoExame({ data }: NodeProps<Node<DadosExame>>) {
    return (
        <button
            type="button"
            onClick={data.onEditar}
            className="flex max-w-[200px] items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1 pl-1 pr-3 shadow-sm transition-colors hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-800"
        >
            <Handle type="target" position={Position.Left} isConnectable={false} className="!h-1.5 !w-1.5 !border-0 !bg-slate-400" />
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700">
                <Activity className="h-3 w-3" />
            </span>
            <span className="truncate text-[10px] font-bold uppercase text-slate-700 dark:text-slate-200">{data.exame.nome}</span>
            {data.exame.obrigatorio_checkbox && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Obrigatório no checklist" />}
        </button>
    )
}

const TIPOS_NO = { recepcao: NoRecepcao, especialidade: NoEspecialidade, exame: NoExame }

// ---------------------------------------------------------------- layout

/** Camada de cada especialidade: 0 sem dependências; depois, 1 + maior camada das dependências. */
function calcularNiveis(especialidades: EspecialidadeFluxo[]): Map<string, number> {
    const porId = new Map(especialidades.map((e) => [e.id, e]))
    const niveis = new Map<string, number>()
    const visitando = new Set<string>()

    const nivel = (id: string): number => {
        if (niveis.has(id)) return niveis.get(id)!
        if (visitando.has(id)) return 0 // ciclo: corta
        visitando.add(id)
        const esp = porId.get(id)
        const deps = (esp?.depende_de_especialidades ?? []).filter((d) => porId.has(d))
        let n = deps.length ? 1 + Math.max(...deps.map(nivel)) : 0
        // Vinculada fica na mesma camada da especialidade com que finaliza.
        if (esp?.finaliza_com_especialidade_id && porId.has(esp.finaliza_com_especialidade_id)) {
            n = Math.max(n, nivel(esp.finaliza_com_especialidade_id))
        }
        visitando.delete(id)
        niveis.set(id, n)
        return n
    }

    especialidades.forEach((e) => nivel(e.id))
    return niveis
}

type Posicoes = Record<string, { x: number; y: number }>

function chavePosicoes(unidadeId: string | null) {
    return `kanban_fluxo_posicoes_${unidadeId ?? "sem-unidade"}`
}

function lerPosicoes(unidadeId: string | null): Posicoes {
    try {
        const salvo = localStorage.getItem(chavePosicoes(unidadeId))
        return salvo ? (JSON.parse(salvo) as Posicoes) : {}
    } catch {
        return {}
    }
}

function salvarPosicoes(unidadeId: string | null, posicoes: Posicoes) {
    try {
        localStorage.setItem(chavePosicoes(unidadeId), JSON.stringify(posicoes))
    } catch {
        // armazenamento indisponível: posição vale só nesta visita
    }
}

/** Depende de `alvo`, direta ou indiretamente? (para não criar ciclo) */
function dependeDe(especialidades: EspecialidadeFluxo[], origem: string, alvo: string): boolean {
    const porId = new Map(especialidades.map((e) => [e.id, e]))
    const pilha = [...(porId.get(origem)?.depende_de_especialidades ?? [])]
    const vistos = new Set<string>()
    while (pilha.length) {
        const id = pilha.pop()!
        if (id === alvo) return true
        if (vistos.has(id)) continue
        vistos.add(id)
        pilha.push(...(porId.get(id)?.depende_de_especialidades ?? []))
    }
    return false
}

/**
 * Caminho de uma especialidade: ela, o que vem antes (dependências, diretas e
 * indiretas, e a especialidade com que finaliza junto) e o que vem depois
 * (quem depende dela e as vinculadas a ela). Inclui a Recepção quando o caminho
 * começa por ela.
 */
function calcularCaminho(especialidades: EspecialidadeFluxo[], foco: string): Set<string> {
    const porId = new Map(especialidades.map((e) => [e.id, e]))
    const caminho = new Set<string>([foco])

    // Antes: dependências e especialidade principal (vínculo).
    const antes = [foco]
    while (antes.length) {
        const esp = porId.get(antes.pop()!)
        if (!esp) continue
        const anteriores = [...esp.depende_de_especialidades]
        if (esp.finaliza_com_especialidade_id) anteriores.push(esp.finaliza_com_especialidade_id)
        for (const id of anteriores) {
            if (porId.has(id) && !caminho.has(id)) {
                caminho.add(id)
                antes.push(id)
            }
        }
    }

    // Depois: quem depende dela e quem finaliza junto com ela.
    const depois = [foco]
    const vistosDepois = new Set<string>([foco])
    while (depois.length) {
        const id = depois.pop()!
        for (const e of especialidades) {
            const segue = e.depende_de_especialidades.includes(id) || e.finaliza_com_especialidade_id === id
            if (segue && !vistosDepois.has(e.id)) {
                vistosDepois.add(e.id)
                caminho.add(e.id)
                depois.push(e.id)
            }
        }
    }

    // Recepção: quando alguma especialidade do caminho começa o fluxo.
    const comecaNaRecepcao = Array.from(caminho).some((id) => {
        const esp = porId.get(id)
        return esp && !esp.depende_de_especialidades.length && !esp.finaliza_com_especialidade_id
    })
    if (comecaNaRecepcao) caminho.add("recepcao")

    return caminho
}

// ---------------------------------------------------------------- componente

export default function FluxoEspecialidades({
    unidadeId,
    especialidades,
    onEditarEspecialidade,
    onEditarExame,
    onNovoExame,
    onAdicionarDependencia,
    onRemoverDependencia,
}: Props) {
    const [mostrarExames, setMostrarExames] = useState(false)
    const [configRecepcao, setConfigRecepcao] = useState<ConfigRecepcao>(CONFIG_RECEPCAO_PADRAO)
    const [recepcaoAberta, setRecepcaoAberta] = useState(false)
    // Especialidade com o mouse em cima (destaque do caminho).
    const [foco, setFoco] = useState<string | null>(null)

    useEffect(() => {
        if (!unidadeId) return
        const timer = setTimeout(() => {
            void carregarConfigRecepcao(unidadeId).then(setConfigRecepcao)
        }, 0)
        return () => clearTimeout(timer)
    }, [unidadeId])
    const [versaoLayout, setVersaoLayout] = useState(0)
    const [escuro] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"))

    const montar = useCallback(() => {
        const salvas = lerPosicoes(unidadeId)
        const niveis = calcularNiveis(especialidades)
        const nomePorId = new Map(especialidades.map((e) => [e.id, e.nome]))
        const larguraNivel = mostrarExames ? LARGURA_NIVEL_COM_EXAMES : LARGURA_NIVEL_SEM_EXAMES

        const nos: Node[] = []
        const arestas: Edge[] = []
        const alturaPorNivel = new Map<number, number>()

        const ordenadas = [...especialidades].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

        for (const esp of ordenadas) {
            const nivel = niveis.get(esp.id) ?? 0
            const altura = ALTURA_ESPECIALIDADE + (mostrarExames ? Math.max(0, esp.exames.length - 2) * ALTURA_EXAME : 0)
            const y = alturaPorNivel.get(nivel) ?? 0
            alturaPorNivel.set(nivel, y + altura + ESPACO_ENTRE)

            const padrao = { x: 280 + nivel * larguraNivel, y }
            const posicao = salvas[esp.id] ?? padrao

            nos.push({
                id: esp.id,
                type: "especialidade",
                position: posicao,
                data: {
                    especialidade: esp,
                    vinculadaCom: esp.finaliza_com_especialidade_id ? nomePorId.get(esp.finaliza_com_especialidade_id) : undefined,
                    onEditar: () => onEditarEspecialidade(esp.id),
                    onNovoExame: () => onNovoExame(esp.id),
                } satisfies DadosEspecialidade,
            })

            if (mostrarExames) {
                esp.exames.forEach((exame, i) => {
                    const idNo = `exame:${exame.id}`
                    nos.push({
                        id: idNo,
                        type: "exame",
                        position: salvas[idNo] ?? { x: posicao.x + 260, y: posicao.y + i * ALTURA_EXAME },
                        data: { exame, onEditar: () => onEditarExame(exame) } satisfies DadosExame,
                    })
                    arestas.push({
                        id: `ex:${esp.id}->${exame.id}`,
                        source: esp.id,
                        target: idNo,
                        deletable: false,
                        selectable: false,
                        style: { stroke: COR.exame, strokeWidth: 1, opacity: 0.6 },
                    })
                })
            }

            // Recepção -> especialidades sem dependência (início do fluxo)
            if (!esp.depende_de_especialidades.length && !esp.finaliza_com_especialidade_id) {
                arestas.push({
                    id: `rec->${esp.id}`,
                    source: "recepcao",
                    target: esp.id,
                    deletable: false,
                    selectable: false,
                    style: { stroke: COR.recepcao, strokeWidth: 1.5, strokeDasharray: "4 4", opacity: 0.6 },
                })
            }

            // Dependências: dependência -> especialidade (clique remove)
            for (const dep of esp.depende_de_especialidades) {
                if (!nomePorId.has(dep)) continue
                arestas.push({
                    id: `dep:${dep}->${esp.id}`,
                    source: dep,
                    target: esp.id,
                    animated: true,
                    deletable: false,
                    data: { tipo: "dependencia", especialidadeId: esp.id, dependeDeId: dep },
                    style: { stroke: COR.dependencia, strokeWidth: 2.5 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: COR.dependencia },
                })
            }

            // Vínculo "finaliza junto com"
            if (esp.finaliza_com_especialidade_id && nomePorId.has(esp.finaliza_com_especialidade_id)) {
                arestas.push({
                    id: `vin:${esp.finaliza_com_especialidade_id}->${esp.id}`,
                    source: esp.finaliza_com_especialidade_id,
                    target: esp.id,
                    deletable: false,
                    label: "finaliza junto",
                    labelStyle: { fill: COR.vinculo, fontSize: 10, fontWeight: 700 },
                    labelBgStyle: { fillOpacity: 0.85 },
                    style: { stroke: COR.vinculo, strokeWidth: 2, strokeDasharray: "6 4" },
                    markerEnd: { type: MarkerType.ArrowClosed, color: COR.vinculo },
                })
            }
        }

        const alturaTotal = Math.max(...Array.from(alturaPorNivel.values()), ALTURA_ESPECIALIDADE)
        nos.push({
            id: "recepcao",
            type: "recepcao",
            position: salvas.recepcao ?? { x: 0, y: Math.max(0, alturaTotal / 2 - 40) },
            data: { config: configRecepcao, onEditar: () => setRecepcaoAberta(true) } satisfies DadosRecepcao,
            deletable: false,
        })

        return { nos, arestas }
    }, [especialidades, mostrarExames, unidadeId, configRecepcao, onEditarEspecialidade, onEditarExame, onNovoExame])

    const inicial = useMemo(() => montar(), [montar])
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(inicial.nos)
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(inicial.arestas)

    // Dados mudaram (salvou no diálogo, ligou dependência, etc.): remonta mantendo posições salvas.
    useEffect(() => {
        const timer = setTimeout(() => {
            const { nos, arestas } = montar()
            setNodes(nos)
            setEdges(arestas)
        }, 0)
        return () => clearTimeout(timer)
    }, [montar, versaoLayout, setNodes, setEdges])

    const caminho = useMemo(
        () => (foco ? calcularCaminho(especialidades, foco) : null),
        [especialidades, foco]
    )

    const nosExibidos = useMemo(() => {
        if (!caminho) return nodes
        return nodes.map((n) => {
            const idBase = n.id.startsWith("exame:")
                ? (n.data as DadosExame).exame.especialidade_id
                : n.id
            // Exames: só os da especialidade em foco ficam acesos.
            const aceso = n.type === "exame" ? idBase === foco : caminho.has(idBase)
            return {
                ...n,
                style: {
                    ...n.style,
                    opacity: aceso ? 1 : 0.15,
                    transition: "opacity 150ms",
                    filter: aceso && n.id === foco ? "drop-shadow(0 0 12px rgba(16,185,129,0.6))" : undefined,
                },
            }
        })
    }, [nodes, caminho, foco])

    const arestasExibidas = useMemo(() => {
        if (!caminho) return edges
        return edges.map((e) => {
            const alvoBase = e.target.startsWith("exame:") ? e.source : e.target
            const acesa = e.target.startsWith("exame:")
                ? e.source === foco
                : caminho.has(e.source) && caminho.has(alvoBase)
            const largura = Number(e.style?.strokeWidth ?? 1)
            return {
                ...e,
                animated: acesa ? e.animated : false,
                style: {
                    ...e.style,
                    opacity: acesa ? 1 : 0.08,
                    strokeWidth: acesa ? largura + 1 : largura,
                    transition: "opacity 150ms",
                },
            }
        })
    }, [edges, caminho, foco])

    const aoEntrarNo = useCallback((_: unknown, no: Node) => {
        if (no.type === "especialidade") setFoco(no.id)
        else if (no.type === "exame") setFoco((no.data as DadosExame).exame.especialidade_id)
    }, [])

    const aoSoltarNo = useCallback(
        (_: unknown, _no: Node, todos: Node[]) => {
            const posicoes = lerPosicoes(unidadeId)
            for (const n of todos) posicoes[n.id] = n.position
            salvarPosicoes(unidadeId, posicoes)
        },
        [unidadeId]
    )

    const conectar = useCallback(
        async (conexao: Connection) => {
            const { source, target } = conexao
            if (!source || !target || source === target) return
            if (source === "recepcao" || source.startsWith("exame:") || target.startsWith("exame:")) return

            const alvo = especialidades.find((e) => e.id === target)
            if (!alvo) return
            if (alvo.depende_de_especialidades.includes(source)) {
                toast.info("Essa dependência já existe.")
                return
            }
            if (dependeDe(especialidades, source, target)) {
                toast.error("Isso criaria um ciclo entre as especialidades.")
                return
            }

            await onAdicionarDependencia(target, source)
        },
        [especialidades, onAdicionarDependencia]
    )

    const clicarAresta = useCallback(
        async (_: unknown, aresta: Edge) => {
            const dados = aresta.data as { tipo?: string; especialidadeId?: string; dependeDeId?: string } | undefined
            if (dados?.tipo !== "dependencia" || !dados.especialidadeId || !dados.dependeDeId) return

            const nome = (id: string) => especialidades.find((e) => e.id === id)?.nome ?? "?"
            if (!confirm(`Remover a dependência: ${nome(dados.especialidadeId)} depende de ${nome(dados.dependeDeId)}?`)) return
            await onRemoverDependencia(dados.especialidadeId, dados.dependeDeId)
        },
        [especialidades, onRemoverDependencia]
    )

    const reorganizar = () => {
        salvarPosicoes(unidadeId, {})
        setVersaoLayout((v) => v + 1)
    }

    return (
        <div className="h-[75vh] w-full overflow-hidden rounded-2xl border border-gray-300 bg-slate-50 dark:border-gray-700 dark:bg-slate-950">
            <ReactFlow
                nodes={nosExibidos}
                edges={arestasExibidas}
                onNodeMouseEnter={aoEntrarNo}
                onNodeMouseLeave={() => setFoco(null)}
                onNodeDragStart={() => setFoco(null)}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={aoSoltarNo}
                onConnect={(c) => void conectar(c)}
                onEdgeClick={(e, a) => void clicarAresta(e, a)}
                nodeTypes={TIPOS_NO}
                fitView
                fitViewOptions={{ padding: 0.2 }}
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
                        no.type === "recepcao"
                            ? COR.recepcao
                            : no.type === "exame"
                                ? COR.exame
                                : (no.data as DadosEspecialidade).vinculadaCom
                                    ? COR.vinculo
                                    : COR.dependencia
                    }
                    maskColor="rgba(148, 163, 184, 0.15)"
                />

                <Panel position="top-left">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/90 p-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-slate-900/90">
                        <button
                            type="button"
                            onClick={() => setMostrarExames((v) => !v)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-gray-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
                        >
                            {mostrarExames ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {mostrarExames ? "Ocultar exames" : "Mostrar exames"}
                        </button>
                        <button
                            type="button"
                            onClick={reorganizar}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-bold uppercase text-slate-600 hover:bg-gray-100 dark:border-gray-700 dark:text-slate-300 dark:hover:bg-gray-800"
                        >
                            <LayoutGrid className="h-3 w-3" /> Reorganizar
                        </button>
                    </div>
                </Panel>

                <Panel position="top-right">
                    <div className="space-y-1 rounded-xl border border-gray-200 bg-white/90 p-2.5 text-[10px] text-slate-600 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-slate-900/90 dark:text-slate-300">
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 rounded bg-emerald-500" /> depende de (puxe uma linha para criar; clique para remover)</p>
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 border-t-2 border-dashed border-violet-500" /> finaliza junto (editar no diálogo)</p>
                        <p className="flex items-center gap-2"><span className="h-0.5 w-6 border-t-2 border-dashed border-blue-500" /> início pela recepção</p>
                        <p className="pt-1 text-slate-400">Passe o mouse numa especialidade para ver o caminho dela.</p>
                    </div>
                </Panel>
            </ReactFlow>

            <DialogRecepcaoFluxo
                unidadeId={unidadeId}
                aberto={recepcaoAberta}
                config={configRecepcao}
                onAbertoChange={setRecepcaoAberta}
                onSalvo={setConfigRecepcao}
            />
        </div>
    )
}
