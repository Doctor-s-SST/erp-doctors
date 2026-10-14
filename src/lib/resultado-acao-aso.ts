import type { AcaoAso, PacienteAssinaturaPayload } from "@/lib/aso-assinatura";

type ObjetoJson = Record<string, unknown>;

const INTERVALO_POLLING_MS = 2500;
const TIMEOUT_POLLING_MS = 15 * 60 * 1000;
const MAX_FALHAS_CONSECUTIVAS = 4;

export type ResultadoAcaoAso = {
    confirmados: PacienteAssinaturaPayload[];
    indicesConfirmados: number[];
    nomesComErro: string[];
};

const comoObjeto = (valor: unknown): ObjetoJson | null =>
    valor !== null && typeof valor === "object" && !Array.isArray(valor)
        ? valor as ObjetoJson
        : null;

const texto = (valor: unknown) =>
    typeof valor === "string" || typeof valor === "number" ? String(valor).trim() : "";

const esperar = (tempoMs: number) => new Promise<void>(resolve => setTimeout(resolve, tempoMs));

async function lerJson(response: Response, contexto: string): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        throw new Error(`${contexto} não retornou um JSON válido.`);
    }
}

function normalizarEnvelopeJob(valor: unknown): ObjetoJson | null {
    const normalizado = Array.isArray(valor) && valor.length === 1 ? valor[0] : valor;
    return comoObjeto(normalizado);
}

function extrairResultadoConcluido(valor: unknown, jobId: string): unknown[] | null {
    const envelope = normalizarEnvelopeJob(valor);
    if (!envelope || texto(envelope.status).toLowerCase() !== "done") return null;
    if (texto(envelope.jobId) && texto(envelope.jobId) !== jobId) {
        throw new Error("A consulta retornou o resultado de outro processamento.");
    }
    if (!Array.isArray(envelope.problematicos)) {
        throw new Error("O processamento terminou sem uma lista válida de itens problemáticos.");
    }
    return envelope.problematicos;
}

/** Aguarda o resultado final sem reenviar a operação original. */
export async function aguardarJobN8n(jobId: string): Promise<unknown[]> {
    const inicio = Date.now();
    let falhasConsecutivas = 0;

    while (Date.now() - inicio < TIMEOUT_POLLING_MS) {
        await esperar(INTERVALO_POLLING_MS);

        try {
            const response = await fetch(`/api/consulta-relatorios?id=${encodeURIComponent(jobId)}`, {
                method: "GET",
                cache: "no-store",
            });
            if (!response.ok) {
                throw new Error(`A consulta do processamento retornou HTTP ${response.status}.`);
            }

            const retorno = await lerJson(response, "A consulta do processamento");
            const problematicos = extrairResultadoConcluido(retorno, jobId);
            if (problematicos) return problematicos;

            const envelope = normalizarEnvelopeJob(retorno);
            if (!envelope) throw new Error("A consulta retornou um formato inesperado.");

            const status = texto(envelope.status).toLowerCase();
            if (texto(envelope.jobId) && texto(envelope.jobId) !== jobId) {
                throw new Error("A consulta retornou outro processamento.");
            }
            if (status === "error") {
                throw new ErroFinalJobN8n(
                    texto(envelope.mensagem) || "O processamento não foi concluído."
                );
            }
            if (status !== "processing") {
                throw new ErroFinalJobN8n("A consulta retornou um status de processamento inesperado.");
            }

            falhasConsecutivas = 0;
        } catch (error) {
            if (error instanceof ErroFinalJobN8n) throw error;
            falhasConsecutivas += 1;
            if (falhasConsecutivas >= MAX_FALHAS_CONSECUTIVAS) {
                throw new Error(
                    "O processamento pode continuar, mas não foi possível consultar seu resultado. Não repita a operação antes de verificar a execução."
                );
            }
        }
    }

    throw new Error(
        "O processamento excedeu o tempo máximo de 15 minutos e o resultado não foi confirmado. Não repita a operação antes de verificar a execução."
    );
}

class ErroFinalJobN8n extends Error { }

/** Inicia a ação e converte o resultado assíncrono no array final do contrato antigo. */
export async function solicitarResultadoAcaoAso(payload: unknown): Promise<unknown[]> {
    let response: Response;
    try {
        response = await fetch("/api/enviar-asos-concluidos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch {
        throw new Error("A operação não pôde ser iniciada e nenhum resultado foi confirmado.");
    }

    const retorno = await lerJson(response, "A API de envio");
    if (!response.ok) {
        throw new Error(`A API não iniciou a operação (HTTP ${response.status}).`);
    }

    const envelope = normalizarEnvelopeJob(retorno);
    const status = texto(envelope?.status).toLowerCase();

    // Compatibilidade segura durante a transição: array de problemas ou envelope antigo.
    // Um array unitário contendo status é resposta de job do n8n, não lista de problemas.
    if (Array.isArray(retorno) && !["processing", "done", "error"].includes(status)) return retorno;
    if (envelope && !status && Array.isArray(envelope.problematicos)) return envelope.problematicos;
    if (!envelope) throw new Error("A API não retornou uma confirmação válida de início.");

    const jobId = texto(envelope.jobId);
    if (status === "done") {
        if (!jobId) throw new Error("A API concluiu a operação sem identificar o processamento.");
        return extrairResultadoConcluido(envelope, jobId)!;
    }
    if (status === "error") {
        throw new Error(texto(envelope.mensagem) || "Erro ao iniciar o processamento.");
    }
    if (status !== "processing" || !jobId) {
        throw new Error("A API não retornou status processing e jobId válidos.");
    }

    return aguardarJobN8n(jobId);
}

const camposIdentificadores = [
    "id",
    "codigo_empresa_soc",
    "codigo_ged_soc",
    "sequencial_ficha",
    "unidade_id",
] as const;

/** Interpreta o contrato do webhook: [] ou uma lista (eventualmente em `problematicos`) com os itens que falharam. */
export function interpretarRespostaAcaoAso(
    retorno: unknown,
    enviados: PacienteAssinaturaPayload[],
    acaoEsperada: AcaoAso
): ResultadoAcaoAso {
    const envelope = comoObjeto(retorno);
    const lista = Array.isArray(retorno)
        ? retorno
        : envelope && Array.isArray(envelope.problematicos)
            ? envelope.problematicos
            : null;

    if (!lista) {
        throw new Error("A API não retornou uma confirmação válida.");
    }

    const indicesComErro = new Set<number>();
    for (const itemBruto of lista) {
        const item = comoObjeto(itemBruto);
        if (!item) throw new Error("A API retornou um item de erro inválido.");
        if (item.erro !== true) {
            throw new Error("A API retornou um item que não está identificado como erro.");
        }
        if (texto(item.acao) && texto(item.acao) !== acaoEsperada) {
            throw new Error("A API retornou um erro referente a outra ação.");
        }

        const pacienteApi = comoObjeto(item.paciente) ?? item;
        const indiceInformado = Number.isInteger(item.indice) ? Number(item.indice) : null;
        const identificadores = camposIdentificadores.filter(campo => texto(pacienteApi[campo]));
        const temIdentidadeSuficiente = identificadores.includes("id") || (
            identificadores.includes("codigo_empresa_soc") &&
            (identificadores.includes("codigo_ged_soc") || identificadores.includes("sequencial_ficha"))
        );

        if (!temIdentidadeSuficiente && indiceInformado === null) {
            throw new Error("A API retornou um funcionário sem identificação suficiente.");
        }

        const candidatos = enviados
            .map((paciente, indice) => ({ paciente, indice }))
            .filter(({ paciente, indice }) => {
                if (indiceInformado !== null && indice !== indiceInformado) return false;
                if (!identificadores.length && indiceInformado === null) return false;
                const local = paciente as unknown as ObjetoJson;
                return identificadores.every(campo => texto(local[campo]) === texto(pacienteApi[campo]));
            });

        if (candidatos.length !== 1) {
            throw new Error("Não foi possível identificar o funcionário retornado com erro pela API.");
        }
        indicesComErro.add(candidatos[0].indice);
    }

    return {
        confirmados: enviados.filter((_, indice) => !indicesComErro.has(indice)),
        indicesConfirmados: enviados.flatMap((_, indice) => indicesComErro.has(indice) ? [] : [indice]),
        nomesComErro: [...indicesComErro]
            .map(indice => enviados[indice].nome_paciente || "Funcionário sem nome"),
    };
}

export function mensagemErrosFuncionarios(nomes: string[]): string {
    const unicos = [...new Set(nomes.filter(Boolean))];
    return unicos.length === 1
        ? `Não foi possível processar o funcionário: ${unicos[0]}.`
        : `Não foi possível processar os funcionários: ${unicos.join(", ")}.`;
}
