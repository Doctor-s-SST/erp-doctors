"use client";

import { ArrowUpDown } from "lucide-react";
import { ColunaOrdenacaoFila, ConfigOrdenacaoFila } from "../types";

type SortableTableHeadProps = {
  label: string;
  coluna: ColunaOrdenacaoFila;
  ordenacao: ConfigOrdenacaoFila;
  onChange: (ordenacao: ConfigOrdenacaoFila) => void;
};

export function SortableTableHead({
  label,
  coluna,
  ordenacao,
  onChange,
}: SortableTableHeadProps) {
  const ativo = ordenacao.coluna === coluna;

  return (
    <th
      className={`cursor-pointer p-4 text-left text-[10px] font-bold uppercase tracking-widest transition-colors ${
        ativo
          ? "bg-slate-200/50 text-emerald-600 dark:bg-slate-800"
          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
      onClick={() =>
        onChange({
          coluna,
          direcao: ativo && ordenacao.direcao === "asc" ? "desc" : "asc",
        })
      }
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${ativo ? "opacity-100" : "opacity-30"}`} />
      </div>
    </th>
  );
}
