export function formatarNomeRecepcao(nome: string): string {
    if (!nome) return "";
    return nome
        .toLowerCase()
        .split(" ")
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(" ");
}

export function corTempoEsperaRecepcao(minutos: number, isCancelado: boolean): string {
    if (isCancelado) return "text-red-500";
    if (minutos < 10) return "text-emerald-500";
    if (minutos < 20) return "text-amber-500";
    if (minutos < 30) return "text-orange-600";
    return "text-red-600 animate-pulse";
}

export function formatarHoraRecepcao(data: string): string {
    if (!data) return "--:--";
    return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
