"use client"

import { Badge } from "@/components/ui/badge"
import {
    Pie,
    PieChart,
    Cell,
    ResponsiveContainer,
    Tooltip,
    TooltipProps,
    Label
} from "recharts"

/* ============================================================
   PALETA  –  cores distintas por índice
============================================================ */
const PALETTE = [
    "#10b981", // emerald
    "#f97316", // orange
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#6366f1", // indigo
    // "#8b5cf6", // violet
    // "#14b8a6", // teal
    // "#ec4899", // pink
    // "#84cc16", // lime
    // "#06b6d4", // cyan
]

const AGUARDANDO_COLOR = "#64748b" // slate-500

function getColor(index: number): string {
    return PALETTE[index % PALETTE.length]
}

/* ============================================================
   TIPOS
============================================================ */
interface SalaItem {
    nome: string
    total: number
    aguardando: number
    tempo_medio?: number
    ociosidade?: number
}

interface RecepItem {
    nome: string
    total: number
    aguardando: number
    tempo_medio?: number
}

type ChartItem = SalaItem | RecepItem

interface GraficoPizzaProps {
    data: ChartItem[]
    mode?: "recepcao" | "especialidade" | "recepcaoGeral"
    aguardandoExterno?: number
}

function formatarTempo(minutos?: number) {
    if (!minutos || minutos <= 0) {
        return "0min 00seg"
    }

    const totalSegundos = Math.round(minutos * 60)

    const horas = Math.floor(totalSegundos / 3600)
    const mins = Math.floor((totalSegundos % 3600) / 60)
    const segs = totalSegundos % 60

    // sempre mostra min + seg
    if (horas > 0) {
        return `${horas}h ${mins.toString().padStart(2, "0")}min ${segs
            .toString()
            .padStart(2, "0")}seg`
    }

    return `${mins}min ${segs.toString().padStart(2, "0")}seg`
}

/* ============================================================
   TOOLTIP CUSTOMIZADO
============================================================ */
function CustomTooltip(props: any) {
    const { active, payload } = props;

    if (!active || !payload?.length) return null;

    const entry = payload[0];
    const item = entry.payload as ChartItem & {
        isQueue?: boolean
        fill?: string
        totalGeral?: number
    }

    if (item.isQueue) {
        return (
            <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="font-black text-slate-300 uppercase tracking-widest mb-1">
                    Fila
                </p>

                <p className="text-white">
                    <span className="text-slate-400">Aguardando: </span>
                    <span className="font-black text-amber-400">
                        {item.aguardando}
                    </span>
                </p>
            </div>
        )
    }

    const nome = (item as RecepItem).nome
    const isEsp = "ociosidade" in item

    const porcentagem =
        item.totalGeral && item.totalGeral > 0
            ? ((item.total / item.totalGeral) * 100).toFixed(2)
            : "0"

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl min-w-[160px]">

            {/* header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: item.fill || "#10b981" }}
                />

                <p className="font-black text-white uppercase tracking-wider truncate">
                    {isEsp ? `Sala ${nome}` : nome}
                </p>
            </div>

            {/* métricas */}
            <div className="space-y-1">

                <Row
                    label="Atendidos"
                    value={`${porcentagem}%`}
                    color="text-emerald-400"
                />

                <Row
                    label="Aguardando"
                    value={item.aguardando}
                    color="text-amber-400"
                />

                {item.tempo_medio !== undefined && item.tempo_medio > 0 && (
                    <Row
                        label="Tempo médio"
                        value={formatarTempo(item.tempo_medio)}
                        color="text-blue-400"
                    />
                )}

                {isEsp && (item as SalaItem).ociosidade !== undefined && (
                    <Row
                        label="Ociosidade"
                        value={formatarTempo((item as SalaItem).ociosidade)}
                        color="text-slate-400"
                    />
                )}
            </div>
        </div>
    )
}

function Row({
    label,
    value,
    color,
}: {
    label: string
    value: string | number
    color: string
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-gray-400">{label}</span>
            <span className={`font-black ${color}`}>{value}</span>
        </div>
    )
}

/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */
export function GraficoPizza({ data, mode = "especialidade", aguardandoExterno = 0 }: GraficoPizzaProps) {
    const items = Array.isArray(data) ? data : []

    // 1. Calculamos os totais para decidir a lógica de exibição
    const totalAtendimentos = items.reduce((acc, i) => acc + (i.total || 0), 0)
    const totalAguardando =
        aguardandoExterno > 0
            ? aguardandoExterno
            : (items[0]?.aguardando || 0)

    // 2. Se não houver absolutamente nada (nem atendimentos nem fila), exibe "Sem dados"
    if (items.length === 0 || (totalAtendimentos === 0 && totalAguardando === 0)) {
        return (
            <div className="flex flex-col items-center justify-center h-[160px] text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                Sem dados
            </div>
        )
    }

    // 3. Mapeamos os itens ativos (salas ou atendentes)
    const totalGeral = items.reduce(
        (acc, item) => acc + (item.total || 0),
        0
    )

    const ativas = items.map((item, index) => ({
        ...item,
        fill: getColor(index),
        value: item.total,
        totalGeral,
    }))

    // 4. Lógica solicitada: Se não houver atendimentos, a fila vira uma fatia visível
    // Caso contrário, ela tem valor 0 (fica invisível no gráfico, mas existe nos dados)
    const fatiaFila = {
        nome: "Aguardando",
        total: 0,
        aguardando: totalAguardando,
        // Se totalAtendimentos for 0, usamos o totalAguardando para dar corpo ao gráfico
        value: totalAtendimentos === 0 ? totalAguardando : 0,
        fill: AGUARDANDO_COLOR,
        isQueue: true,
    }

    const chartData = [...ativas, fatiaFila]

    const totalAtendimentoEspecialidade = items.reduce((acc, i) => acc + (i.total || 0), 0)

    return (
        <div className="flex flex-col items-center gap-3 w-full">
            {/* ── DONUT ── */}
            <div className="h-70 w-full">
                <ResponsiveContainer>
                    <PieChart>
                        <Tooltip
                            content={<CustomTooltip />}
                            wrapperStyle={{ zIndex: 50 }}
                        />

                        <Pie
                            data={chartData}
                            isAnimationActive={false}
                            dataKey="value"
                            nameKey="nome"
                            innerRadius={52}
                            outerRadius={80}
                            paddingAngle={totalAtendimentos === 0 ? 0 : 2}
                            strokeWidth={0}

                            /* LABEL EXTERNA */
                            label={(props: any) => {
                                const {
                                    cx,
                                    cy,
                                    midAngle,
                                    outerRadius,
                                    payload,
                                } = props

                                const item = payload

                                // remove aguardando das labels
                                if (item.isQueue) return null

                                const RADIAN = Math.PI / 180

                                // distância da label pra fora do donut
                                const radius = outerRadius + 30

                                const x = cx + radius * Math.cos(-midAngle * RADIAN)
                                const y = cy + radius * Math.sin(-midAngle * RADIAN)

                                const nome =
                                    mode === "especialidade"
                                        ? `Sala ${item.nome}`
                                        : item.nome

                                return (
                                    <g>
                                        {item.total !== 0 && (
                                            <text
                                                x={x}
                                                y={y}
                                                textAnchor="middle"
                                                fill={item.fill}
                                                className="font-bold"
                                            >
                                                <tspan
                                                    x={x}
                                                    dy={0}
                                                    className="text-[11px]"
                                                >
                                                    {mode === "especialidade" ? nome : nome.split(" ")[0]}
                                                </tspan>

                                                <tspan
                                                    x={x}
                                                    dy={15}
                                                    className="text-[12px] font-black"
                                                >
                                                    {item.total}
                                                </tspan>
                                            </text>
                                        )}
                                    </g>
                                )
                            }}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={entry.fill}
                                    opacity={"isQueue" in entry && entry.isQueue ? 0.6 : 1}
                                    style={{ cursor: "pointer", outline: "none" }}
                                />
                            ))}

                            {/* TOTAL CENTRAL */}
                            <Label
                                content={({ viewBox }: any) => {
                                    const { cx, cy } = viewBox

                                    return (
                                        <g>
                                            <text
                                                x={cx}
                                                y={cy}
                                                textAnchor="middle"
                                                className="fill-gray-500 dark:fill-gray-400 text-[20px] font-black"
                                            >
                                                {totalAtendimentos}
                                            </text>

                                            <text
                                                x={cx}
                                                y={cy + 16}
                                                textAnchor="middle"
                                                className="fill-gray-500 dark:fill-gray-400 text-[11px] uppercase tracking-widest font-bold"
                                            >
                                                atendidos
                                            </text>
                                        </g>
                                    )
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* ── LEGENDAS ── */}
            {mode !== "recepcaoGeral" && (
                <LegendaItem
                    cor={AGUARDANDO_COLOR}
                    rotulo="Aguardando"
                    valor={totalAguardando}
                    dimmed
                />)
            }
        </div>
    )
}

function LegendaItem({
    cor,
    rotulo,
    valor,
    dimmed = false,
}: {
    cor: string
    rotulo: string
    valor: number
    dimmed?: boolean
}) {
    return (
        <div className="w-full flex justify-center gap-1 text-[14px] px-2 mt-5">
            <Badge className="flex items-center gap-2 min-w-0 bg-amber-400 text-gray-800">
                <span className="font-bold truncate">{rotulo}:</span>
                <span className="font-bold truncate">{valor}</span>
            </Badge>
        </div>
    )
}
