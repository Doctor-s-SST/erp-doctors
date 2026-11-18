/**
 * Notificações do sino do cabeçalho.
 *
 * Os alertas de tempo (paciente parado e atendimento prolongado) são gravados
 * pela função do banco `gerar_alertas_tempo`, que o navegador do admin chama a
 * cada minuto. A leitura usa as tabelas `notificacoes` (por unidade, sob RLS) e
 * `notificacoes_lidas` (por usuário).
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

/** Grava os alertas de tempo pendentes. Devolve false se a função ainda não existir no banco. */
export async function gerarAlertasTempo(unidadeId: string): Promise<boolean> {
    const { error } = await supabase.rpc("gerar_alertas_tempo", { p_unidade_id: unidadeId })
    if (!error) return true
    if (error.code === "PGRST202" || error.code === "42883") return false
    console.error("Erro ao gerar alertas de tempo:", error)
    return true
}

/** Últimas notificações da unidade, marcando as que o usuário já leu. */
export async function listarNotificacoes(usuarioId: string): Promise<Notificacao[] | null> {
    const { data, error } = await supabase
        .from("notificacoes")
        .select("id, tipo, titulo, mensagem, atendimento_id, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMITE_NOTIFICACOES)

    if (error) {
        // Tabela ainda não criada (SQL não aplicado): o sino fica sem itens.
        if (error.code !== "42P01" && error.code !== "PGRST205") console.error("Erro ao listar notificações:", error)
        return null
    }

    const ids = (data || []).map((n) => n.id)
    const lidas = new Set<string>()
    if (ids.length) {
        const { data: leituras } = await supabase
            .from("notificacoes_lidas")
            .select("notificacao_id")
            .eq("usuario_id", usuarioId)
            .in("notificacao_id", ids)
        for (const l of leituras || []) lidas.add(l.notificacao_id)
    }

    return (data || []).map((n) => ({ ...n, lida: lidas.has(n.id) }))
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
