import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { chartConfig } from "./chartConfig"

interface FluxoHoraItem {
  hora: number
  total: number
}

export function GraficoAtendimentosHora({ data }: { data: FluxoHoraItem[] }) {
  const totalsByHour = new Map<number, number>()
  for (const item of data || []) {
    const hour = Number(item.hora)
    if (!Number.isNaN(hour)) totalsByHour.set(hour, item.total ?? 0)
  }

  const chartData = Array.from({ length: 12 }, (_, index) => {
    const hour = index + 7
    return {
    hora: `${String(hour).padStart(2, "0")}h`,
    total: totalsByHour.get(hour) ?? 0,
    }
  })

  return (
    <ChartContainer config={chartConfig} className="h-[340px] w-full !aspect-auto">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-muted/50" strokeDasharray="3 3" />
          <XAxis dataKey="hora" tickLine={false} axisLine={false} className="text-[10px] font-bold fill-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} className="text-[10px] font-bold fill-muted-foreground" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="total"
            type="monotone"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}