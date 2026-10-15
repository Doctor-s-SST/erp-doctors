import type { ReactNode } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PainelFiltrosExamesProps {
    busca: string;
    onBuscaChange: (valor: string) => void;
    quantidadeResultados: number;
    medico: string;
    onMedicoChange: (valor: string) => void;
    medicos: string[];
    exame: string;
    onExameChange: (valor: string) => void;
    exames: string[];
    prestador: string;
    onPrestadorChange: (valor: string) => void;
    prestadores: string[];
    dataInicio: string;
    onDataInicioChange: (valor: string) => void;
    dataFim: string;
    onDataFimChange: (valor: string) => void;
    possuiFiltroExtra: boolean;
    onLimpar: () => void;
    filtroGrupo: ReactNode;
}

export function PainelFiltrosExames({
    busca,
    onBuscaChange,
    quantidadeResultados,
    medico,
    onMedicoChange,
    medicos,
    exame,
    onExameChange,
    exames,
    prestador,
    onPrestadorChange,
    prestadores,
    dataInicio,
    onDataInicioChange,
    dataFim,
    onDataFimChange,
    possuiFiltroExtra,
    onLimpar,
    filtroGrupo,
}: PainelFiltrosExamesProps) {
    const possuiFiltros = Boolean(
        busca || medico !== "todos" || exame !== "todos" || prestador !== "todos" ||
        dataInicio || dataFim || possuiFiltroExtra
    );

    return (
        <div className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Filtros</p>
                        <p className="truncate text-[10px] text-slate-400">Refine os ASOs exibidos na lista</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {busca && <span className="text-[10px] text-slate-400">{quantidadeResultados} resultado(s)</span>}
                    {possuiFiltros && (
                        <Button type="button" variant="ghost" onClick={onLimpar} className="h-8 gap-1.5 px-2 text-[10px] font-bold uppercase text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                            <X className="h-3.5 w-3.5" /> Limpar
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                <div className="relative min-w-0 sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={busca} onChange={(event) => onBuscaChange(event.target.value)} placeholder="Buscar por nome, empresa..." className="h-10 bg-white pl-9 pr-9 text-xs dark:bg-slate-900" />
                    {busca && (
                        <button type="button" onClick={() => onBuscaChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Limpar busca">
                            ×
                        </button>
                    )}
                </div>

                <FiltroSelect value={medico} onValueChange={onMedicoChange} placeholder="Médico Examinador" todosLabel="Todos os médicos" opcoes={medicos} />
                <FiltroSelect value={exame} onValueChange={onExameChange} placeholder="Filtrar por Exame" todosLabel="Todos os exames" opcoes={exames} />

                <div className="min-w-0 sm:col-span-2 lg:col-span-1 2xl:col-span-2">{filtroGrupo}</div>

                <FiltroSelect value={prestador} onValueChange={onPrestadorChange} placeholder="Credenciada" todosLabel="Todas as credenciadas" opcoes={prestadores} />

                <CampoData label="De" value={dataInicio} onChange={onDataInicioChange} />
                <CampoData label="Até" value={dataFim} min={dataInicio || undefined} onChange={onDataFimChange} />
            </div>
        </div>
    );
}

interface FiltroSelectProps {
    value: string;
    onValueChange: (valor: string) => void;
    placeholder: string;
    todosLabel: string;
    opcoes: string[];
}

function FiltroSelect({ value, onValueChange, placeholder, todosLabel, opcoes }: FiltroSelectProps) {
    return (
        <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger className="h-10 w-full min-w-0 bg-white text-xs dark:bg-slate-900">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="todos">{todosLabel}</SelectItem>
                {opcoes.map(opcao => <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>)}
            </SelectContent>
        </Select>
    );
}

interface CampoDataProps {
    label: string;
    value: string;
    min?: string;
    onChange: (valor: string) => void;
}

function CampoData({ label, value, min, onChange }: CampoDataProps) {
    return (
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-input bg-white px-3 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-900">
            <span className="whitespace-nowrap">{label}</span>
            <Input type="date" value={value} min={min} onChange={(event) => onChange(event.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs font-normal normal-case shadow-none focus-visible:ring-0" />
        </label>
    );
}
