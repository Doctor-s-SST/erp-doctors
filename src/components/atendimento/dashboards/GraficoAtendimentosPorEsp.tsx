import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { chartConfig } from "./chartConfig"


export function GraficoAtendimentosPorEsp({ data }: { data: any[] }) {
  const chartData = data || []

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 30, right: 30 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="nome" 
            type="category" 
            tickLine={false} 
            axisLine={false} 
            className="text-[10px] font-black uppercase fill-foreground"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="total" fill="var(--color-atendimentos)" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="total" position="right" className="fill-foreground font-bold" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}