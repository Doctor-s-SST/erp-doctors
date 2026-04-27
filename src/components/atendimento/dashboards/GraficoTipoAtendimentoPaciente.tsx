import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

interface TipoAtendimentoItem {
  tipo: string
  total: number
}

const COLORS = ["#10b981", "#f59e0b"]

export function GraficoTipoAtendimentoPaciente({ data }: { data: TipoAtendimentoItem[] }) {
  const chartData = data || []
  const total = chartData.reduce((acc, item) => acc + item.total, 0)

  if (total === 0) {
    return <div className="h-[260px] flex items-center justify-center text-xs uppercase tracking-widest text-gray-500">Sem dados</div>
  }

  return (
    <ChartContainer config={{}} className="h-[360px] w-full !aspect-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="total"
            nameKey="tipo"
            innerRadius={64}
            outerRadius={92}
            paddingAngle={4}
            labelLine={false}
            label={({ value }) => `${value}`}
          >
            {chartData.map((item, index) => (
              <Cell key={`${item.tipo}-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 px-4 pb-3">
        {chartData.map((item, index) => (
          <div key={item.tipo} className="text-sm text-slate-700 dark:text-slate-300 font-semibold text-center break-words">
            <span style={{ color: COLORS[index % COLORS.length] }}>{item.tipo}: </span>
            <span className="text-foreground font-bold">{item.total}</span>
          </div>
        ))}
      </div>
    </ChartContainer>
  )
}
