import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"]

interface RecepcaoItem {
  nome: string
  total: number
  aguardando: number
  tempo_medio: number
}

export function GraficoAtendimentosPorRecep({ data }: { data: RecepcaoItem[] }) {
  const chartData = data || []

  return (
    <ChartContainer config={{}} className="h-[340px] w-full !aspect-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={chartData}
            dataKey="total"
            nameKey="nome"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            labelLine={false}
            label={({ value }) => `${value ?? 0}`}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-background hover:opacity-80 transition-opacity" />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-1 gap-2 px-3 pb-1">
        {chartData.map((item, index) => (
          <div key={item.nome} className="text-xs text-center text-slate-700 dark:text-slate-300 font-semibold leading-tight">
            <span style={{ color: COLORS[index % COLORS.length] }}>{item.nome}: </span>
            <span className="text-foreground font-bold">{item.total}</span>
            <span className="text-slate-500"> ({item.tempo_medio ?? 0}m)</span>
          </div>
        ))}
      </div>
    </ChartContainer>
  )
}