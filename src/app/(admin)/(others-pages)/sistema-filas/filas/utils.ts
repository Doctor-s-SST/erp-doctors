import { ItemFila } from "./types";

export function normalizarTextoFila(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function obterTempoEsperaTotal(item: ItemFila): number {
  if (!item.created_at || item.status === "FINALIZADO") return 0;
  const minutos = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 60000);
  return Math.max(0, minutos);
}

export function formatarHoraFila(data: string): string {
  if (!data) return "--:--";
  return new Date(data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function corTempoEspera(dataCriacao: string, cancelado: boolean): string {
  const minutos = Math.floor((Date.now() - new Date(dataCriacao).getTime()) / 60000);
  if (cancelado) return "text-red-500";
  if (minutos < 10) return "text-emerald-500";
  if (minutos < 20) return "text-amber-500";
  if (minutos < 30) return "text-orange-600";
  return "text-red-600 animate-pulse";
}
