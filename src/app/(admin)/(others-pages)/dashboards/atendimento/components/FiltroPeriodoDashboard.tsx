"use client";

import { format, endOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DashboardView, PeriodoRapido } from "../types";
import { anosDisponiveisDashboard, MESES, obterIntervaloRapido, PERIODOS_RAPIDOS } from "../utils";

interface FiltroPeriodoDashboardProps {
    view: DashboardView;
    dataInicio: Date;
    dataFim: Date;
    onChange: (inicio: Date, fim: Date) => void;
}

const calendarioClassName = cn(
    "p-3 bg-gray-950 text-white rounded-xl border border-gray-800",
    "[&_.rdp-day]:font-semibold",
    "[&_.rdp-day_selected]:bg-emerald-600",
    "[&_.rdp-day:hover]:bg-gray-800",
    "[&_.rdp-caption]:text-white",
    "[&_.rdp-head_cell]:text-gray-400",
);

export function FiltroPeriodoDashboard({ view, dataInicio, dataFim, onChange }: FiltroPeriodoDashboardProps) {
    const aplicarPeriodo = (periodo: PeriodoRapido) => {
        const intervalo = obterIntervaloRapido(periodo);
        onChange(intervalo.inicio, intervalo.fim);
    };

    const rotulo = view === "diario"
        ? format(dataInicio, "dd/MM/yyyy")
        : view === "mensal"
            ? `${MESES[dataInicio.getMonth()]} de ${dataInicio.getFullYear()}`
            : `${format(dataInicio, "dd/MM/yyyy")} - ${format(dataFim, "dd/MM/yyyy")}`;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 text-[10px] font-black uppercase text-white hover:bg-gray-800">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                    {rotulo}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[calc(100vw-1rem)] overflow-x-auto border-gray-700 bg-gray-900 p-3" align="end">
                {view === "geral" && (
                    <div className="mb-3 grid grid-cols-3 gap-1 sm:grid-cols-6">
                        {PERIODOS_RAPIDOS.map(periodo => (
                            <Button
                                key={periodo.valor}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => aplicarPeriodo(periodo.valor)}
                                className="h-8 border-gray-700 bg-gray-800 px-2 text-[10px] text-gray-200 hover:bg-gray-700 hover:text-white"
                            >
                                {periodo.rotulo}
                            </Button>
                        ))}
                    </div>
                )}

                {view === "mensal" && (
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            aria-label="Mês"
                            value={dataInicio.getMonth()}
                            onChange={event => {
                                const data = new Date(dataInicio);
                                data.setMonth(Number(event.target.value));
                                onChange(startOfMonth(data), endOfMonth(data));
                            }}
                            className="rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white"
                        >
                            {MESES.map((mes, indice) => <option key={mes} value={indice}>{mes}</option>)}
                        </select>
                        <select
                            aria-label="Ano"
                            value={dataInicio.getFullYear()}
                            onChange={event => {
                                const data = new Date(dataInicio);
                                data.setFullYear(Number(event.target.value));
                                onChange(startOfMonth(data), endOfMonth(data));
                            }}
                            className="rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-white"
                        >
                            {anosDisponiveisDashboard().map(ano => <option key={ano} value={ano}>{ano}</option>)}
                        </select>
                    </div>
                )}

                {view === "geral" && (
                    <Calendar
                        mode="range"
                        selected={{ from: dataInicio, to: dataFim }}
                        onSelect={intervalo => {
                            if (!intervalo?.from) return;
                            onChange(intervalo.from, intervalo.to || intervalo.from);
                        }}
                        locale={ptBR}
                        numberOfMonths={2}
                        className={calendarioClassName}
                    />
                )}

                {view === "diario" && (
                    <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={data => data && onChange(data, data)}
                        locale={ptBR}
                        numberOfMonths={1}
                        className={calendarioClassName}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}
