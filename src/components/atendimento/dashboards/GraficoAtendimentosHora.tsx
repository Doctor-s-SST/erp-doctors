import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { chartConfig } from "./chartConfig"

export function GraficoAtendimentosHora({ data }: { data: any[] }) {
  const chartData = data || []

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="fillAtendimentos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-atendimentos)" stopOpacity={1}/>
              <stop offset="95%" stopColor="var(--color-atendimentos)" stopOpacity={1}/>
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} className="stroke-muted/50" strokeDasharray="3 3" />
          <XAxis dataKey="hora" tickLine={false} axisLine={false} className="text-[10px] font-bold fill-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} className="text-[10px] font-bold fill-muted-foreground" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="total"
            type="monotone"
            fill="url(#fillAtendimentos)"
            stroke="var(--color-atendimentos)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}