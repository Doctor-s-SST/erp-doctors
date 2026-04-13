"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, ClipboardList, Stethoscope, BarChart3, Settings, Monitor, Kanban, Ticket, UserRoundCog, DoorOpen } from "lucide-react"
import { useRouter } from "next/navigation"

const modules = [
  {
    title: "Painel TV",
    icon: Monitor,
    path: "/painel-senhas",
    color: "bg-blue-500",
  },
  {
    title: "Kanban",
    icon: Kanban,
    path: "/sistema-filas/kanban",
    color: "bg-green-500",
  },
  {
    title: "Chamada de Senhas (Recepção)",
    icon: Ticket,
    path: "/sistema-filas/senhas-recepcao",
    color: "bg-orange-500",
  },
  {
    title: "Filas de Especialiadade",
    icon: Stethoscope,
    path: "/sistema-filas/filas",
    color: "bg-emerald-500",
  },
  {
    title: "Relatórios",
    icon: BarChart3,
    path: "/sistema-filas/relatorios",
    color: "bg-purple-500",
  },
  {
    title: "Controle de Acesso",
    icon: UserRoundCog,
    path: "/configuracoes/users",
    color: "bg-slate-600",
  },
  {
    title: "Salas e Profissionais",
    icon: DoorOpen,
    path: "/configuracoes/salas-profissionais",
    color: "bg-slate-600",
  },
]

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-fit mt-2 space-y-5 bg-gray-500/20 rounded-xl p-2">
      <div className="w-full mx-auto flex flex-col items-center justify-center">
        {/* HEADER */}
        <div className="text-center mb-10 space-y-3">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Doctor's SST
          </h1>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Sistema de Gestão Integrada para Saúde e Segurança do Trabalho
          </p>
        </div>

        {/* GRID DE MÓDULOS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
          {modules.map((mod) => {
            const Icon = mod.icon

            return (
              <Card
                key={mod.title}
                onClick={() => router.push(mod.path)}
                className="cursor-pointer group border-none shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 bg-white dark:bg-slate-900"
              >
                <CardContent className="flex flex-col items-center justify-center p-3 gap-4">

                  <div
                    className={`p-4 rounded-2xl ${mod.color} text-white shadow-md group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-sm text-center font-bold text-slate-700 dark:text-slate-200 tracking-wide">
                    {mod.title}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FOOTER */}
        <div className="mt-12 text-[11px] text-slate-400 text-center">
          © {new Date().getFullYear()} Doctor's Saúde e Segurança do Trabalho
        </div>
      </div>
    </main>
  )
}