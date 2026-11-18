/**
 * Contadores de finalização (recepção e especialidades) gravados no banco.
 *
 * O prazo fica em `atendimentos.finaliza_recepcao_em` (recepção) e em
 * `atendimento_exames.finaliza_em` (especialidades). A função do banco
 * `processar_finalizacoes_vencidas` conclui os que venceram; ela é chamada a cada
 * 15 s por qualquer tela aberta do sistema e na hora pela fila e pela recepção.
 * Assim, recarregar ou sair da tela não perde a finalização.
 */

import { supabase } from "@/lib/supabase"

export const INTERVALO_PROCESSAMENTO_MS = 15_000

/** Contador padrão da recepção (atendimento normal), em segundos. */
export const TEMPO_FINALIZACAO_RECEPCAO_S = 30

/** Contador padrão da recepção para encaixe, em minutos (configurável na unidade). */
export const TEMPO_FINALIZACAO_ENCAIXE_PADRAO_MIN = 30

let funcaoDisponivel = true
let emAndamento: Promise<number> | null = null

/**
 * Conclui os contadores vencidos da unidade. Chamadas simultâneas na mesma
 * aba compartilham a mesma requisição. Devolve quantos foram concluídos.
 */
export function processarFinalizacoesVencidas(unidadeId: string): Promise<number> {
    if (!funcaoDisponivel || !unidadeId) return Promise.resolve(0)
    if (emAndamento) return emAndamento

    emAndamento = (async () => {
        const { data, error } = await supabase.rpc("processar_finalizacoes_vencidas", { p_unidade_id: unidadeId })
        if (error) {
            // Função ainda não criada (SQL não aplicado): para de tentar nesta aba.
            if (error.code === "PGRST202" || error.code === "42883") funcaoDisponivel = false
            else console.error("Erro ao processar finalizações vencidas:", error)
            return 0
        }
        return typeof data === "number" ? data : 0
    })().finally(() => {
        emAndamento = null
    })

    return emAndamento
}

/** "29m 59s", "45s". */
export function formatarContador(segundos: number): string {
    const s = Math.max(0, Math.ceil(segundos))
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${(s % 60).toString().padStart(2, "0")}s`
}
