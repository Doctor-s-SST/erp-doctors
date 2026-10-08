"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Edit2,
  Search,
  User,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Mail,
  Stethoscope,
  Users,
  Plus,
  Monitor
} from "lucide-react";
import UserFormDialog from "@/components/user/UserFormDialog";
import { toast } from "sonner";

// MAPA DE CORES POR ROLE
const ROLE_COLORS: any = {
  admin: { bg: "bg-blue-500", light: "bg-blue-500/10", text: "text-blue-500", border: "hover:border-blue-500/30" },
  recepcao: { bg: "bg-orange-500", light: "bg-orange-500/10", text: "text-orange-500", border: "hover:border-orange-500/30" },
  especialista: { bg: "bg-emerald-500", light: "bg-emerald-500/10", text: "text-emerald-500", border: "hover:border-emerald-500/30" },
  painel: { bg: "bg-yellow-500", light: "bg-yellow-500/10", text: "text-yellow-500", border: "hover:border-yellow-500/30" },
  operador: { bg: "bg-red-500", light: "bg-red-500/10", text: "text-red-500", border: "hover:border-red-500/30" },
  all: { bg: "bg-gray-900", light: "bg-slate-100", text: "text-slate-600" }
};

const ROLE_ORDER: any = {
  admin: 1,
  recepcao: 2,
  especialista: 3,
  operador: 4,
  painel: 5,
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRole, setActiveRole] = useState("all"); // Filtro de Role
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeStatus, setActiveStatus] = useState("ativos");

  const [unidadeId, setUnidadeId] = useState<string | null>(null);

  // Recebe o ID opcionalmente para garantir sincronia no primeiro carregamento
  const fetchUsers = async (idParaFiltrar?: string) => {
    const idAtivo = idParaFiltrar || unidadeId;
    if (!idAtivo) return;

    try {
      setLoading(true);

      // Filtrando perfis APENAS da unidade ativa
      const { data: profilesData, error: pError } = await supabase
        .from("profiles")
        .select("*")
        .eq("unidade_id", idAtivo); // Filtro crucial

      const { data: espData, error: eError } = await supabase
        .from("especialidades")
        .select("id, nome")
        .eq("unidade_id", idAtivo);

      if (pError || eError) throw new Error("Falha ao carregar dados");

      const enrichedUsers = profilesData?.map(user => ({
        ...user,
        full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        especialidade_nome: espData?.find(e => e.id === user.especialidade_id)?.nome || "GERAL"
      })) || [];

      const sortedUsers = enrichedUsers.sort((a, b) => {
        const pesoA = ROLE_ORDER[a.role] || 4;
        const pesoB = ROLE_ORDER[b.role] || 4;
        if (pesoA !== pesoB) return pesoA - pesoB;
        return a.full_name.localeCompare(b.full_name);
      });

      setUsers(sortedUsers);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, unidade_id')
          .eq('id', user.id)
          .single();

        if (profile) {
          const idFinal = profile.unidade_id;

          setUnidadeId(idFinal);
          fetchUsers(idFinal);
        }
      }
    };

    fetchUserContext();
  }, []);

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  // Lógica de Filtragem combinada (Search + Role)
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      activeRole === "all" || u.role === activeRole;

    const matchesStatus =
      activeStatus === "todos"
        ? true
        : activeStatus === "ativos"
          ? u.ativo
          : !u.ativo;

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
      <div className="w-full mx-auto space-y-3">

        {/* HEADER */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Controle de Acesso</h1>
              <p className="text-gray-400 text-[11px] font-bold tracking-[0.2em] uppercase">Gestão de Profissionais</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setSelectedUser(null);
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white mr-5"
          >
            <Plus /> Novo Usuário
          </Button>
        </div>

        {/* BARRA DE BUSCA E BOTÕES DE FILTRO */}
        <div className="flex flex-col gap-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-400 dark:border-gray-600 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">

            {/* Campo de Busca */}
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar nome ou e-mail..."
                className="pl-9 h-10 border-gray-400 dark:border-gray-600 text-[9px] font-black tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtros por Role */}
            <div className="flex flex-wrap gap-1 justify-center">

              {[
                { id: "all", label: "TODOS", icon: Users },
                { id: "admin", label: "ADMIN", icon: ShieldAlert },
                { id: "recepcao", label: "RECEPÇÃO", icon: User },
                { id: "especialista", label: "ESPECIALISTAS", icon: Stethoscope },
                { id: "painel", label: "PAINEL", icon: Monitor },
                { id: "operador", label: "OPERADOR", icon: User },
              ].map((role) => (
                <Button
                  key={role.id}
                  variant={activeRole === role.id ? "default" : "outline"}
                  onClick={() => setActiveRole(role.id)}
                  className={`h-9 px-4 text-[9px] font-black tracking-tighter uppercase transition-all ${activeRole === role.id
                    ? (ROLE_COLORS[role.id]?.bg || 'bg-gray-900') + " text-white border-none shadow-md"
                    : "border-gray-600 text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  <role.icon className="w-3.5 h-3.5 mr-2" />
                  {role.label}
                </Button>
              ))}
            </div>

            {/* Filtro de Ativos e Inativos*/}
            <div className="flex gap-2 justify-center">

              <Button
                variant={activeStatus === "todos" ? "default" : "outline"}
                onClick={() => setActiveStatus("todos")}
                className="h-9 text-[10px] font-black"
              >
                Todos
              </Button>

              <Button
                variant={activeStatus === "ativos" ? "default" : "outline"}
                onClick={() => setActiveStatus("ativos")}
                className={`h-9 text-[11px] font-black ${activeStatus === "ativos" ? "bg-emerald-600" : ""}`}
              >
                Ativos
              </Button>

              <Button
                variant={activeStatus === "inativos" ? "default" : "outline"}
                onClick={() => setActiveStatus("inativos")}
                className={`h-9 text-[11px] font-black ${activeStatus === "inativos" ? "bg-red-500" : ""}`}
              >
                Inativos
              </Button>
            </div>
          </div>

          <div className="flex gap-3 items-center justify-end">
            <Badge variant="outline" className="text-[9px] font-black border-gray-600 text-slate-400 uppercase py-1">
              {filteredUsers.length} RESULTADOS ENCONTRADOS
            </Badge>
          </div>
        </div>

        {/* CONTEÚDO */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Sincronizando Perfis...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.map((user) => {
              const colorScheme = ROLE_COLORS[user.role] || ROLE_COLORS.especialista;

              return (
                <Card
                  key={user.id}
                  className={`
                    group border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-gray-900 overflow-hidden shadow-sm
                    hover:shadow-md transition-all
                    ${colorScheme.border}
                    ${!user.ativo ? "opacity-50 grayscale" : ""}
                  `}
                >
                  <CardContent className="p-0">
                    {/* Barra de cor topo */}
                    <div className={`h-1.5 ${colorScheme.bg}`} />

                    <div className="p-5 mr-2 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-lg ${colorScheme.light}`}>
                          {user.role === 'admin' ? (
                            <ShieldAlert className={`w-5 h-5 ${colorScheme.text}`} />
                          ) : user.role === 'painel' ? (
                            <Monitor className={`w-5 h-5 ${colorScheme.text}`} />
                          ) : (
                            <User className={`w-5 h-5 ${colorScheme.text}`} />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 sm:gap-5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                            className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="h-4 w-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h2 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-tight truncate">
                          {user.full_name}
                        </h2>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3 h-3" />
                          <p className="text-[10px] font-bold truncate uppercase">{user.email}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-600 flex flex-wrap gap-2">
                        {user.especialidade_id && (
                          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black border-none uppercase tracking-widest py-1">
                            <Stethoscope className="w-2.5 h-2.5 mr-1" />
                            {user.especialidade_nome}
                          </Badge>
                        )}

                        <Badge className={`${colorScheme.bg} text-white text-[9px] font-black border-none uppercase tracking-widest py-1`}>
                          {user.role === 'recepcao' ? 'RECEPÇÃO' : user.role === 'admin' ? 'ADMIN' : user.role === 'especialista' ? 'ESPECIALISTA' : user.role === 'painel' ? 'PAINEL' : 'OPERADOR'}
                        </Badge>
                        {user.ativo ? (
                          <Badge className="bg-emerald-600 text-white text-[9px] font-black border-none uppercase tracking-widest py-1">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-600 text-white text-[9px] font-black border-none uppercase tracking-widest py-1">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <UserFormDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
        user={selectedUser}
        unidadeAtiva={unidadeId}
        onSuccess={fetchUsers}
      />
    </div>
  );
}
