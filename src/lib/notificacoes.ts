/**
 * Notificações do sino do cabeçalho.
 *
 * Os alertas de tempo (paciente parado e atendimento prolongado) são gravados
 * pela função do banco `gerar_alertas_tempo`, que o navegador do admin chama a
 * cada minuto. A leitura usa as tabelas `notificacoes` (por unidade, sob RLS) e
 * `notificacoes_lidas` (por usuário; `oculta` = o usuário limpou do sino).
 * Tipos de alerta desligados na unidade não aparecem no sino.
 */

import { supabase } from "@/lib/supabase"

export type TipoNotificacao =
    | "ATENDIMENTO_PROLONGADO"
    | "RECEPCAO_PROLONGADA"
    | "PACIENTE_PARADO"
    | string

export interface Notificacao {
    id: string
    tipo: TipoNotificacao
    titulo: string
    mensagem: string | null
    atendimento_id: string | null
    created_at: string
    lida: boolean
}

export const LIMITE_NOTIFICACOES = 50

/** Coluna de `unidades` que liga cada tipo de alerta. */
export const COLUNA_TIPO_ALERTA: Record<string, string> = {
    PACIENTE_PARADO: "alerta_paciente_parado_ativo",
    ATENDIMENTO_PROLONGADO: "alerta_atendimento_prolongado_ativo",
    RECEPCAO_PROLONGADA: "alerta_recepcao_prolongada_ativo",
}

/** Tipos de alerta desligados na unidade (vazio se as colunas ainda não existirem). */
async function tiposDesligados(unidadeId: string): Promise<string[]> {
    const { data } = await supabase.from("unidades").select("*").eq("id", unidadeId).maybeSingle()
    if (!data) return []
    const unidade = data as Record<string, unknown>
    return Object.entries(COLUNA_TIPO_ALERTA)
        .filter(([, coluna]) => unidade[coluna] === false)
        .map(([tipo]) => tipo)
}

/** Grava os alertas de tempo pendentes. Devolve false se a função ainda não existir no banco. */
export async function gerarAlertasTempo(unidadeId: string): Promise<boolean> {
    const { error } = await supabase.rpc("gerar_alertas_tempo", { p_unidade_id: unidadeId })
    if (!error) return true
    if (error.code === "PGRST202" || error.code === "42883") return false
    console.error("Erro ao gerar alertas de tempo:", error)
    return true
}

/** Últimas notificações da unidade, marcando as lidas e tirando as que o usuário limpou. */
export async function listarNotificacoes(usuarioId: string, unidadeId: string): Promise<Notificacao[] | null> {
    const desligados = await tiposDesligados(unidadeId)
    let consulta = supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, atendimento_id, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMITE_NOTIFICACOES)
    if (desligados.length) consulta = consulta.not("tipo", "in", `(${desligados.join(",")})`)
    const { data, error } = await consulta

    if (error) {
        // Tabela ainda não criada (SQL não aplicado): o sino fica sem itens.
        if (error.code !== "42P01" && error.code !== "PGRST205") console.error("Erro ao listar notificações:", error)
        return null
    }

    const ids = (data || []).map((n) => n.id)
    const lidas = new Set<string>()
    const ocultas = new Set<string>()
    if (ids.length) {
        // "*" para funcionar antes e depois da coluna "oculta" existir.
        const { data: leituras } = await supabase
            .from("notificacoes_lidas")
            .select("*")
            .eq("usuario_id", usuarioId)
            .in("notificacao_id", ids)
        for (const l of leituras || []) {
            lidas.add(l.notificacao_id)
            if (l.oculta) ocultas.add(l.notificacao_id)
        }
    }

    return (data || [])
        .filter((n) => !ocultas.has(n.id))
        .map((n) => ({ ...n, lida: lidas.has(n.id) }))
}

/** Limpa notificações do sino do usuário (continuam no banco para os demais). */
export async function limparNotificacoes(usuarioId: string, ids: string[]): Promise<boolean> {
    if (!ids.length) return true
    const { error } = await supabase
        .from("notificacoes_lidas")
        .upsert(
            ids.map((id) => ({ notificacao_id: id, usuario_id: usuarioId, oculta: true })),
            { onConflict: "notificacao_id,usuario_id" }
        )
    if (error) {
        console.error("Erro ao limpar notificações:", error)
        return false
    }
    return true
}

export async function marcarComoLidas(usuarioId: string, ids: string[]): Promise<void> {
    if (!ids.length) return
    const { error } = await supabase
        .from("notificacoes_lidas")
        .upsert(
            ids.map((id) => ({ notificacao_id: id, usuario_id: usuarioId })),
            { onConflict: "notificacao_id,usuario_id", ignoreDuplicates: true }
        )
    if (error) console.error("Erro ao marcar notificações como lidas:", error)
}
