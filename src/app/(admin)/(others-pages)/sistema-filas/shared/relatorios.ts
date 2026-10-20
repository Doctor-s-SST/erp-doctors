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
const TIMEOUT_CONSULTA_MS = 15 * 60 * 1000;
class ErroFinalRelatorio extends Error { }

function normalizarRespostaJob(valor: unknown): RespostaJobRelatorio | null {
    let resposta = valor;
    while (Array.isArray(resposta) && resposta.length === 1) resposta = resposta[0];
    if (!resposta || typeof resposta !== "object" || Array.isArray(resposta)) return null;

    const objeto = resposta as Record<string, unknown>;
    const conteudo = objeto.json ?? objeto;
    return conteudo && typeof conteudo === "object" && !Array.isArray(conteudo)
        ? conteudo as RespostaJobRelatorio
        : null;
}

async function lerRespostaJson(resposta: Response): Promise<unknown> {
    try {
        return await resposta.json();
    } catch {
        throw new Error("A API de relatórios não retornou um JSON válido.");
    }
}

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
    const retorno = normalizarRespostaJob(await lerRespostaJson(resposta));
    if (!resposta.ok) {
        throw new Error(retorno?.mensagem || "Não foi possível iniciar o relatório.");
    }

    const jobId = typeof retorno?.jobId === "string" ? retorno.jobId.trim() : "";
    if (!jobId) throw new Error("A API não retornou o identificador do relatório.");
    return jobId;
}

export async function aguardarJobRelatorio(jobId: string): Promise<RespostaJobRelatorio> {
    if (!jobId.trim()) throw new Error("Identificador do relatório inválido.");
    const inicio = Date.now();

    while (Date.now() - inicio < TIMEOUT_CONSULTA_MS) {
        await aguardar(INTERVALO_CONSULTA_MS);
        try {
            const consulta = await fetch(`/api/consulta-relatorios?id=${encodeURIComponent(jobId)}`, {
                cache: "no-store",
            });
            if (consulta.status === 401 || consulta.status === 403) {
                throw new ErroFinalRelatorio("Sua sessão não está autorizada a consultar o relatório.");
            }

            const resposta = normalizarRespostaJob(await lerRespostaJson(consulta));
            if (!resposta) continue;
            if (typeof resposta.jobId === "string" && resposta.jobId !== jobId) {
                throw new ErroFinalRelatorio("A consulta retornou um relatório diferente do solicitado.");
            }
            if (resposta.status === "empty" || resposta.status === "done") return resposta;
            if (resposta.status === "error") {
                throw new ErroFinalRelatorio(resposta.mensagem || "O processamento do relatório falhou.");
            }
            // `processing` e falhas HTTP transitórias continuam em polling.
        } catch (error) {
            if (error instanceof ErroFinalRelatorio) throw error;
        }
    }

    throw new Error("O relatório excedeu o tempo máximo de 15 minutos.");
}
