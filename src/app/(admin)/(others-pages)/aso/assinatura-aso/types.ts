export interface Pacientes {
    id?: string;
    unidade_id?: string;
    nome_paciente: string;
    sequencial_ficha: string;
    created_at?: string;
    acao?: "ASSINADO" | "PENDENCIA" | "ENVIADO" | "ENVIADO_DIRETO" | "PENDENCIA_ENVIADA" | null;
    observacao?: string | null;
    codigo_empresa_soc?: string | null;
    codigo_ged_soc?: string | null;
    data_criacao_ged_soc?: string | null;
}

export type ConfigOrdenacao = {
    coluna: keyof Pacientes;
    direcao: "asc" | "desc";
};

export type TipoConfirmacao = "ASSINATURA" | "ENVIO" | "ENVIO_PENDENCIA" | "REENVIO_ASO" | null;

export type TipoFiltroStatus = "TODOS" | "ASSINAR" | "ENVIAR" | "PENDENCIA" | "ENVIADO";

export type TipoFiltroEnvio = "TODOS" | "ENVIADO" | "ENVIADO_DIRETO";

export type TipoFiltroParaEnviar = "TODOS" | "ASSINADO" | "PENDENCIA";

export interface ContadoresStatus {
    paraAssinar: number;
    paraEnviar: number;
    assinadosParaEnviar: number;
    pendenciasParaEnviar: number;
    pendencias: number;
    enviados: number;
    enviadosFluxo: number;
    enviadosDireto: number;
}
