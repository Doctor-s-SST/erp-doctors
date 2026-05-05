"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase" // Ajuste o caminho conforme seu projeto
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, Circle, MapPin, User, FileText, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface StatusSenhaFilasProps {
  isOpen: boolean
  onClose: () => void
  atendimento: any 
}

export function StatusSenhaFilas({ isOpen, onClose, atendimento }: StatusSenhaFilasProps) {
  const [roteiro, setRoteiro] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && atendimento?.id) {
      fetchRoteiroAtendimento()
    }
  }, [isOpen, atendimento])

  async function fetchRoteiroAtendimento() {
    setLoading(true)
    try {
      // Buscamos as salas/especialidades vinculadas a este atendimento
      const { data, error } = await supabase
        .from("atendimento_exames")
        .select("id, sala, status, num_sala, iniciado_em, finalizado_em")
        .eq("atendimento_id", atendimento.atendimento_id)
        .order("sala", { ascending: true })

      if (error) throw error
      setRoteiro(data || [])
    } catch (error) {
      console.error("Erro ao buscar roteiro:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusStep = (status: string) => {
    switch (status) {
      case 'FINALIZADO':
        return { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, color: 'border-l-4 border-l-emerald-600', bg: 'bg-emerald-600',  text: 'Finalizado' }
      case 'EM_ATENDIMENTO':
        return { icon: <Clock className="w-4 h-4 text-amber-500 animate-pulse" />, color: 'border-l-4 border-l-amber-600', bg: 'bg-amber-600', text: 'Em Atendimento' }
      default:
        return { icon: <Circle className="w-4 h-4 text-gray-600" />, color: 'border-l-4 border-l-gray-600', bg: 'bg-gray-600', text: 'Aguardando' }
    }
  }

  if (!atendimento) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-fit md:max-w-fit lg:max-w-fit bg-white dark:bg-gray-900 border-none shadow-2xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight pr-8">
            <User className="w-6 h-6 text-blue-500" />
            {atendimento.nome}
          </DialogTitle>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
              <FileText className="w-3 h-3" /> Ficha: {atendimento.ficha_sequencial || 'N/A'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
              <Clock className="w-3 h-3" /> Chegada: {new Date(atendimento.created_at).toLocaleTimeString()}
            </div>
            {atendimento.observacao && 
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase">
              <Clock className="w-3 h-3" /> Observação: {atendimento.observacao}
            </div>
            }
            
            {atendimento.encaixe && 
            <div className="flex items-center gap-1 text-[11px] font-bold text-green-700 uppercase border-2 p-1 border-green-700 rounded-lg">
              Encaixe
            </div>
            }
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            <h3 className="text-[12px] font-black uppercase tracking-widest text-slate-400">Salas de Destino</h3>
            
            <ScrollArea className="h-[300px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : roteiro.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 items-center justify-center">
                  {roteiro.map((item, idx) => {
                    const config = getStatusStep(item.status)
                    return (
                      <div key={idx} className={`relative flex items-center gap-4 p-3 rounded-lg border border-gray-500 bg-white dark:bg-slate-900 shadow-sm ${config.color}`}>
                        <div className="flex-shrink-0">{config.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase truncate tracking-widest">{item.sala}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className="text-[11px] py-0 px-2 border-gray-500">
                               <MapPin className="w-2 h-2 mr-1" /> Sala: {item.num_sala || 'A definir'}
                             </Badge>
                             <Badge className={`text-[10px] font-bold uppercase ${config.bg}`}>{config.text}</Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nenhum roteiro gerado</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}