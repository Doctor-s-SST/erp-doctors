export type ViewType = "geral" | "pendencias" | "concluidos";

export type FiltroTipoExame = "todos" | "clinico" | "complementar";

export interface ExameResumido {
    descricaoExame?: string;
    nomeExame?: string;
    nome?: string;
    isPendente?: boolean;
    dataExame?: string;
}

export interface ArquivoGed {
    codigoArquivo?: string;
    nomeArquivo?: string;
    codigoTipoGed?: string;
    assinadoDigitalmente?: string;
    dataUpload?: string;
    horaUpload?: string;
    dataAssinaturaDigital?: string;
    horaAssinaturaDigital?: string;
    exameRelacao?: string[];
    criadoSocnet?: string;
    [key: string]: any;
}

export interface DocumentoGed {
    codigoEmpresa?: string;
    codigoUnidade?: string;
    unidade?: string;
    codigoGed: string;
    nomeGed: string;
    codigoFuncionario?: string;
    nomeFuncionario?: string;
    cpfFuncionario?: string;
    matriculaFuncionario?: string;
    dataFicha?: string;
    tipoFicha?: string;
    sequencialFicha?: string;
    dataEmissao?: string;
    dataValidade?: string;
    observacao?: string;
    arquivos?: (ArquivoGed | string)[];
    [key: string]: any;
}

export interface Aso {
    codigoGed?: string;
    dataCriacaoGed?: string;
    sequencialFicha?: string;
    dataAso?: string;
    dataFicha?: string;
    tipoAso?: string;
    resultadoAsoSoc?: string;
    medico?: string;
    crmMedico?: string;
    totalExames?: number;
    examesPendentes?: number;
    examesConcluidos?: number;
    listaExamesResumida?: ExameResumido[];
    [key: string]: any;
}

export interface Funcionario {
    jobId?: string;
    socStatus?: string;
    codigoEmpresa?: string;
    codigoFuncionario?: string;
    nomeFuncionario?: string;
    cpfFuncionario?: string;
    razaoSocial?: string;
    observacao?: string;
    aso?: Aso;
    documentosGed?: DocumentoGed[];
    // Propriades legadas/compatibilidade se necessário
    id?: string;
    cpf?: string;
    nome?: string;
    empresa?: string;
    [key: string]: any;
}

export interface Analytics {
    totalFuncionarios?: number;
    totalExames?: number;
    totalExamesPendentes?: number;
    totalExamesConcluidos?: number;
    mediaExamesPorFuncionario?: number;
    quantidadePorTipoExame?: Record<string, number>;
    distribuicaoStatusAso?: Record<string, number>;
    funcionariosComExamesPendentes?: any[];
    [key: string]: any;
}

export type FuncionarioItem = Funcionario;

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

export type PrazosMap = Record<
    string,
    {
        prazo_dias: number;
        tipo_filtro: "clinico" | "complementar" | "";
        ignorar_exame: boolean;
    }
>;

export interface ViewExamesPendentesProps {
    analytics: Analytics | null | undefined;
    todosFuncionarios: Funcionario[];
    filtroTipoExame: FiltroTipoExame;
    prazosMap: PrazosMap;

}

export interface ViewExamesConcluidosProps {
    todosFuncionarios: Funcionario[];
    funcionariosSalvos: Set<string>;
    onFuncionariosSalvos: (cpfs: string[]) => void;
    filtroTipoExame: FiltroTipoExame;
    unidadeId: string;
    prazosMap: PrazosMap;
}

export interface ViewDashboardProps {
    analytics: Analytics | null | undefined;
    todosFuncionarios: Funcionario[];
    filtroTipoExame: FiltroTipoExame;
    prazosMap: PrazosMap;
}

export interface FuncionarioModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    funcionario: Funcionario | null;
}

