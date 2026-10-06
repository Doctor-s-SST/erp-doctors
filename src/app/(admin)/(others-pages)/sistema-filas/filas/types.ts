export type Especialidade = { id: string; nome: string };

export type SalaEspecialidade = { especialidade_id: string };

export type SalaSelecao = {
  id: string;
  numero: string;
  sala_especialidades: SalaEspecialidade[];
};

export type ProfissionalEspecialidade = { especialidade_id: string };

export type ProfissionalFila = {
  id: string;
  nome: string;
  ativo?: boolean;
  especialidade_id?: string;
  profissional_especialidades: ProfissionalEspecialidade[];
};

export type ItemFila = {
  finaliza_em?: string | null;
  tipo_senha: string;
  id: string;
  atendimento_id: string;
  senha: string;
  nome: string;
  empresa_razao: string;
  codigo_empresa: string;
  status: string;
  status_atendimento: string;
  created_at: string;
  ficha_sequencial: string;
  num_sala?: string | null;
  tempo_espera_inicial?: number;
  observacao?: string;
  bloqueado?: boolean;
  sala?: string;
  profissional?: string;
  especialidade_nome?: string;
  sala_atual?: string;
  ultimo_atendimento?: string | null;
};

export type ColunaOrdenacaoFila = keyof ItemFila | "tempo_espera";

export type ConfigOrdenacaoFila = {
  coluna: ColunaOrdenacaoFila;
  direcao: "asc" | "desc";
};

export type ExameFila = {
  data?: string;
  exame: string;
  exame_id?: string;
  realizado?: boolean;
  obrigatorio_checkbox?: boolean;
};

export type ParametrosAcaoFila = Record<string, unknown> & {
  p_atendimento_id: string;
  p_atendimento_exame_id?: string;
};

export type GrupoEspecialidadeItem = {
  especialidade_id: string;
  obrigatoria: boolean;
  excludente?: boolean;
  especialidades: { id: string; nome: string };
};

export type GrupoEspecialidade = {
  id: string;
  nome: string;
  tipo_filtro: "todos" | "algum" | "obrigatorio_mais_algum" | "apenas_do_grupo";
  grupo_especialidade_itens: GrupoEspecialidadeItem[];
};
