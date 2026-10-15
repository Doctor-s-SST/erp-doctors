import type { AcaoAso } from "@/lib/aso-assinatura";
import { solicitarResultadoAcaoAso } from "@/lib/resultado-acao-aso";
import type { Pacientes } from "./types";

type ObjetoJson = Record<string, unknown>;

export type ProblemaAcao = {
    id: string;
    nome: string;
    ficha: string;
    acao: string;
    etapa: string;
    mensagem: string;
    execucao?: string;
    origem: "n8n" | "resposta" | "banco";
};

export type ResultadoAcao = {
    confirmados: Pacientes[];
    problemas: ProblemaAcao[];
};

const objetoJson = (valor: unknown): valor is ObjetoJson =>
    typeof valor === "object" && valor !== null && !Array.isArray(valor);

const textoSeguro = (valor: unknown): string =>
    typeof valor === "string" || typeof valor === "number" ? String(valor).trim() : "";

export function problemaDoPaciente(
    paciente: Pacientes,
    acao: string,
    mensagem: string,
    origem: ProblemaAcao["origem"],
    etapa: string,
    execucao?: string
): ProblemaAcao {
    return {
        id: paciente.id ?? "",
        nome: paciente.nome_paciente || "Paciente sem nome",
        ficha: textoSeguro(paciente.sequencial_ficha),
        acao,
        mensagem,
        origem,
        etapa,
        execucao,
    };
}

/** Interpreta a lista final de problemas sem inferir sucesso em respostas ambíguas. */
export function interpretarRetornoN8n(
    retorno: unknown,
    enviados: Pacientes[],
    acao: AcaoAso
): ResultadoAcao {
    const respostaInvalida = () => new Error(
        "A resposta recebida não permite confirmar o resultado. Confira a execução antes de repetir a ação."
    );

    if (objetoJson(retorno) && (
        retorno.success === false || retorno.sucesso === false ||
        (retorno.error !== undefined && retorno.error !== false && retorno.error !== null) ||
        (retorno.erro !== undefined && retorno.erro !== false && retorno.erro !== null)
    )) throw respostaInvalida();

    const lista = Array.isArray(retorno)
        ? retorno
        : objetoJson(retorno) && Array.isArray(retorno.problematicos)
            ? retorno.problematicos
            : null;
    if (!lista) throw respostaInvalida();

    const falhas = new Map<number, ProblemaAcao>();
    for (const valor of lista) {
        if (!objetoJson(valor)) throw respostaInvalida();
        if (valor.erro === false || valor.problema === false || valor.success === true) throw respostaInvalida();
        if (textoSeguro(valor.acao) && textoSeguro(valor.acao) !== acao) throw respostaInvalida();

        const pacienteRetornado = objetoJson(valor.paciente) ? valor.paciente : {};
        const campos = ["id", "codigo_empresa_soc", "codigo_ged_soc", "sequencial_ficha", "unidade_id"]
            .filter(campo => textoSeguro(pacienteRetornado[campo]));
        const temIdentidade = campos.includes("id") || (
            campos.includes("codigo_empresa_soc") &&
            (campos.includes("codigo_ged_soc") || campos.includes("sequencial_ficha"))
        );
        const temIndice = Object.prototype.hasOwnProperty.call(valor, "indice");
        if (temIndice && (
            typeof valor.indice !== "number" || !Number.isInteger(valor.indice) ||
            valor.indice < 0 || valor.indice >= enviados.length
        )) throw respostaInvalida();
        if (!temIdentidade && !temIndice) throw respostaInvalida();

        const candidatos = enviados
            .map((paciente, indice) => ({ paciente, indice }))
            .filter(({ paciente, indice }) => {
                if (temIndice && indice !== valor.indice) return false;
                const local = paciente as unknown as ObjetoJson;
                return campos.every(campo => textoSeguro(local[campo]) === textoSeguro(pacienteRetornado[campo]));
            });
        if (candidatos.length !== 1) throw respostaInvalida();

        const { paciente, indice } = candidatos[0];
        const mensagem = textoSeguro(valor.mensagem) || "O processamento deste paciente não foi concluído.";
        const problema = problemaDoPaciente(
            paciente,
            acao,
            mensagem,
            "n8n",
            textoSeguro(valor.etapa) || "processamento",
            textoSeguro(valor.execucao) || undefined
        );
        const anterior = falhas.get(indice);
        if (anterior) {
            problema.mensagem = [...new Set([anterior.mensagem, mensagem])].join(" | ");
            problema.etapa = [...new Set([anterior.etapa, problema.etapa])].join(" / ");
        }
        falhas.set(indice, problema);
    }

    return {
        confirmados: enviados.filter((_, indice) => !falhas.has(indice)),
        problemas: [...falhas.values()],
    };
}

export async function solicitarAcaoN8n(
    payload: unknown,
    enviados: Pacientes[],
    acao: AcaoAso
): Promise<ResultadoAcao> {
    const retorno = await solicitarResultadoAcaoAso(payload);
    return interpretarRetornoN8n(retorno, enviados, acao);
}
