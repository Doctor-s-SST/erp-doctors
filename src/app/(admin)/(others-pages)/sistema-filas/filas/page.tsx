"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Stethoscope, User, DoorOpen, ArrowRight, Activity } from "lucide-react"

// ================= TYPES =================

type Especialidade = {
  id: string
  nome: string
}

export default function SelecionarFila() {
  const router = useRouter()
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [selected, setSelected] = useState<Especialidade | null>(null)
  const [form, setForm] = useState({ sala: "", profissional: "" })

  async function fetchData() {
    const { data, error } = await supabase
      .from("especialidades")
      .select("id, nome")
      .order("nome")

    if (error) {
      toast.error("Erro ao carregar especialidades")
      return
    }
    setEspecialidades(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  function abrir(especialidade: Especialidade) {
    setSelected(especialidade)
    setForm({ sala: "", profissional: "" })
    setOpenModal(true)
  }

  async function entrar() {
    if (!form.sala || !form.profissional) {
      return toast.warning("Preencha todos os campos")
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Usando a mesma chave que a página de destino (FilaPage) espera
      const userKey = `fila_session_${user.id}`;

      localStorage.setItem(
        userKey,
        JSON.stringify({
          sala: form.sala,
          profissional: form.profissional,
          // Mantemos os outros se quiser, mas a FilaPage foca nesses dois
          especialidade_id: selected?.id,
        })
      )

      toast.success("Acesso autorizado")
      router.push(`filas/${selected?.id}`)
    } else {
      toast.error("Usuário não autenticado")
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 font-mono text-sm animate-pulse text-slate-500">
        CARREGANDO MÓDULOS...
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-8 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER REESTILIZADO */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800">
          <div className="text-center md:text-left space-y-2">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div className="bg-emerald-500/20 p-2 rounded-lg">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
                Painel do Especialista
              </h1>
            </div>
            <p className="text-slate-400 font-medium max-w-md">
              Selecione a especialidade abaixo para iniciar a gestão da fila e atendimentos em tempo real.
            </p>
          </div>

          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1.5 text-xs font-bold tracking-widest uppercase">
            Sistema Operacional Doctor's
          </Badge>
        </div>

        {/* GRID DE ESPECIALIDADES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {especialidades.map((esp) => (
            <Card
              key={esp.id}
              onClick={() => abrir(esp)}
              className="group cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-none bg-white dark:bg-slate-900 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="h-2 bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-500 transition-colors duration-300" />
                <div className="p-6 space-y-4">
                  <div className="bg-slate-100 dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                    <Stethoscope className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-emerald-500" />
                  </div>

                  <div>
                    <h2 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase tracking-tight line-clamp-1">
                      {esp.nome}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">
                      Gerenciar Atendimentos
                    </p>
                  </div>

                  <div className="flex items-center text-emerald-500 text-xs font-bold uppercase pt-2">
                    Acessar Fila <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* MODAL DE ENTRADA REESTILIZADO */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[400px] bg-white dark:bg-slate-900 border-none shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mx-auto">
              <DoorOpen className="w-8 h-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-center text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
              {selected?.nome}
            </DialogTitle>
            <p className="text-center text-slate-500 text-sm">Configure seu posto de trabalho para entrar.</p>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Número da Sala</Label>
              <div className="relative">
                <DoorOpen className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500"
                  placeholder="Ex: Sala 04"
                  value={form.sala}
                  onChange={(e) => setForm({ ...form, sala: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do Profissional</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-emerald-500"
                  placeholder="Ex: João"
                  value={form.profissional}
                  onChange={(e) => setForm({ ...form, profissional: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full h-12 bg-slate-900 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest transition-all duration-300 shadow-lg"
              onClick={entrar}
            >
              Entrar na Fila
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}