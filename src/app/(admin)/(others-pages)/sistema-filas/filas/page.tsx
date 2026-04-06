"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // Adicionado
import { toast } from "sonner"
import { Stethoscope, UserCog, ArrowRight, Activity, X } from "lucide-react" // Adicionado X e UserCog

// ================= TYPES =================
type Especialidade = { id: string; nome: string }
type Sala = { id: string; numero: string; especialidade_id: string }
type Profissional = {
  profissional_especialidades: any; id: string; nome: string; especialidade_id: string 
}

export default function SelecionarFila() {
  const router = useRouter()
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [selected, setSelected] = useState<Especialidade | null>(null)
  const [form, setForm] = useState({ sala: "", profissional: "" })

  const [salas, setSalas] = useState<Sala[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])

  const [isOutraSala, setIsOutraSala] = useState(false)
  const [isOutroProfissional, setIsOutroProfissional] = useState(false)

  // Filtro baseado na especialidade selecionada no Card
  const salasFiltradas = useMemo(() => {
    return salas.filter(s => s.especialidade_id === selected?.id)
  }, [salas, selected])

  const profissionaisFiltrados = useMemo(() => {
    if (!selected) return []

    return profissionais.filter(p =>
      p.profissional_especialidades?.some(
        (v: any) => v.especialidade_id === selected.id
      )
    )
  }, [profissionais, selected])

  async function fetchData() {
    try {
      setLoading(true);

      const { data: esp } = await supabase.from("especialidades").select("*").order("nome");
      const { data: sls } = await supabase.from("salas").select("*");

      const { data: profs } = await supabase
        .from("profissionais")
        .select(`
          id,
          nome,
          profissional_especialidades (
            especialidade_id
          )
        `)
        .order("nome");

      setEspecialidades(esp || []);
      setSalas(sls || []);
      setProfissionais(
        (profs || []).map((p: any) => ({
          ...p,
          especialidade_id: p.profissional_especialidades?.[0]?.especialidade_id || ""
        }))
      );

    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  function abrir(especialidade: Especialidade) {
    setSelected(especialidade)
    setForm({ sala: "", profissional: "" })
    setIsOutraSala(false)
    setIsOutroProfissional(false)
    setOpenModal(true)
  }

  async function entrar() {
    if (!form.sala || !form.profissional) {
      return toast.warning("Preencha todos os campos")
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const userKey = `fila_session_${user.id}`
      localStorage.setItem(userKey, JSON.stringify({
        sala: form.sala,
        profissional: form.profissional,
        especialidade_id: selected?.id,
      }))

      toast.success("Fila iniciada!")
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
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HEADER */}
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
              Selecione a especialidade abaixo para iniciar a gestão da fila.
            </p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1.5 text-xs font-bold tracking-widest uppercase">
            SST Digital
          </Badge>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {especialidades.map((esp) => (
            <Card
              key={esp.id}
              onClick={() => abrir(esp)}
              className="group cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-none bg-white dark:bg-slate-900 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="h-2 bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-500 transition-colors" />
                <div className="p-6 space-y-4">
                  <div className="bg-slate-100 dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Stethoscope className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-emerald-500" />
                  </div>
                  <h2 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase line-clamp-1">{esp.nome}</h2>
                  <div className="flex items-center text-emerald-500 text-xs font-bold uppercase pt-2">
                    Acessar Fila <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* MODAL ADAPTÁVEL */}
      <Dialog open={openModal} onOpenChange={(open) => !loading && setOpenModal(open)}>
        <DialogContent className="sm:max-w-[450px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl">

          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-3 rounded-xl">
                <UserCog className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Identificação
                </DialogTitle>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                  {selected?.nome}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 space-y-6">
            {/* SALA */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Sala de Atendimento</Label>
              {!isOutraSala ? (
                <Select
                  value={form.sala}
                  onValueChange={(val) => val === "OUTRO" ? (setIsOutraSala(true), setForm({ ...form, sala: "" })) : setForm({ ...form, sala: val })}
                >
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold">
                    <SelectValue placeholder="QUAL SALA?" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {salasFiltradas.map(s => (
                      <SelectItem key={s.id} value={s.numero} className="font-bold text-slate-900 dark:text-slate-100">Sala {s.numero}</SelectItem>
                    ))}
                    <SelectItem value="OUTRO" className="font-black text-emerald-600 dark:text-emerald-400">-- DIGITAR OUTRO --</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Input
                    autoFocus
                    className="h-12 bg-slate-50 dark:bg-slate-900 border-emerald-500/50 text-slate-900 dark:text-white font-bold"
                    value={form.sala}
                    onChange={(e) => setForm({ ...form, sala: e.target.value })}
                  />
                  <X className="absolute right-3 top-4 w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setIsOutraSala(false)} />
                </div>
              )}
            </div>

            {/* PROFISSIONAL */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Profissional</Label>
              {!isOutroProfissional ? (
                <Select
                  value={form.profissional}
                  onValueChange={(val) => val === "OUTRO" ? (setIsOutroProfissional(true), setForm({ ...form, profissional: "" })) : setForm({ ...form, profissional: val })}
                >
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold">
                    <SelectValue placeholder="QUEM ATENDE?" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    {profissionaisFiltrados.map(p => (
                      <SelectItem key={p.id} value={p.nome} className="font-bold text-slate-900 dark:text-slate-100">{p.nome}</SelectItem>
                    ))}
                    <SelectItem value="OUTRO" className="font-black text-emerald-600 dark:text-emerald-400">-- OUTRO --</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  <Input
                    autoFocus
                    className="h-12 bg-slate-50 dark:bg-slate-900 border-emerald-500/50 text-slate-900 dark:text-white font-bold"
                    value={form.profissional}
                    onChange={(e) => setForm({ ...form, profissional: e.target.value})}
                  />
                  <X className="absolute right-3 top-4 w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setIsOutroProfissional(false)} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <Button onClick={entrar} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest">
              Entrar na Fila
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}