/**
 * Cards por grupo de especialidades no dashboard diário.
 *
 * Usa a mesma regra da fila (`atendimentoPertenceAoGrupo`) sobre as mesmas
 * especialidades do atendimento (`atendimento_exames.sala`, todos os exames),
 * para que o card "Clínico (Térreo)" conte os mesmos pacientes que a fila
 * filtrada por esse grupo.
 *
 * Contagem por atendimento: um paciente atendido numa sala conta 1, mesmo que
 * a especialidade tenha mais de um exame.
 */

import {
    atendimentoPertenceAoGrupo,
    normalizarEspecialidade,
    type GrupoRegra,
} from "@/lib/grupos-especialidades"
import type { EspecialidadeDistribuicaoItem, SalaEspecialidadeItem } from "@/lib/dashboard-analytics"

export interface LinhaExameDashboard {
    atendimento_id: string | null
    sala: string | null
    num_sala: string | null
    status: string | null
    profissional: string | null
    iniciado_em: string | null
    finalizado_em: string | null
}

export interface EspecialidadeDashboard {
    id: string
    nome: string
    tempo_finalizacao_segundos: number | null
}

export interface CardGrupoDashboard {
    chave: string
    titulo: string
    especialidade: string
    aguardando: number
    total: number
    salas: (SalaEspecialidadeItem & { profissional?: string })[]
    foraDosGrupos?: boolean
}

const STATUS_ATENDIDO = new Set(["EM_ATENDIMENTO", "FINALIZADO"])

/** Especialidades (normalizadas) de cada atendimento, como a fila calcula. */
export function especialidadesPorAtendimento(linhas: LinhaExameDashboard[]): Map<string, string[]> {
    const mapa = new Map<string, string[]>()

    for (const linha of linhas) {
        if (!linha.atendimento_id || !linha.sala) continue
        const esp = normalizarEspecialidade(linha.sala)
        if (!esp) continue
        const lista = mapa.get(linha.atendimento_id) ?? []
        if (!lista.includes(esp)) lista.push(esp)
        mapa.set(linha.atendimento_id, lista)
    }

    return mapa
}

function montarCard(
    chave: string,
    titulo: string,
    especialidade: EspecialidadeDashboard,
    linhasEspecialidade: LinhaExameDashboard[],
    salasGerais: SalaEspecialidadeItem[],
    foraDosGrupos = false
): CardGrupoDashboard {
    const descontoMin = (especialidade.tempo_finalizacao_segundos ?? 0) / 60
    const aguardando = new Set<string>()
    const porSala = new Map<string, { atendimentos: Set<string>; minutos: number[]; profissional?: string; ultimo?: string }>()

    for (const linha of linhasEspecialidade) {
        const atendimentoId = linha.atendimento_id as string
        const status = (linha.status ?? "").toUpperCase()

        if (status === "AGUARDANDO") {
            aguardando.add(atendimentoId)
            continue
        }

        if (!STATUS_ATENDIDO.has(status)) continue

        const sala = (linha.num_sala ?? "").trim() || "Rotativo"
        const acc = porSala.get(sala) ?? { atendimentos: new Set<string>(), minutos: [] }
        acc.atendimentos.add(atendimentoId)

        if (status === "FINALIZADO" && linha.iniciado_em && linha.finalizado_em) {
            const minutos =
                (new Date(linha.finalizado_em).getTime() - new Date(linha.iniciado_em).getTime()) / 60000 - descontoMin
            acc.minutos.push(Math.max(minutos, 0))
        }

        const referencia = linha.iniciado_em ?? ""
        if (linha.profissional && (!acc.ultimo || referencia > acc.ultimo)) {
            acc.profissional = linha.profissional
            acc.ultimo = referencia
        }

        porSala.set(sala, acc)
    }

    const salas = Array.from(porSala.entries()).map(([nome, acc]) => {
        const geral = salasGerais.find((s) => String(s.nome).trim() === nome)
        const tempoMedio = acc.minutos.length
            ? Math.round((acc.minutos.reduce((a, b) => a + b, 0) / acc.minutos.length) * 10) / 10
            : 0

        return {
            nome,
            profissional: acc.profissional,
            total: acc.atendimentos.size,
            aguardando: aguardando.size,
            tempo_medio: tempoMedio,
            // Ociosidade é da sala (jornada do profissional), não do grupo: vem do card geral.
            ociosidade: geral?.ociosidade ?? 0,
        }
    })

    salas.sort((a, b) => {
        const na = /^\d+$/.test(a.nome) ? Number(a.nome) : 999
        const nb = /^\d+$/.test(b.nome) ? Number(b.nome) : 999
        return na - nb
    })

    return {
        chave,
        titulo,
        especialidade: especialidade.nome,
        aguardando: aguardando.size,
        total: salas.reduce((acc, s) => acc + s.total, 0),
        salas,
        foraDosGrupos,
    }
}

/**
 * Monta os cards por grupo, agrupados pelo nome da especialidade (como vem do
 * card geral do dashboard). Especialidades sem grupo de dashboard não aparecem
 * no mapa e continuam com o card geral.
 */
export function montarCardsPorGrupo(
    grupos: GrupoRegra[],
    especialidades: EspecialidadeDashboard[],
    linhas: LinhaExameDashboard[],
    distribuicao: EspecialidadeDistribuicaoItem[]
): Map<string, CardGrupoDashboard[]> {
    const resultado = new Map<string, CardGrupoDashboard[]>()
    const espAtendimento = especialidadesPorAtendimento(linhas)

    const gruposDashboard = grupos.filter((g) => g.exibir_dashboard === true && g.especialidade_fila_id)

    for (const especialidade of especialidades) {
        const gruposDaEspecialidade = gruposDashboard
            .filter((g) => g.especialidade_fila_id === especialidade.id)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

        if (gruposDaEspecialidade.length === 0) continue

        const nomeNormalizado = normalizarEspecialidade(especialidade.nome)
        const linhasEspecialidade = linhas.filter(
            (l) => l.atendimento_id && normalizarEspecialidade(l.sala) === nomeNormalizado
        )
        const salasGerais =
            distribuicao.find((d) => normalizarEspecialidade(d.especialidade) === nomeNormalizado)?.salas ?? []

        const atendimentosEmAlgumGrupo = new Set<string>()
        const cards: CardGrupoDashboard[] = gruposDaEspecialidade.map((grupo) => {
            const linhasGrupo = linhasEspecialidade.filter((l) => {
                const pertence = atendimentoPertenceAoGrupo(grupo, espAtendimento.get(l.atendimento_id as string) ?? [])
                if (pertence) atendimentosEmAlgumGrupo.add(l.atendimento_id as string)
                return pertence
            })

            return montarCard(grupo.id, grupo.nome, especialidade, linhasGrupo, salasGerais)
        })

        // Atendimentos da especialidade que não caem em nenhum grupo do dashboard
        // (por exemplo, uma especialidade nova que nenhum grupo cita).
        const linhasFora = linhasEspecialidade.filter((l) => !atendimentosEmAlgumGrupo.has(l.atendimento_id as string))
        if (linhasFora.length > 0) {
            const cardFora = montarCard(
                `${especialidade.id}-fora`,
                `${especialidade.nome} (fora dos grupos)`,
                especialidade,
                linhasFora,
                salasGerais,
                true
            )
            if (cardFora.total > 0 || cardFora.aguardando > 0) cards.push(cardFora)
        }

        resultado.set(nomeNormalizado, cards)
    }

    return resultado
}
