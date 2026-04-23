import { Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { chartConfig } from "./chartConfig"

export function GraficoTempoMedioEsp({ data }: { data: any[] }) {
  const chartData = data || []

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20 }}>
          <CartesianGrid vertical={false} className="stroke-muted/30" />
          <XAxis 
            dataKey="especialidade" 
            tickLine={false} 
            axisLine={false} 
            className="text-[9px] font-black uppercase fill-muted-foreground"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="media_min" fill="var(--color-tempo)" radius={[4, 4, 0, 0]}>
            <LabelList 
              dataKey="media_min" 
              position="top" 
              className="fill-foreground font-bold" 
              fontSize={10} 
              formatter={(v: any) => `${v}m`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}