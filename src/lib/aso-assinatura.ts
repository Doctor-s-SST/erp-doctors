export type AcaoAso =
    | "CONCLUIDO"
    | "LIBERAR"
    | "LIBERAR-ENVIAR"
    | "ENVIAR-PENDENCIA"
    | "ASSINADO"
    | "PENDENCIA"
    | "ENVIADO"
    | "REENVIAR-ASO"
    | "REENVIAR-PENDENCIA";

export interface PacienteAssinaturaPayload {
    id?: string;
    unidade_id?: string;
    nome_paciente: string;
    sequencial_ficha: string;
    codigo_empresa_soc?: string | null;
    codigo_ged_soc?: string | null;
    data_criacao_ged_soc?: string | null;
    acao?: "ASSINADO" | "PENDENCIA" | "ENVIADO" | "ENVIADO_DIRETO" | "PENDENCIA_ENVIADA" | null;
    observacao?: string | null;
    created_at?: string;
    ativo?: boolean;
}

function comoObjeto(valor: unknown): Record<string, unknown> {
    return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

function primeiroValor(...valores: unknown[]): string | null {
    const valor = valores.find((item) => item !== undefined && item !== null && item !== "");
    return valor === undefined ? null : String(valor);
}

export function criarPacienteAssinatura(
    funcionario: Record<string, unknown>,
    unidadeId: string
): PacienteAssinaturaPayload {
    const socResumo = comoObjeto(funcionario.socResumo);
    const aso = comoObjeto(funcionario.aso || socResumo.aso || funcionario.socResumo);

    return {
        nome_paciente: primeiroValor(
            funcionario.nome_paciente ||
            funcionario.nomeFuncionario ||
            funcionario.nome ||
            aso.nomeFuncionario
        ) || "",
        sequencial_ficha: primeiroValor(
            funcionario.sequencial_ficha ||
            aso.sequencialFicha ||
            funcionario.sequencialFicha
        ) || "",
        codigo_empresa_soc: primeiroValor(
            funcionario.codigo_empresa_soc ||
            funcionario.codigoEmpresa ||
            aso.codigoEmpresa
        ),
        codigo_ged_soc: primeiroValor(
            funcionario.codigo_ged_soc ||
            aso.codigoGed ||
            funcionario.codigoGed
        ),
        data_criacao_ged_soc: primeiroValor(
            funcionario.data_criacao_ged_soc ||
            aso.dataCriacaoGed ||
            funcionario.dataCriacaoGed
        ),
        unidade_id: primeiroValor(funcionario.unidade_id, unidadeId) || unidadeId,
        acao: null,
        observacao: null,
    };
}

export function criarPayloadAcaoAso(
    pacientes: PacienteAssinaturaPayload[],
    acao: AcaoAso,
    observacao?: string
) {
    return {
        selecionados: pacientes.map((paciente) => {
            const dadosPaciente = { ...paciente };
            delete dadosPaciente.acao;
            delete dadosPaciente.observacao;
            delete dadosPaciente.ativo;

            return {
                paciente: dadosPaciente,
                acao,
                observacao: observacao || null,
            };
        }),
    };
}


export function criarPayloadAcoesAso(
    itens: Array<{
        paciente: PacienteAssinaturaPayload;
        acao: AcaoAso;
        observacao?: string;
    }>
) {
    return {
        selecionados: itens.map(({ paciente, acao, observacao }) => {
            const dadosPaciente = { ...paciente };
            delete dadosPaciente.acao;
            delete dadosPaciente.observacao;
            delete dadosPaciente.ativo;

            return {
                paciente: dadosPaciente,
                acao,
                observacao: observacao || null,
            };
        }),
    };
}
