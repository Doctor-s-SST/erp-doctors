/**
 * Gestão de Tempo: tempo de atendimento por profissional e farol contra a meta
 * da especialidade (`especialidades.tempo_meta_minutos` e
 * `tolerancia_meta_percentual`).
 *
 * Duração de um atendimento = finalizado_em − iniciado_em − tempo de
 * finalização da especialidade (o contador de confirmação), a mesma conta da
 * get_dashboard_completo. Só entram etapas FINALIZADAS com início e fim.
 */

import { normalizarEspecialidade } from "@/lib/grupos-especialidades"

export type Farol = "verde" | "amarelo" | "vermelho" | "sem_meta"

export interface EspecialidadeMeta {
    id: string
    nome: string
    tempo_finalizacao_segundos: number | null
    tempo_meta_minutos: number | null
    tolerancia_meta_percentual: number | null
}

export interface LinhaTempo {
    id: string
    atendimento_id: string
    especialidade: string
    num_sala: string | null
    profissional: string | null
    iniciado_em: string
    finalizado_em: string
    senha: string | null
    paciente: string | null
}

export interface AtendimentoTempo extends LinhaTempo {
    profissionalNome: string
    minutos: number
    meta: number | null
    farol: Farol
}

export interface ResumoProfissional {
    chave: string
    especialidade: string
    profissional: string
    quantidade: number
    media: number
    minimo: number
    maximo: number
    verde: number
    amarelo: number
    vermelho: number
    meta: number | null
    tolerancia: number
    farol: Farol
}

export interface ResumoEspecialidade {
    especialidade: string
    meta: number | null
    tolerancia: number
    quantidade: number
    media: number
    profissionais: ResumoProfissional[]
}

export const PROFISSIONAL_NAO_DEFINIDO = "Não definido"

export function classificarFarol(minutos: number, meta: number | null, toleranciaPercentual: number): Farol {
    if (!meta || meta <= 0) return "sem_meta"
    if (minutos <= meta) return "verde"
    if (minutos <= meta * (1 + toleranciaPercentual / 100)) return "amarelo"
    return "vermelho"
}

function arredondar(valor: number): number {
    return Math.round(valor * 10) / 10
}

/** Formata minutos decimais como "12min 05s". */
export function formatarDuracao(minutos: number | null | undefined): string {
    if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return "—"
    const totalSegundos = Math.max(0, Math.round(minutos * 60))
    const h = Math.floor(totalSegundos / 3600)
    const m = Math.floor((totalSegundos % 3600) / 60)
    const s = totalSegundos % 60
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`
    return `${m}min ${s.toString().padStart(2, "0")}s`
}

export function calcularGestaoTempo(linhas: LinhaTempo[], especialidades: EspecialidadeMeta[]) {
    const porNome = new Map(especialidades.map((e) => [normalizarEspecialidade(e.nome), e]))

    const atendimentos: AtendimentoTempo[] = []
    for (const linha of linhas) {
        const esp = porNome.get(normalizarEspecialidade(linha.especialidade))
        const desconto = (esp?.tempo_finalizacao_segundos ?? 0) / 60
        const bruto = (new Date(linha.finalizado_em).getTime() - new Date(linha.iniciado_em).getTime()) / 60000
        if (!Number.isFinite(bruto)) continue

        const minutos = Math.max(bruto - desconto, 0)
        const meta = esp?.tempo_meta_minutos ? Number(esp.tempo_meta_minutos) : null
        const tolerancia = esp?.tolerancia_meta_percentual ?? 20

        atendimentos.push({
            ...linha,
            especialidade: esp?.nome ?? linha.especialidade,
            profissionalNome: linha.profissional?.trim() || PROFISSIONAL_NAO_DEFINIDO,
            minutos,
            meta,
            farol: classificarFarol(minutos, meta, tolerancia),
        })
    }

    const grupos = new Map<string, AtendimentoTempo[]>()
    for (const a of atendimentos) {
        const chave = `${a.especialidade}::${a.profissionalNome}`
        const lista = grupos.get(chave) ?? []
        lista.push(a)
        grupos.set(chave, lista)
    }

    const profissionais: ResumoProfissional[] = Array.from(grupos.entries()).map(([chave, lista]) => {
        const esp = porNome.get(normalizarEspecialidade(lista[0].especialidade))
        const meta = lista[0].meta
        const tolerancia = esp?.tolerancia_meta_percentual ?? 20
        const minutos = lista.map((a) => a.minutos)
        const media = minutos.reduce((acc, v) => acc + v, 0) / minutos.length

        return {
            chave,
            especialidade: lista[0].especialidade,
            profissional: lista[0].profissionalNome,
            quantidade: lista.length,
            media: arredondar(media),
            minimo: arredondar(Math.min(...minutos)),
            maximo: arredondar(Math.max(...minutos)),
            verde: lista.filter((a) => a.farol === "verde").length,
            amarelo: lista.filter((a) => a.farol === "amarelo").length,
            vermelho: lista.filter((a) => a.farol === "vermelho").length,
            meta,
            tolerancia,
            farol: classificarFarol(media, meta, tolerancia),
        }
    })

    const especialidadesResumo: ResumoEspecialidade[] = Array.from(
        new Set(profissionais.map((p) => p.especialidade))
    )
        .map((nome) => {
            const lista = profissionais
                .filter((p) => p.especialidade === nome)
                .sort((a, b) => b.media - a.media)
            const quantidade = lista.reduce((acc, p) => acc + p.quantidade, 0)
            const soma = lista.reduce((acc, p) => acc + p.media * p.quantidade, 0)

            return {
                especialidade: nome,
                meta: lista[0]?.meta ?? null,
                tolerancia: lista[0]?.tolerancia ?? 20,
                quantidade,
                media: quantidade ? arredondar(soma / quantidade) : 0,
                profissionais: lista,
            }
        })
        .sort((a, b) => a.especialidade.localeCompare(b.especialidade, "pt-BR"))

    return { atendimentos, profissionais, especialidades: especialidadesResumo }
}
