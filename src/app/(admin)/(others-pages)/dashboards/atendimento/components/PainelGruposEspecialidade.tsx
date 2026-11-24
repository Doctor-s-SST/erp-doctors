"use client"

import { RefreshCcw } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { GraficoPizza } from "@/components/atendimento/dashboards/diario/GraficoPizza"
import { cn } from "@/lib/utils"
import type { CardGrupoDashboard } from "@/lib/dashboard-grupos"
import type { SalaEspecialidadeItem } from "@/lib/dashboard-analytics"

interface Props {
    aberto: boolean
    onAbertoChange: (aberto: boolean) => void
    especialidade: string
    periodo: string
    geral: { total: number; aguardando: number; salas: SalaEspecialidadeItem[] }
    grupos: CardGrupoDashboard[]
    carregando: boolean
}

function formatarMinutos(minutos: number): string {
    if (!minutos || minutos <= 0) return "—"
    const total = Math.round(minutos * 60)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}min ${s.toString().padStart(2, "0")}s`
}

function ordenarSala(a: string, b: string): number {
    const na = /^\d+$/.test(a) ? Number(a) : 999
    const nb = /^\d+$/.test(b) ? Number(b) : 999
    return na - nb || a.localeCompare(b)
}

/**
 * Painel lateral com a especialidade dividida pelos grupos marcados para o
 * dashboard: resumo, um gráfico por grupo e a tabela de atendidos por sala.
 */
export function PainelGruposEspecialidade({
    aberto,
    onAbertoChange,
    especialidade,
    periodo,
    geral,
    grupos,
    carregando,
}: Props) {
    const salas = Array.from(new Set(grupos.flatMap((g) => g.salas.map((s) => s.nome)))).sort(ordenarSala)
    const semDados = !carregando && grupos.length === 0

    return (
        <Sheet open={aberto} onOpenChange={onAbertoChange}>
            <SheetContent className="lg:max-w-3xl">
                <SheetHeader>
                    <div className="flex items-center gap-2">
                        <SheetTitle>{especialidade} por grupo</SheetTitle>
                        {carregando && <RefreshCcw className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                    </div>
                    <SheetDescription>{periodo}</SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-6 overflow-y-auto p-5">
                    {/* RESUMO */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        <ResumoGrupo titulo="Geral" total={geral.total} aguardando={geral.aguardando} />
                        {grupos.map((g) => (
                            <ResumoGrupo
                                key={g.chave}
                                titulo={g.titulo}
                                total={g.total}
                                aguardando={g.aguardando}
                                tempoMedio={g.tempo_medio}
                                alerta={g.foraDosGrupos}
                            />
                        ))}
                    </div>

                    {carregando && grupos.length === 0 && (
                        <p className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            Carregando grupos...
                        </p>
                    )}

                    {semDados && (
                        <p className="py-10 text-center text-[11px] font-bold uppercase tracking-widest text-gray-500">
                            Sem atendimentos no período
                        </p>
                    )}

                    {/* GRÁFICOS */}
                    {grupos.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {grupos.map((g) => (
                                <div
                                    key={g.chave}
                                    className={cn(
                                        "rounded-xl border border-gray-200 p-2 dark:border-gray-800",
                                        g.foraDosGrupos && "border-amber-400/60"
                                    )}
                                >
                                    <p className="pt-1 text-center text-xs font-black uppercase text-gray-600 dark:text-gray-200">
                                        {g.titulo}
                                    </p>
                                    <GraficoPizza data={g.salas} aguardandoExterno={g.aguardando} mode="especialidade" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TABELA POR SALA */}
                    {salas.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                                    <tr>
                                        <th className="p-2.5 text-left font-bold">Sala</th>
                                        {grupos.map((g) => (
                                            <th key={g.chave} className="p-2.5 text-right font-bold">{g.titulo}</th>
                                        ))}
                                        <th className="p-2.5 text-right font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {salas.map((sala) => {
                                        const valores = grupos.map((g) => g.salas.find((s) => s.nome === sala))
                                        const total = valores.reduce((acc, v) => acc + (v?.total ?? 0), 0)
                                        const profissional = grupos
                                            .flatMap((g) => g.salas)
                                            .find((s) => s.nome === sala && s.profissional)?.profissional

                                        return (
                                            <tr key={sala}>
                                                <td className="p-2.5">
                                                    <span className="font-bold text-gray-800 dark:text-gray-100">
                                                        {sala === "Rotativo" ? sala : `Sala ${sala}`}
                                                    </span>
                                                    {profissional && (
                                                        <span className="block text-[10px] text-gray-500">{profissional}</span>
                                                    )}
                                                </td>
                                                {valores.map((v, i) => (
                                                    <td key={grupos[i].chave} className="p-2.5 text-right tabular-nums">
                                                        {v?.total ? (
                                                            <>
                                                                <span className="font-bold text-gray-800 dark:text-gray-100">{v.total}</span>
                                                                {v.tempo_medio > 0 && (
                                                                    <span className="block text-[10px] text-gray-500">
                                                                        {formatarMinutos(v.tempo_medio)}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-300 dark:text-gray-700">—</span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="p-2.5 text-right font-black tabular-nums text-gray-900 dark:text-white">
                                                    {total}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="text-[11px] leading-relaxed text-gray-500">
                        Os grupos contam atendimentos por sala, na mesma regra do filtro da fila. O total geral conta exames,
                        por isso pode ser maior em especialidades com mais de um exame por paciente.
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function ResumoGrupo({
    titulo,
    total,
    aguardando,
    tempoMedio,
    alerta,
}: {
    titulo: string
    total: number
    aguardando: number
    tempoMedio?: number
    alerta?: boolean
}) {
    return (
        <div
            className={cn(
                "rounded-xl border border-gray-200 p-3 dark:border-gray-800",
                alerta && "border-amber-400/60 bg-amber-500/5"
            )}
        >
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-500" title={titulo}>
                {titulo}
            </p>
            <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{total}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-gray-500">
                <span>
                    Aguardando <b className="text-amber-600 dark:text-amber-400">{aguardando}</b>
                </span>
                {tempoMedio !== undefined && tempoMedio > 0 && (
                    <span>
                        Médio <b className="text-blue-600 dark:text-blue-400">{formatarMinutos(tempoMedio)}</b>
                    </span>
                )}
            </div>
        </div>
    )
}
