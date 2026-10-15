export interface ProfileData {
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    unidade_id?: string;
    especialidade: { nome: string };
}

export interface SenhasProfile {
    atual: string;
    nova: string;
    confirmacao: string;
}
