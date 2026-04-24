import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

interface EmpresaItem {
  empresa: string
  total: number
}

export function GraficoTopEmpresas({ data }: { data: EmpresaItem[] }) {
  const chartData = (data || []).slice(0, 10)

  return (
    <ChartContainer config={{}} className="h-[360px] w-full !aspect-auto">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 20, bottom: 0 }}>
          <CartesianGrid horizontal={false} className="stroke-muted/30" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="text-[10px] font-bold fill-muted-foreground" />
          <YAxis
            dataKey="empresa"
            type="category"
            tickLine={false}
            axisLine={false}
            width={170}
            className="text-[10px] font-bold fill-muted-foreground"
          />
          <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="total" position="right" className="fill-foreground font-bold" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
