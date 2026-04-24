export interface DashboardCards {
  geradas: number
  acumulado: number
  em_atendimento: number
  aguardando: number
  finalizadas: number
  cancelados: number
}

export interface FluxoHoraItem {
  hora: number
  total: number
}

export interface HeatmapHoraDiaItem {
  dia: string
  hora: number
  total: number
}

export interface RecepcaoItem {
  nome: string
  total: number
  aguardando: number
  tempo_medio: number
}

export interface SalaEspecialidadeItem {
  nome: string
  total: number
  aguardando: number
  tempo_medio: number
  ociosidade: number
}

export interface EspecialidadeDistribuicaoItem {
  especialidade: string
  total: number
  media_min: number
  aguardando: number
  salas: SalaEspecialidadeItem[]
}

export interface PermanenciaItem {
  media_minutos: number | null
  total_amostras: number
}

export interface DashboardAnalytics {
  cards: DashboardCards
  series: {
    fluxoHora: FluxoHoraItem[]
    heatmapHoraDia: HeatmapHoraDiaItem[]
  }
  distribuicoes: {
    recepcao: RecepcaoItem[]
    especialidades: EspecialidadeDistribuicaoItem[]
    salasTodas: { sala: string; especialidade: string; total: number }[]
  }
  pacientes: {
    topEmpresas: { empresa: string; total: number }[]
    tipoAtendimento: { tipo: string; total: number }[]
  }
  tempos: {
    permanencia: PermanenciaItem
  }
}

export interface DashboardPayload {
  analytics?: DashboardAnalytics
  cards?: DashboardCards
  fluxoHora?: FluxoHoraItem[]
  recepcao?: RecepcaoItem[]
  especialidadesDetalhado?: EspecialidadeDistribuicaoItem[]
  tempoPermanencia?: PermanenciaItem
  topEmpresas?: { empresa: string; total: number }[]
  tipoAtendimento?: { tipo: string; total: number }[]
  salasTodas?: { sala: string; especialidade: string; total: number }[]
}

export function resolveDashboardAnalytics(data: DashboardPayload | null | undefined): DashboardAnalytics {
  const cards = data?.analytics?.cards ?? data?.cards ?? {
    geradas: 0,
    acumulado: 0,
    em_atendimento: 0,
    aguardando: 0,
    finalizadas: 0,
    cancelados: 0,
  }

  const especialidades =
    data?.analytics?.distribuicoes?.especialidades ??
    data?.especialidadesDetalhado ??
    []

  return {
    cards,
    series: {
      fluxoHora: data?.analytics?.series?.fluxoHora ?? data?.fluxoHora ?? [],
      heatmapHoraDia: data?.analytics?.series?.heatmapHoraDia ?? [],
    },
    distribuicoes: {
      recepcao: data?.analytics?.distribuicoes?.recepcao ?? data?.recepcao ?? [],
      especialidades,
      salasTodas:
        data?.analytics?.distribuicoes?.salasTodas ??
        data?.salasTodas ??
        especialidades.flatMap((esp) =>
          (esp.salas || []).map((sala) => ({
            sala: sala.nome,
            especialidade: esp.especialidade,
            total: sala.total ?? 0,
          }))
        ),
    },
    pacientes: {
      topEmpresas: data?.analytics?.pacientes?.topEmpresas ?? data?.topEmpresas ?? [],
      tipoAtendimento: data?.analytics?.pacientes?.tipoAtendimento ?? data?.tipoAtendimento ?? [],
    },
    tempos: {
      permanencia: data?.analytics?.tempos?.permanencia ??
        data?.tempoPermanencia ?? {
          media_minutos: null,
          total_amostras: 0,
        },
    },
  }
}
