import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface HeatmapItem {
  dia: string
  hora: number
  total: number
}

function getIntensityClass(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "bg-slate-800/40"
  const ratio = value / max
  if (ratio >= 0.8) return "bg-emerald-400"
  if (ratio >= 0.6) return "bg-emerald-500/80"
  if (ratio >= 0.4) return "bg-emerald-600/70"
  if (ratio >= 0.2) return "bg-emerald-700/60"
  return "bg-emerald-900/60"
}

export function GraficoHeatmapHoraDia({ data }: { data: HeatmapItem[] }) {
  const heatmap = data || []

  if (heatmap.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center text-xs uppercase tracking-widest text-gray-500 font-bold">
        Sem dados no período
      </div>
    )
  }

  const days = Array.from(new Set(heatmap.map((item) => item.dia))).sort()
  const hours = Array.from(new Set(heatmap.map((item) => item.hora))).sort((a, b) => a - b)

  const byKey = new Map<string, number>()
  let maxValue = 0

  for (const item of heatmap) {
    const key = `${item.dia}-${item.hora}`
    byKey.set(key, item.total)
    if (item.total > maxValue) maxValue = item.total
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[740px] space-y-2">
        <div className="grid" style={{ gridTemplateColumns: `100px repeat(${hours.length}, minmax(28px, 1fr))` }}>
          <div />
          {hours.map((hour) => (
            <div key={hour} className="text-[10px] text-center text-gray-500 font-bold">
              {hour.toString().padStart(2, "0")}h
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div
            key={day}
            className="grid items-center gap-1"
            style={{ gridTemplateColumns: `100px repeat(${hours.length}, minmax(28px, 1fr))` }}
          >
            <div className="text-[10px] text-gray-400 font-bold uppercase">
              {format(parseISO(day), "dd/MM (EEE)", { locale: ptBR })}
            </div>
            {hours.map((hour) => {
              const value = byKey.get(`${day}-${hour}`) ?? 0
              return (
                <div
                  key={`${day}-${hour}`}
                  title={`${format(parseISO(day), "dd/MM/yyyy")} ${hour.toString().padStart(2, "0")}:00 - ${value}`}
                  className={`h-7 rounded-md border border-slate-700/50 transition-opacity hover:opacity-80 ${getIntensityClass(value, maxValue)}`}
                />
              )
            })}
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 text-[10px] text-gray-500 font-bold pt-1">
          <span>Menor</span>
          <span className="w-5 h-2 rounded bg-slate-800/40 border border-slate-700/40" />
          <span className="w-5 h-2 rounded bg-emerald-900/60 border border-slate-700/40" />
          <span className="w-5 h-2 rounded bg-emerald-700/60 border border-slate-700/40" />
          <span className="w-5 h-2 rounded bg-emerald-500/80 border border-slate-700/40" />
          <span className="w-5 h-2 rounded bg-emerald-400 border border-slate-700/40" />
          <span>Maior</span>
        </div>
      </div>
    </div>
  )
}
