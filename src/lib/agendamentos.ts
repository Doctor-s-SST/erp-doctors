/**
 * Agendamentos do SOC (tabela `agendamentos`, sincronizada pelo n8n).
 * Usado na recepção: aba Agendados do dia e busca por CPF/nome na ficha.
 * Ver docs/agendamentos.md.
 */

import { supabase } from "@/lib/supabase"

export interface AtendimentoDoAgendamento {
    senha_codigo: string | null
    status: string | null
    created_at: string | null
}

export interface Agendamento {
    id: string
    data: string
    horario: string | null
    codigo_empresa: string
    nome_empresa: string | null
    codigo_funcionario: string
    nome: string | null
    cpf: string | null
    tipo_compromisso: number | null
    sequencial_ficha: string | null
    atendimento_id: string | null
    removido_soc_em: string | null
    sincronizado_em: string
    atendimentos: AtendimentoDoAgendamento | null
}

export type SituacaoAgendado = "chegou" | "atrasado" | "aguardando" | "sem_horario" | "cancelado"

/** TIPOCOMPROMISSO do SOC. Acima de 900: ficha personalizada. */
const TIPO_COMPROMISSO: Record<number, string> = {
    1: "Periódico",
    2: "Admissional",
    3: "Retorno ao Trabalho",
    4: "Mudança de Função",
    5: "Demissional",
    6: "Monitoramento Pontual",
    10: "Consulta",
    12: "Acidente",
    13: "Licença Médica",
    14: "Enfermagem",
    20: "Terceiros",
    30: "Consulta Assistencial",
    50: "Odontológica",
}

export function rotuloTipoCompromisso(tipo: number | null): string {
    if (!tipo) return "—"
    if (tipo > 900) return "Ficha personalizada"
    return TIPO_COMPROMISSO[tipo] ?? `Tipo ${tipo}`
}

const FUSO = "America/Sao_Paulo"

/** Data de hoje em São Paulo (yyyy-mm-dd). */
export function hojeSaoPaulo(agora: Date = new Date()): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora)
}

/** Minutos desde a meia-noite em São Paulo. */
export function minutosAgoraSaoPaulo(agora: Date): number {
    const partes = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(agora)
    const hora = Number(partes.find((p) => p.type === "hour")?.value ?? 0) % 24
    const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? 0)
    return hora * 60 + minuto
}

export function minutosDoHorario(horario: string | null): number | null {
    const m = String(horario ?? "").match(/^(\d{1,2}):(\d{2})/)
    return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function formatarHorario(horario: string | null): string {
    const m = String(horario ?? "").match(/^(\d{1,2}):(\d{2})/)
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "—"
}

/** Situação do agendado no momento `agora`. */
export function situacaoAgendado(a: Agendamento, agora: Date): SituacaoAgendado {
    if (a.atendimento_id) return "chegou"
    if (a.removido_soc_em) return "cancelado"
    const minutos = minutosDoHorario(a.horario)
    if (minutos === null) return "sem_horario"
    return minutos < minutosAgoraSaoPaulo(agora) ? "atrasado" : "aguardando"
}

/** Agendados de hoje da unidade (inclusive os que saíram da agenda do SOC). */
export async function listarAgendadosDoDia(unidadeId: string): Promise<Agendamento[]> {
    const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data, horario, codigo_empresa, nome_empresa, codigo_funcionario, nome, cpf, tipo_compromisso, sequencial_ficha, atendimento_id, removido_soc_em, sincronizado_em, atendimentos(senha_codigo, status, created_at)")
        .eq("unidade_id", unidadeId)
        .eq("data", hojeSaoPaulo())
        .order("horario", { ascending: true, nullsFirst: false })
        .order("nome", { ascending: true })

    if (error) throw error
    return ((data || []) as unknown as (Omit<Agendamento, "atendimentos"> & { atendimentos: AtendimentoDoAgendamento | AtendimentoDoAgendamento[] | null })[])
        .map((a) => ({ ...a, atendimentos: Array.isArray(a.atendimentos) ? a.atendimentos[0] ?? null : a.atendimentos }))
}

/** Texto sem acentos, em minúsculas, para busca. */
export function normalizarBusca(texto: string | null | undefined): string {
    return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/** Filtra por nome, CPF, empresa ou sequencial. */
export function filtrarAgendados<T extends Agendamento>(lista: T[], termo: string): T[] {
    const t = normalizarBusca(termo)
    if (!t) return lista
    const digitos = t.replace(/\D/g, "")
    return lista.filter((a) =>
        normalizarBusca(a.nome).includes(t)
        || normalizarBusca(a.nome_empresa).includes(t)
        || (digitos.length >= 3 && ((a.cpf ?? "").includes(digitos) || (a.sequencial_ficha ?? "").includes(digitos)))
    )
}
