export type AtendimentoRecepcao = {
    id: string;
    senha_codigo: string;
    tipo_senha: string;
    nome: string;
    ficha_sequencial: string;
    created_at: string;
    status: string | null;
    guiche: string;
    atendente: string;
    tempo_espera_min: number;
    tempo_espera?: number;
    ficha_preenchida: boolean;
    tem_exames: unknown[];
    sala_atual?: string | null;
    num_sala?: string | null;
    profissional?: string | null;
    tipo_exame: string;
    encaixe: boolean;
    codigo_empresa: string;
};

export type ConfigOrdenacaoRecepcao = {
    coluna: keyof AtendimentoRecepcao | "tempo_espera";
    direcao: "asc" | "desc";
};

export type EspecialidadeRecepcao = {
    id: number;
    nome: string;
    exames?: Array<{ id?: number; nome: string }>;
};

export type ProfileRecepcao = {
    id?: string;
    role?: string;
    unidade_id?: string;
    first_name?: string;
    last_name?: string;
    unidades?: Array<{ flag?: string }> | { flag?: string } | null;
};
