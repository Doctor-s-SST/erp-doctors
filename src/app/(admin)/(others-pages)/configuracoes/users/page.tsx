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
  Filter,
  Users
} from "lucide-react";
import UserFormDialog from "@/components/user/UserFormDialog";
import { toast } from "sonner";

// MAPA DE CORES POR ROLE
const ROLE_COLORS: any = {
  admin: { bg: "bg-blue-500", light: "bg-blue-500/10", text: "text-blue-500", border: "hover:border-blue-500/30" },
  recepcao: { bg: "bg-orange-500", light: "bg-orange-500/10", text: "text-orange-500", border: "hover:border-orange-500/30" },
  especialista: { bg: "bg-emerald-500", light: "bg-emerald-500/10", text: "text-emerald-500", border: "hover:border-emerald-500/30" },
  all: { bg: "bg-slate-900", light: "bg-slate-100", text: "text-slate-600" }
};

const ROLE_ORDER: any = {
  admin: 1,
  recepcao: 2,
  especialista: 3
};

export default function UsersManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeRole, setActiveRole] = useState("all"); // Filtro de Role
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: pError } = await supabase
        .from("profiles")
        .select("*"); // Removemos o order daqui para fazer manualmente

      const { data: espData, error: eError } = await supabase
        .from("especialidades")
        .select("id, nome");

      if (pError || eError) throw new Error("Falha ao carregar dados");

      const enrichedUsers = profilesData?.map(user => ({
        ...user,
        full_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
        especialidade_nome: espData?.find(e => e.id === user.especialidade_id)?.nome || "GERAL"
      })) || [];

      // APLICAÇÃO DA ORDENAÇÃO PERSONALIZADA
      const sortedUsers = enrichedUsers.sort((a, b) => {
        const pesoA = ROLE_ORDER[a.role] || 4;
        const pesoB = ROLE_ORDER[b.role] || 4;

        // Se os roles forem diferentes, ordena pelo peso definido
        if (pesoA !== pesoB) {
          return pesoA - pesoB;
        }

        // Se forem do mesmo role, ordena alfabeticamente pelo nome
        return a.full_name.localeCompare(b.full_name);
      });

      setUsers(sortedUsers);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  // Lógica de Filtragem combinada (Search + Role)
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = activeRole === "all" || u.role === activeRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase leading-none">
                Controle de Acessos
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">
                Rede Doctor's • Gestão de Profissionais
              </p>
            </div>
          </div>
        </div>

        {/* BARRA DE BUSCA E BOTÕES DE FILTRO */}
        <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">

            {/* Campo de Busca */}
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="BUSCAR NOME OU EMAIL..."
                className="pl-10 h-10 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 uppercase text-[9px] font-black tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtros por Role */}
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { id: "all", label: "TODOS", icon: Users },
                { id: "admin", label: "ADMIN", icon: ShieldAlert },
                { id: "recepcao", label: "RECEPÇÃO", icon: User },
                { id: "especialista", label: "ESPECIALISTAS", icon: Stethoscope },
              ].map((role) => (
                <Button
                  key={role.id}
                  variant={activeRole === role.id ? "default" : "outline"}
                  onClick={() => setActiveRole(role.id)}
                  className={`h-9 px-4 text-[9px] font-black tracking-tighter uppercase transition-all ${activeRole === role.id
                      ? (ROLE_COLORS[role.id]?.bg || 'bg-slate-900') + " text-white border-none shadow-md"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  <role.icon className="w-3.5 h-3.5 mr-2" />
                  {role.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Badge variant="outline" className="text-[9px] font-black border-slate-200 text-slate-400 uppercase py-1">
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
                <Card key={user.id} className={`group border-none bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md transition-all border border-transparent ${colorScheme.border}`}>
                  <CardContent className="p-0">
                    {/* Barra de cor topo */}
                    <div className={`h-1.5 ${colorScheme.bg}`} />

                    <div className="p-5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className={`p-2 rounded-lg ${colorScheme.light}`}>
                          {user.role === 'admin' ? (
                            <ShieldAlert className={`w-5 h-5 ${colorScheme.text}`} />
                          ) : (
                            <User className={`w-5 h-5 ${colorScheme.text}`} />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                          className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                        </Button>
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

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                        {user.especialidade_id && (
                          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black border-none uppercase tracking-widest py-1">
                            <Stethoscope className="w-2.5 h-2.5 mr-1" />
                            {user.especialidade_nome}
                          </Badge>
                        )}

                        <Badge className={`${colorScheme.bg} text-white text-[9px] font-black border-none uppercase tracking-widest py-1`}>
                          {user.role === 'recepcao' ? 'RECEPÇÃO' : user.role === 'admin' ? 'ADMIN' : 'ESPECIALISTA'}
                        </Badge>
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
        onSuccess={fetchUsers}
      />
    </div>
  );
}