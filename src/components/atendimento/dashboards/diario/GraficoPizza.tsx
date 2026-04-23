"use client"

import {
    Pie,
    PieChart,
    Cell,
    ResponsiveContainer,
    Tooltip,
    TooltipProps
} from "recharts"

/* ============================================================
   PALETA  –  cores distintas por índice
============================================================ */
const PALETTE = [
    "#10b981", // emerald
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#14b8a6", // teal
    "#f97316", // orange
    "#6366f1", // indigo
    "#ec4899", // pink
    "#84cc16", // lime
    "#06b6d4", // cyan
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
    /** Array de salas (especialidade) ou atendentes (recepção) */
    data: ChartItem[]
    /** "recepcao" mostra nome do atendente; "especialidade" mostra sala */
    mode?: "recepcao" | "especialidade"
}

/* ============================================================
   TOOLTIP CUSTOMIZADO
============================================================ */
function CustomTooltip(props: any) {
    const { active, payload } = props;
    if (!active || !payload?.length) return null

    const entry = payload[0]
    const item = entry.payload as ChartItem & {
        isQueue?: boolean
        fill?: string
    }

    if (item.isQueue) {
        return (
            <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="font-black text-slate-300 uppercase tracking-widest mb-1">Fila</p>
                <p className="text-white">
                    <span className="text-slate-400">Aguardando: </span>
                    <span className="font-black text-amber-400">{item.aguardando}</span>
                </p>
            </div>
        )
    }

    const nome = (item as RecepItem).nome
    const isEsp = "ociosidade" in item

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
                <Row label="Atendimentos" value={item.total} color="text-emerald-400" />
                <Row label="Aguardando" value={item.aguardando} color="text-amber-400" />
                {item.tempo_medio !== undefined && item.tempo_medio > 0 && (
                    <Row
                        label="Tempo médio"
                        value={`${item.tempo_medio} min`}
                        color="text-blue-400"
                    />
                )}
                {isEsp && (item as SalaItem).ociosidade !== undefined && (
                    <Row
                        label="Ociosidade"
                        value={`${(item as SalaItem).ociosidade} min`}
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
export function GraficoPizza({ data, mode = "especialidade" }: GraficoPizzaProps) {
    const items = data || []

    // 1. Calculamos os totais para decidir a lógica de exibição
    const totalAtendimentos = items.reduce((acc, i) => acc + (i.total || 0), 0)
    const totalAguardando = items.reduce((acc, i) => acc + (i.aguardando || 0), 0)

    // 2. Se não houver absolutamente nada (nem atendimentos nem fila), exibe "Sem dados"
    if (items.length === 0 || (totalAtendimentos === 0 && totalAguardando === 0)) {
        return (
            <div className="flex flex-col items-center justify-center h-[160px] text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                Sem dados
            </div>
        )
    }

    // 3. Mapeamos os itens ativos (salas ou atendentes)
    const ativas = items.map((item, index) => ({
        ...item,
        fill: getColor(index),
        value: item.total, // O gráfico de pizza usa o total de atendimentos
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
            <div className="h-[150px] w-full">
                <ResponsiveContainer>
                    <PieChart>
                        <Tooltip
                            content={<CustomTooltip />}
                            wrapperStyle={{ zIndex: 50 }}
                        />
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="nome"
                            innerRadius={42}
                            outerRadius={68}
                            paddingAngle={totalAtendimentos === 0 ? 0 : 2}
                            strokeWidth={0}
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={entry.fill}
                                    opacity={"isQueue" in entry && entry.isQueue ? 0.6 : 1}
                                    style={{ cursor: "pointer", outline: "none" }}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* ── LEGENDAS ── */}
            <div className="w-full space-y-1">
                {/* Se houver atendimentos, listamos as salas/atendentes na legenda */}
                {/* {totalAtendimentos > 0 && ativas.map((item, idx) => (
                    <LegendaItem 
                        key={idx} 
                        cor={item.fill} 
                        rotulo={mode === "especialidade" ? `Sala ${item.nome}` : item.nome} 
                        valor={item.total} 
                    />
                ))} */}

                {/* Item fixo: aguardando sempre aparece na legenda */}
                <LegendaItem
                    cor={AGUARDANDO_COLOR}
                    rotulo="Aguardando"
                    valor={totalAguardando}
                    dimmed
                />
                 <LegendaItem
                    cor={AGUARDANDO_COLOR}
                    rotulo="Atendidos"
                    valor={totalAtendimentoEspecialidade}
                    dimmed
                />
            </div>
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
        <div className="w-full flex justify-center gap-1 text-[14px] px-2">
            <div className="flex items-center gap-2 min-w-0">
                {/* <span 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: cor, opacity: dimmed ? 0.6 : 1 }}
                /> */}
                <span className="font-medium text-gray-400 truncate">{rotulo}:</span>
            </div>
            <span className="font-bold">{valor}</span>
        </div>
        
    )
}
