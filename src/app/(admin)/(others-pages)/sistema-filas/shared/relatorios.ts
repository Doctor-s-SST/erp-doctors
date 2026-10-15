export type PeriodoRelatorio = "manha" | "tarde" | "personalizado" | "todos";
export type DiasRelatorio = "hoje" | "ontem" | "semana" | "quinzena" | "mes" | "personalizado";

export interface RespostaJobRelatorio {
    status?: "processing" | "empty" | "done" | "error" | string;
    data?: unknown[];
    charts?: Record<string, unknown> | null;
    mensagem?: string;
    [chave: string]: unknown;
}

const INTERVALO_CONSULTA_MS = 3000;

export function normalizarTextoRelatorio(texto: string): string {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function parseAcionamentoToDate(str: string): Date {
    const [data, horario] = str.split(" ");
    const [dia, mes, ano] = data.split("/");
    return new Date(`${ano}-${mes}-${dia}T${horario}`);
}

export function parseTempoToSegundos(tempoStr: string): number {
    if (!tempoStr || tempoStr === "---") return 0;
    const horas = parseInt(tempoStr.match(/(\d+)h/)?.[1] || "0");
    const minutos = parseInt(tempoStr.match(/(\d+)m/)?.[1] || "0");
    const segundos = parseInt(tempoStr.match(/(\d+)s/)?.[1] || "0");
    return horas * 3600 + minutos * 60 + segundos;
}

export function calcularPeriodoRelatorio(
    periodo: PeriodoRelatorio,
    dias: DiasRelatorio,
): Partial<{ dataInicio: string; dataFim: string; horaInicio: string; horaFim: string }> {
    const resultado: Partial<{ dataInicio: string; dataFim: string; horaInicio: string; horaFim: string }> = {};

    if (periodo === "todos") Object.assign(resultado, { horaInicio: "07:00", horaFim: "17:59" });
    if (periodo === "manha") Object.assign(resultado, { horaInicio: "07:00", horaFim: "13:00" });
    if (periodo === "tarde") Object.assign(resultado, { horaInicio: "13:01", horaFim: "17:59" });

    const quantidadeDias = dias === "ontem" ? 1
        : dias === "semana" ? 6
            : dias === "quinzena" ? 14
                : dias === "mes" ? 29
                    : dias === "hoje" ? 0 : null;

    if (quantidadeDias !== null) {
        const dataFim = new Date();
        const dataInicio = new Date();
        if (dias === "ontem") dataFim.setDate(dataFim.getDate() - 1);
        dataInicio.setDate(dataFim.getDate() - (dias === "ontem" ? 0 : quantidadeDias));
        resultado.dataInicio = dataInicio.toISOString().split("T")[0];
        resultado.dataFim = dataFim.toISOString().split("T")[0];
    }

    return resultado;
}

function aguardar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function iniciarJobRelatorio(endpoint: string, formData: FormData): Promise<string> {
    const resposta = await fetch(endpoint, { method: "POST", body: formData });
    const corpo = await resposta.json() as { jobId: string };
    return corpo.jobId;
}

export async function aguardarJobRelatorio(jobId: string): Promise<RespostaJobRelatorio> {
    while (true) {
        await aguardar(INTERVALO_CONSULTA_MS);
        const consulta = await fetch(`/api/consulta-relatorios/?id=${jobId}`);
        const resultado = await consulta.json();
        const respostaBruta = Array.isArray(resultado) ? resultado[0] : resultado;
        const resposta = (respostaBruta?.json ?? respostaBruta) as RespostaJobRelatorio;
        if (resposta.status === "empty" || resposta.status === "done") return resposta;
    }
}
