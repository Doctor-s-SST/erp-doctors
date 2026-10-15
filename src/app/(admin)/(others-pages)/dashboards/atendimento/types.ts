export type DashboardView = "geral" | "diario" | "mensal";

export type PeriodoRapido = "hoje" | "ontem" | "7-dias" | "15-dias" | "30-dias" | "mes-atual";

export type IntervaloDashboard = {
    inicio: Date;
    fim: Date;
};
