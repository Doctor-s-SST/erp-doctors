"use client"

import { useEffect } from "react"

import { INTERVALO_PROCESSAMENTO_MS, processarFinalizacoesVencidas } from "@/lib/finalizacoes"

/**
 * Sem interface: enquanto qualquer tela do sistema estiver aberta, conclui a
 * cada 15 s os contadores de finalização vencidos da unidade (recepção e
 * especialidades), mesmo que a tela da fila ou da recepção tenha sido fechada.
 */
export function ProcessadorFinalizacoes({ unidadeId }: { unidadeId: string }) {
    useEffect(() => {
        if (!unidadeId) return
        const timer = setInterval(() => void processarFinalizacoesVencidas(unidadeId), INTERVALO_PROCESSAMENTO_MS)
        return () => clearInterval(timer)
    }, [unidadeId])

    return null
}
