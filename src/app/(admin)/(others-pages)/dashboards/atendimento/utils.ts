import { endOfMonth, startOfMonth, subDays } from "date-fns";
import type { IntervaloDashboard, PeriodoRapido } from "./types";

export const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const PERIODOS_RAPIDOS: Array<{ valor: PeriodoRapido; rotulo: string }> = [
    { valor: "hoje", rotulo: "Hoje" },
    { valor: "ontem", rotulo: "Ontem" },
    { valor: "7-dias", rotulo: "7 dias" },
    { valor: "15-dias", rotulo: "15 dias" },
    { valor: "30-dias", rotulo: "30 dias" },
    { valor: "mes-atual", rotulo: "Este mês" },
];

export function obterIntervaloRapido(periodo: PeriodoRapido, referencia = new Date()): IntervaloDashboard {
    if (periodo === "ontem") {
        const ontem = subDays(referencia, 1);
        return { inicio: ontem, fim: ontem };
    }
    if (periodo === "7-dias") return { inicio: subDays(referencia, 6), fim: referencia };
    if (periodo === "15-dias") return { inicio: subDays(referencia, 14), fim: referencia };
    if (periodo === "30-dias") return { inicio: subDays(referencia, 29), fim: referencia };
    if (periodo === "mes-atual") return { inicio: startOfMonth(referencia), fim: endOfMonth(referencia) };
    return { inicio: referencia, fim: referencia };
}

export function anosDisponiveisDashboard(anoAtual = new Date().getFullYear()): number[] {
    const primeiroAno = 2020;
    return Array.from({ length: anoAtual - primeiroAno + 3 }, (_, indice) => primeiroAno + indice);
}
