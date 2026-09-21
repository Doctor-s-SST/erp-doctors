export interface PrazoExame {
    id?: string;
    unidade_id?: string;
    nome_exame: string;
    prazo_dias: number;
    tipo_filtro?: string;
    ignorar_exame?: boolean;
}
