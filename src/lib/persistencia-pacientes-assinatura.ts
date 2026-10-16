import { supabase } from "@/lib/supabase";
import type { PacienteAssinaturaPayload } from "@/lib/aso-assinatura";

export type ResultadoPersistenciaPacientes = {
    indicesPersistidos: number[];
    indicesComErro: number[];
};

async function localizarPacienteExistente(paciente: PacienteAssinaturaPayload) {
    const unidadeId = String(paciente.unidade_id || "").trim();
    const codigoEmpresa = String(paciente.codigo_empresa_soc || "").trim();
    const sequencialFicha = String(paciente.sequencial_ficha || "").trim();
    const codigoGed = String(paciente.codigo_ged_soc || "").trim();

    if (!unidadeId || !codigoEmpresa || (!sequencialFicha && !codigoGed)) return null;

    let consulta = supabase
        .from("pacientes_assinatura")
        .select("id")
        .eq("unidade_id", unidadeId)
        .eq("codigo_empresa_soc", codigoEmpresa);

    consulta = sequencialFicha
        ? consulta.eq("sequencial_ficha", sequencialFicha)
        : consulta.eq("codigo_ged_soc", codigoGed);

    const { data, error } = await consulta.limit(1).maybeSingle();
    if (error) throw error;
    return data?.id ? String(data.id) : null;
}

async function persistirPaciente(paciente: PacienteAssinaturaPayload) {
    const pacienteExistenteId = await localizarPacienteExistente(paciente);

    if (pacienteExistenteId) {
        const dadosAtualizados = { ...paciente };
        delete dadosAtualizados.id;

        const { data, error } = await supabase
            .from("pacientes_assinatura")
            .update(dadosAtualizados)
            .eq("id", pacienteExistenteId)
            .select("id")
            .single();

        if (error || !data?.id) {
            throw error || new Error("A atualização não foi confirmada pelo banco.");
        }
        return;
    }

    const { data, error } = await supabase
        .from("pacientes_assinatura")
        .insert(paciente)
        .select("id")
        .single();

    if (error || !data?.id) {
        throw error || new Error("A inserção não foi confirmada pelo banco.");
    }
}

/** Atualiza o ASO existente ou insere um novo, isolando eventuais falhas do restante do lote. */
export async function persistirPacientesAssinatura(
    pacientes: PacienteAssinaturaPayload[]
): Promise<ResultadoPersistenciaPacientes> {
    const resultado: ResultadoPersistenciaPacientes = {
        indicesPersistidos: [],
        indicesComErro: [],
    };
    const tamanhoBloco = 10;

    for (let inicio = 0; inicio < pacientes.length; inicio += tamanhoBloco) {
        const bloco = pacientes.slice(inicio, inicio + tamanhoBloco);
        const gravacoes = await Promise.allSettled(
            bloco.map(persistirPaciente)
        );

        gravacoes.forEach((gravacao, indiceBloco) => {
            const indice = inicio + indiceBloco;
            if (gravacao.status === "fulfilled") resultado.indicesPersistidos.push(indice);
            else resultado.indicesComErro.push(indice);
        });
    }

    return resultado;
}
