"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// ================= TYPES =================

type Especialidade = {
  id: string
  nome: string
}

// ================= PAGE =================

export default function SelecionarFila() {
  const router = useRouter()

  const [especialidades, setEspecialidades] = useState<Especialidade[]>([])
  const [loading, setLoading] = useState(true)

  const [openModal, setOpenModal] = useState(false)
  const [selected, setSelected] = useState<Especialidade | null>(null)

  const [form, setForm] = useState({
    sala: "",
    profissional: "",
  })

  // ================= FETCH =================

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

  // ================= OPEN MODAL =================

  function abrir(especialidade: Especialidade) {
    setSelected(especialidade)

    // limpa sempre
    setForm({
      sala: "",
      profissional: "",
    })

    setOpenModal(true)
  }

  // ================= ENTRAR =================

  function entrar() {
    if (!form.sala || !form.profissional) {
      return toast.warning("Preencha todos os campos")
    }

    // salva sessão local
    localStorage.setItem(
      "fila_session",
      JSON.stringify({
        especialidade_id: selected?.id,
        especialidade_nome: selected?.nome,
        sala: form.sala,
        profissional: form.profissional,
      })
    )

    toast.success("Entrada realizada")

    router.push(`filas/${selected?.id}`)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-gray-500">Carregando...</div>
      </div>
    )
  }

  return (
    <>
      {/* HEADER */}
      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">
              Filas por Especialidade
            </h1>
            <p className="text-sm text-gray-500">
              Selecione uma especialidade para iniciar atendimento
            </p>
          </div>

          <Badge variant="secondary">
            Sistema de Atendimento
          </Badge>
        </div>
      </div>

      {/* GRID */}
      <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {especialidades.map((esp) => (
          <Card
            key={esp.id}
            className="cursor-pointer hover:shadow-xl transition-all border hover:border-primary"
          >
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div>
                <h2 className="font-semibold text-lg">
                  {esp.nome}
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Gerenciar fila desta especialidade
                </p>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() => abrir(esp)}
              >
                Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MODAL */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selected?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <Input
              placeholder="Sala (ex: 01, 04, 09)"
              value={form.sala}
              onChange={(e) =>
                setForm({ ...form, sala: e.target.value })
              }
            />

            <Input
              placeholder="Nome do profissional"
              value={form.profissional}
              onChange={(e) =>
                setForm({ ...form, profissional: e.target.value })
              }
            />

            <Button onClick={entrar}>
              Entrar na fila
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}