export interface Pacientes {
    id?: string;
    unidade_id?: string;
    nome_paciente: string;
    sequencial_ficha: string;
    created_at?: string;
    acao?: "ASSINADO" | "PENDENCIA" | "ENVIADO" | null;
    observacao?: string | null;
}

export type ConfigOrdenacao = {
    coluna: keyof Pacientes;
    direcao: "asc" | "desc";
};

export type TipoConfirmacao = "ASSINATURA" | "ENVIO" | null;

export type TipoFiltroStatus = "TODOS" | "ASSINAR" | "ENVIAR" | "PENDENCIA" | "ENVIADO";

export interface ContadoresStatus {
    paraAssinar: number;
    paraEnviar: number;
    pendencias: number;
    enviados: number;
}
