export type ViewType = "geral" | "pendencias" | "concluidos";

export type FiltroTipoExame = "todos" | "clinico" | "complementar";

export interface ExameResumido {
    descricaoExame?: string;
    nomeExame?: string;
    nome?: string;
    isPendente?: boolean;
    dataExame?: string;
}

export interface FuncionarioItem {
    id?: string;
    cpf?: string;
    cpfFuncionario?: string;
    nome?: string;
    nomeFuncionario?: string;
    empresa?: string;
    razaoSocial?: string;
    codigoEmpresa?: string;
    codigoGed?: string;
    codigoFuncionario?: string;
    dataAso?: string | null;
    dataPedido?: string | null;
    dataFicha?: string | null;
    resultadoAsoSoc?: string;
    medico?: string;
    crmMedico?: string;
    observacao?: string;
    totalExames?: number;
    examesPendentes?: number | string[] | any[];
    examesConcluidos?: number;
    sequencialFicha?: string;
    sequencial_ficha?: string;
    tipoAso?: string;
    unidade?: string;
    listaExamesResumida?: (ExameResumido | string | any)[];
    socResumo?: any;
    [key: string]: any;
}

export interface StatusVencimentoVisual {
    label: string;
    color: string;
    estaVencido: boolean;
}

export interface FuncionarioPendenteProcessado extends FuncionarioItem {
    examesList: string[];
    maiorPrazo: number | null;
    statusVencimento: StatusVencimentoVisual;
}

export type PrazosMap = Record<string, number>;

export interface ViewExamesPendentesProps {
    analytics: any;
    todosFuncionarios: any[];
    filtroTipoExame: FiltroTipoExame;
}

export interface ViewExamesConcluidosProps {
    todosFuncionarios: any[];
    funcionariosSalvos: Set<string>;
    onFuncionariosSalvos: (cpfs: string[]) => void;
    filtroTipoExame: FiltroTipoExame;
    unidadeId: string;
}

export interface ViewDashboardProps {
    analytics: any;
    todosFuncionarios: any[];
    filtroTipoExame: FiltroTipoExame;
    prazosMap: PrazosMap;
}

export interface FuncionarioModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    funcionario: any;
}
