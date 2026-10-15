export interface EspecialidadeConfiguracao {
    id: string;
    nome: string;
}

export interface UsuarioConfiguracao {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name: string;
    email?: string | null;
    role?: string | null;
    ativo?: boolean | null;
    especialidade_id?: string | null;
    especialidade_nome: string;
    unidade_id?: string | null;
    [campo: string]: unknown;
}

export interface GrupoEspecialidadeItemConfiguracao {
    id: string;
    especialidade_id: string;
    obrigatoria?: boolean;
    excludente?: boolean;
    especialidades: EspecialidadeConfiguracao;
}

export interface GrupoEspecialidadeConfiguracao {
    id: string;
    nome: string;
    ativo?: boolean;
    tipo_filtro: "todos" | "algum" | "obrigatorio_mais_algum" | "apenas_do_grupo";
    grupo_especialidade_itens: GrupoEspecialidadeItemConfiguracao[];
}

export interface VinculoEspecialidade {
    id: string;
    especialidade_id: string;
}

export interface SalaConfiguracao {
    id: string;
    numero: string | number;
    andar: number;
    sala_especialidades: VinculoEspecialidade[];
    especialidades: string[];
}

export interface ProfissionalConfiguracao {
    id: string;
    nome: string;
    recepcao: boolean;
    ativo: boolean;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    profissional_especialidades: VinculoEspecialidade[];
}

export interface UnidadeConfiguracao {
    id: string;
    nome?: string | null;
    flag?: string | null;
    cnpj?: string | null;
    razao_social?: string | null;
    endereco?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    logo_url?: string | null;
    logo_icone_url?: string | null;
}
