import { StatusVencimentoVisual } from "./types";

export const THEME_COLORS = {
    primary: "#317bbd",
    secondary: "#ec801a",
    success: "#10b981",
    danger: "#ef4444",
    violet: "#6366f1",
    warning: "#f59e0b",
    slate: "#64748b",
    legendBackground: "#0A2647",
};

export const CORES_TIPO_ASO = [
    THEME_COLORS.primary,
    THEME_COLORS.secondary,
    THEME_COLORS.violet,
    THEME_COLORS.success,
    THEME_COLORS.warning,
    THEME_COLORS.danger,
    THEME_COLORS.slate,
];

export function possuiAsoMontado(observacao?: string): boolean {
    if (!observacao) return false;
    const texto = observacao.toLowerCase();
    return (
        texto.includes("aso montado") ||
        texto.includes("aso emitido") ||
        texto.includes("montado")
    );
}

export function classificarTipoExame(funcionario: any): "clinico" | "complementar" {
    const exames = funcionario?.listaExamesResumida;

    if (!Array.isArray(exames) || exames.length === 0) {
        return "clinico";
    }

    const somenteClinicos = exames.every((exame: any) => {
        const descricao = String(
            exame?.descricaoExame ||
            exame?.nomeExame ||
            exame?.nome ||
            exame ||
            ""
        ).trim().toLowerCase();

        if (!descricao) {
            return true;
        }

        return (
            descricao.includes("exame clínico") ||
            descricao.includes("exame clinico") ||
            descricao.includes("acuidade visual")
        );
    });

    return somenteClinicos ? "clinico" : "complementar";
}

export const compararValores = (a: any, b: any, key: string): number => {
    let valA = a[key];
    let valB = b[key];

    if (key === "statusVencimento") {
        valA = a.statusVencimento?.label || "";
        valB = b.statusVencimento?.label || "";
    } else if (key === "examesList") {
        valA = Array.isArray(a.examesList) ? a.examesList.join(", ") : "";
        valB = Array.isArray(b.examesList) ? b.examesList.join(", ") : "";
    }

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === "string") {
        return valA.localeCompare(String(valB));
    }

    return valA > valB ? 1 : valA < valB ? -1 : 0;
};

export function parseDateBR(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;

    return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0])
    );
}

export function obterMaiorPrazo(
    exames: any[],
    prazosMap: Record<string, number>
): number | null {
    let maiorPrazo: number | null = null;

    if (!Array.isArray(exames)) {
        return null;
    }

    exames.forEach((exame: any) => {
        const nomeExame = String(
            exame?.descricaoExame ||
            exame?.nomeExame ||
            exame?.nome ||
            exame ||
            ""
        ).trim().toLowerCase();

        if (!nomeExame) return;

        const prazo = prazosMap[nomeExame];

        if (
            prazo !== undefined &&
            (maiorPrazo === null || prazo > maiorPrazo)
        ) {
            maiorPrazo = prazo;
        }
    });

    return maiorPrazo;
}

export function obterStatusVencimento(
    dataFicha: string | null,
    prazoDias: number | null
): "vencido" | "no_prazo" | "sem_prazo" {
    if (!dataFicha || prazoDias === null) {
        return "sem_prazo";
    }

    const dataBase = parseDateBR(dataFicha);
    if (!dataBase) {
        return "sem_prazo";
    }

    const dataLimite = new Date(dataBase);
    dataLimite.setDate(dataLimite.getDate() + prazoDias);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diffTime = dataLimite.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return "vencido";
    }

    return "no_prazo";
}

export function calcularStatusVencimentoVisual(
    dataFicha: string | null,
    prazoDias: number | null
): StatusVencimentoVisual {
    if (!dataFicha || prazoDias === null) {
        return {
            label: "Sem Prazo",
            color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
            estaVencido: false,
        };
    }

    const dataBase = parseDateBR(dataFicha);
    if (!dataBase) {
        return {
            label: "Data Inválida",
            color: "bg-slate-500/10 text-slate-400 border-slate-500/20",
            estaVencido: false,
        };
    }

    const dataLimite = new Date(dataBase);
    dataLimite.setDate(dataLimite.getDate() + prazoDias);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diffTime = dataLimite.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            label: `Vencido há ${Math.abs(diffDays)}d`,
            color: "bg-red-500/20 text-red-500 border-red-500/30",
            estaVencido: true,
        };
    }

    if (diffDays <= 3) {
        return {
            label: `Vence em ${diffDays}d`,
            color: "bg-amber-500/20 text-amber-500 border-amber-500/30",
            estaVencido: false,
        };
    }

    return {
        label: `No prazo (${diffDays}d)`,
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
        estaVencido: false,
    };
}

export function formatPercent(valor: number, total: number): string {
    if (!total) return "0%";
    return `${((valor / total) * 100).toFixed(1)}%`;
}

export function getCorStatus(nome: string): string {
    const texto = nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (
        texto.includes("conclu") ||
        texto.includes("pronto") ||
        texto.includes("apto")
    ) {
        return THEME_COLORS.success;
    }

    if (
        texto.includes("pend") ||
        texto.includes("inapto")
    ) {
        return THEME_COLORS.danger;
    }

    return THEME_COLORS.warning;
}
