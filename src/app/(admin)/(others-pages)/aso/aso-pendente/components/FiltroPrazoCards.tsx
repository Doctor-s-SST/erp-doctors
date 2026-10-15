import { AlertCircle, CheckCircle2, PauseCircle } from "lucide-react";

export type FiltroPrazoAso = "todos" | "vencido" | "no-prazo" | "suspenso";

interface FiltroPrazoCardsProps {
    filtro: FiltroPrazoAso;
    vencidos: number;
    noPrazo: number;
    suspensos: number;
    onChange: (filtro: FiltroPrazoAso) => void;
}

const cards = [
    {
        filtro: "vencido" as const,
        label: "ASOs vencidos",
        cor: "red",
        Icone: AlertCircle,
    },
    {
        filtro: "no-prazo" as const,
        label: "ASOs no prazo",
        cor: "emerald",
        Icone: CheckCircle2,
    },
    {
        filtro: "suspenso" as const,
        label: "ASOs suspensos",
        cor: "amber",
        Icone: PauseCircle,
    },
] as const;

const estilos = {
    red: {
        base: "border-red-500/20 bg-red-500/5",
        ativo: "border-red-500 bg-red-500/10 ring-red-500/15",
        icone: "bg-red-500/10 text-red-500",
        numero: "text-red-500",
    },
    emerald: {
        base: "border-emerald-500/20 bg-emerald-500/5",
        ativo: "border-emerald-500 bg-emerald-500/10 ring-emerald-500/15",
        icone: "bg-emerald-500/10 text-emerald-500",
        numero: "text-emerald-500",
    },
    amber: {
        base: "border-amber-500/20 bg-amber-500/5",
        ativo: "border-amber-500 bg-amber-500/10 ring-amber-500/15",
        icone: "bg-amber-500/10 text-amber-500",
        numero: "text-amber-500",
    },
} as const;

export function FiltroPrazoCards({
    filtro,
    vencidos,
    noPrazo,
    suspensos,
    onChange,
}: FiltroPrazoCardsProps) {
    const totais: Record<Exclude<FiltroPrazoAso, "todos">, number> = {
        vencido: vencidos,
        "no-prazo": noPrazo,
        suspenso: suspensos,
    };

    return (
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto">
            {cards.map(({ filtro: valor, label, cor, Icone }) => {
                const ativo = filtro === valor;
                const estilo = estilos[cor];
                return (
                    <button
                        key={valor}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => onChange(ativo ? "todos" : valor)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm ${ativo ? `${estilo.ativo} ring-2` : estilo.base}`}
                    >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${estilo.icone}`}>
                            <Icone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            {label}
                        </span>
                        <span className={`ml-auto text-lg font-black ${estilo.numero}`}>
                            {totais[valor]}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
