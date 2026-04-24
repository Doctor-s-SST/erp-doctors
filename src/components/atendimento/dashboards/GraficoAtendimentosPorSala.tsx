import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

interface SalaPorEspecialidadeItem {
  sala: string
  especialidade: string
  total: number
}

export function GraficoAtendimentosPorSala({ data }: { data: SalaPorEspecialidadeItem[] }) {
  const chartData = data || []
  const dynamicHeight = Math.max(360, chartData.length * 34)

  return (
    <ChartContainer config={{}} className="w-full !aspect-auto" style={{ height: dynamicHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 10, bottom: 0 }}>
          <CartesianGrid horizontal={false} className="stroke-muted/30" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="text-[10px] font-bold fill-muted-foreground" />
          <YAxis
            dataKey="sala"
            type="category"
            width={220}
            tickLine={false}
            axisLine={false}
            interval={0}
            className="text-[10px] font-bold fill-muted-foreground"
          />
          <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="total" position="right" className="fill-foreground font-bold" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
