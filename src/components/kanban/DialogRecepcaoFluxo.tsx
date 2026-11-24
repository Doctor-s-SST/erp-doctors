"use client"

/**
 * Configurações da recepção abertas pelo nó "Recepção" do Fluxo do Kanban.
 * Grava nas mesmas colunas de `unidades` usadas em Configurações > Unidade >
 * Atendimento (as duas telas editam o mesmo dado).
 */

import { useEffect, useState } from "react"
import { Loader2, Save, UserRound } from "lucide-react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface ConfigRecepcao {
    tempo_meta_recepcao_minutos: number | null
    tolerancia_meta_recepcao_percentual: number
    tempo_finalizacao_encaixe_minutos: number
}

export const CONFIG_RECEPCAO_PADRAO: ConfigRecepcao = {
    tempo_meta_recepcao_minutos: null,
    tolerancia_meta_recepcao_percentual: 20,
    tempo_finalizacao_encaixe_minutos: 30,
}

/** Lê a configuração da recepção da unidade (select "*": funciona antes dos SQLs). */
export async function carregarConfigRecepcao(unidadeId: string): Promise<ConfigRecepcao> {
    const { data } = await supabase.from("unidades").select("*").eq("id", unidadeId).single()
    return {
        tempo_meta_recepcao_minutos: data?.tempo_meta_recepcao_minutos ?? null,
        tolerancia_meta_recepcao_percentual: data?.tolerancia_meta_recepcao_percentual ?? 20,
        tempo_finalizacao_encaixe_minutos: data?.tempo_finalizacao_encaixe_minutos ?? 30,
    }
}

interface Props {
    unidadeId: string | null
    aberto: boolean
    config: ConfigRecepcao
    onAbertoChange: (aberto: boolean) => void
    onSalvo: (config: ConfigRecepcao) => void
}

const CLASSE_INPUT = "h-11 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold text-xs"
const CLASSE_LABEL = "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1"

export function DialogRecepcaoFluxo({ unidadeId, aberto, config, onAbertoChange, onSalvo }: Props) {
    const [meta, setMeta] = useState("")
    const [tolerancia, setTolerancia] = useState("20")
    const [encaixe, setEncaixe] = useState("30")
    const [salvando, setSalvando] = useState(false)

    // Ao abrir, carrega os valores atuais no formulário.
    useEffect(() => {
        if (!aberto) return
        const timer = setTimeout(() => {
            setMeta(config.tempo_meta_recepcao_minutos != null ? String(config.tempo_meta_recepcao_minutos) : "")
            setTolerancia(String(config.tolerancia_meta_recepcao_percentual))
            setEncaixe(String(config.tempo_finalizacao_encaixe_minutos))
        }, 0)
        return () => clearTimeout(timer)
    }, [aberto, config])

    const salvar = async () => {
        if (!unidadeId) return

        const metaNum = meta.trim() ? Number(meta.replace(",", ".")) : null
        const toleranciaNum = tolerancia.trim() ? Number(tolerancia) : 20
        const encaixeNum = Number(encaixe)

        if (metaNum !== null && (!Number.isFinite(metaNum) || metaNum <= 0)) {
            toast.error("A meta da recepção deve ser maior que zero.")
            return
        }
        if (!Number.isInteger(toleranciaNum) || toleranciaNum < 0 || toleranciaNum > 500) {
            toast.error("A tolerância deve ser um número inteiro entre 0 e 500.")
            return
        }
        if (!Number.isInteger(encaixeNum) || encaixeNum < 1 || encaixeNum > 240) {
            toast.error("O tempo do encaixe deve ser um número inteiro entre 1 e 240 minutos.")
            return
        }

        const novo: ConfigRecepcao = {
            tempo_meta_recepcao_minutos: metaNum,
            tolerancia_meta_recepcao_percentual: toleranciaNum,
            tempo_finalizacao_encaixe_minutos: encaixeNum,
        }

        setSalvando(true)
        const { error } = await supabase.from("unidades").update(novo).eq("id", unidadeId)
        setSalvando(false)

        if (error) {
            toast.error("Erro ao salvar a recepção: " + error.message)
            return
        }

        toast.success("Recepção atualizada")
        onSalvo(novo)
        onAbertoChange(false)
    }

    return (
        <Dialog open={aberto} onOpenChange={onAbertoChange}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl p-6">
                <DialogHeader className="space-y-3">
                    <div className="mx-auto w-fit rounded-2xl bg-blue-500/10 p-3">
                        <UserRound className="h-8 w-8 text-blue-500" />
                    </div>
                    <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
                        Recepção
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs">
                        Mesmas configurações de Configurações &gt; Unidade &gt; Atendimento.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <section className="space-y-3">
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Finalização</h4>
                            <p className="text-[11px] text-slate-500">Atendimento normal: 30 segundos. Encaixe: o tempo abaixo.</p>
                        </div>
                        <div className="space-y-1.5 sm:max-w-[12rem]">
                            <Label className={CLASSE_LABEL}>Encaixe (min)</Label>
                            <Input type="number" min={1} max={240} step={1} className={CLASSE_INPUT} value={encaixe} onChange={(e) => setEncaixe(e.target.value)} />
                        </div>
                    </section>

                    <section className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Meta de tempo</h4>
                            <p className="text-[11px] text-slate-500">Farol da Gestão de Produtividade e alerta de atendimento prolongado.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className={CLASSE_LABEL}>Meta (min)</Label>
                                <Input type="number" min={0.5} step={0.5} placeholder="Sem meta" className={CLASSE_INPUT} value={meta} onChange={(e) => setMeta(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className={CLASSE_LABEL}>Tolerância (%)</Label>
                                <Input type="number" min={0} max={500} step={1} className={CLASSE_INPUT} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
                            </div>
                        </div>
                    </section>
                </div>

                <Button
                    onClick={() => void salvar()}
                    disabled={salvando}
                    className="h-12 w-full bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-500"
                >
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salvar</>}
                </Button>
            </DialogContent>
        </Dialog>
    )
}
