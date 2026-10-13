import type { AcaoAso, PacienteAssinaturaPayload } from "@/lib/aso-assinatura";

type ObjetoJson = Record<string, unknown>;

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

const camposIdentificadores = [
    "id",
    "codigo_empresa_soc",
    "codigo_ged_soc",
    "sequencial_ficha",
    "unidade_id",
] as const;

/** Interpreta o contrato do webhook: [] ou uma lista (eventualmente em `problematicos`) com os itens que falharam. */
export async function interpretarRespostaAcaoAso(
    response: Response,
    enviados: PacienteAssinaturaPayload[],
    acaoEsperada: AcaoAso
): Promise<ResultadoAcaoAso> {
    let retorno: unknown;
    try {
        retorno = await response.json();
    } catch {
        throw new Error("A API não retornou uma resposta válida.");
    }

    if (!response.ok) {
        throw new Error("A API não conseguiu concluir a operação.");
    }

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
