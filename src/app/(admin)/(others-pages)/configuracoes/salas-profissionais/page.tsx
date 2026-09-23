"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  X,
  Check,
  Settings2,
  DoorOpen,
  UserRound,
  Plus,
  Loader2,
  UserCog
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label";

export default function ConfiguracoesPage() {
  const [salas, setSalas] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [novaSala, setNovaSala] = useState({
    numero: "",
    andar: 0,
    especialidades: [] as string[]
  });
  const [novoProfissional, setNovoProfissional] = useState({ nome: "", especialidade_id: "" });

  const [editandoSala, setEditandoSala] = useState<any | null>(null);
  const [editandoProfissional, setEditandoProfissional] = useState<any | null>(null);

  const [unidadeId, setUnidadeId] = useState<string | null>(null);

  const ID_RECEPCAO = "recepcao-fixo";

  const [filtroStatus, setFiltroStatus] = useState<
    "ativos" | "todos"
  >("ativos");

  const [busca, setBusca] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("todas");
  const [filtroJornada, setFiltroJornada] = useState("todas");
  const [falaAndar, setFalaAndar] = useState(false);

  async function fetchAll(idDaUnidade?: string) {
    const idAtivo = idDaUnidade || unidadeId;
    if (!idAtivo) return;

    try {
      setLoading(true);

      // Fetch Salas filtradas
      const { data: s } = await supabase
        .from("salas")
        .select(`
          *,
          sala_especialidades (
            id,
            especialidade_id
          )
        `)
        .eq("unidade_id", idAtivo)
        .order("numero");

      // Fetch Profissionais filtrados
      const { data: p } = await supabase
        .from("profissionais")
        .select(`
          id, 
          nome, 
          recepcao,
          ativo,
          hora_inicio,
          hora_fim,
          profissional_especialidades (
            id,
            especialidade_id
          )
        `)
        .eq("unidade_id", idAtivo) // Filtro essencial
        .order("nome");

      const { data: esp } = await supabase.from("especialidades").select("*").eq("unidade_id", idAtivo).order("nome");

      if (s) {
        const ordenadas = [...s].sort(
          (a, b) => Number(a.numero) - Number(b.numero)
        );

        setSalas(ordenadas);
      }
      if (p) setProfissionais(p);
      if (esp) setEspecialidades(esp);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fetchUserContext = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, unidade_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      const idFinal = profile.unidade_id;

      setUnidadeId(idFinal);

      const { data: config } = await supabase
        .from("painel_config")
        .select("fala_andar")
        .eq("unidade_id", idFinal)
        .maybeSingle();

      setFalaAndar(config?.fala_andar ?? false);

      fetchAll(idFinal);
    };

    fetchUserContext();
  }, []);

  // --- AÇÕES DE SALAS ---
  async function criarSala() {
    if (!novaSala.numero || novaSala.especialidades.length === 0) {
      return toast.error("Preencha todos os campos");
    }

    const { data: sala, error } = await supabase
      .from("salas")
      .insert({
        numero: Number(novaSala.numero),
        andar: falaAndar ? Number(novaSala.andar) : 0,
        unidade_id: unidadeId
      })
      .select()
      .single();

    if (error || !sala) {
      toast.error("Erro ao criar sala");
      return;
    }

    await supabase
      .from("sala_especialidades")
      .insert(
        novaSala.especialidades.map((espId: string) => ({
          sala_id: sala.id,
          especialidade_id: espId,
          unidade_id: unidadeId
        }))
      );

    toast.success("Sala criada!");

    setNovaSala({
      numero: "",
      andar: 0,
      especialidades: []
    });

    fetchAll();
  }

  async function salvarEdicaoSala() {
    const { error } = await supabase
      .from("salas")
      .update({
        numero: Number(editandoSala.numero),
        andar: falaAndar ? Number(editandoSala.andar) : 0
      })
      .eq("id", editandoSala.id);

    if (error) {
      toast.error("Erro ao atualizar sala");
      return;
    }

    // remove vínculos antigos
    await supabase
      .from("sala_especialidades")
      .delete()
      .eq("sala_id", editandoSala.id);

    // cria novamente
    if (editandoSala.especialidades?.length > 0) {
      await supabase
        .from("sala_especialidades")
        .insert(
          editandoSala.especialidades.map((espId: string) => ({
            sala_id: editandoSala.id,
            especialidade_id: espId,
            unidade_id: unidadeId
          }))
        );
    }

    toast.success("Sala atualizada!");
    setEditandoSala(null);
    fetchAll();
  }

  async function removerSala(id: string) {
    if (!confirm("Deseja excluir esta sala?")) return;

    // remove vínculos
    await supabase
      .from("sala_especialidades")
      .delete()
      .eq("sala_id", id);

    // remove sala
    const { error } = await supabase
      .from("salas")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao remover sala");
      return;
    }

    toast.success("Sala removida!");
    fetchAll();
  }

  // --- AÇÕES DE PROFISSIONAIS ---
  async function criarProfissional() {
    if (!novoProfissional.nome) return toast.error("Nome é obrigatório");

    const isRecepcao = novoProfissional.especialidade_id === ID_RECEPCAO;

    const { data: prof, error: errorProf } = await supabase
      .from("profissionais")
      .insert({
        nome: novoProfissional.nome,
        recepcao: isRecepcao,
        unidade_id: unidadeId
      })
      .select()
      .single();

    if (errorProf) return toast.error("Erro ao criar profissional");

    if (!isRecepcao && novoProfissional.especialidade_id) {
      await supabase.from("profissional_especialidades").insert({
        profissional_id: prof.id,
        especialidade_id: novoProfissional.especialidade_id,
        unidade_id: unidadeId
      });
    }

    toast.success("Profissional criado!");
    setNovoProfissional({ nome: "", especialidade_id: "" });
    fetchAll();
  }

  async function adicionarEspecialidadeAoProfissional(profId: string, espId: string) {
    if (espId === ID_RECEPCAO || !unidadeId) return;
    const { error } = await supabase
      .from("profissional_especialidades")
      .insert({ profissional_id: profId, especialidade_id: espId, unidade_id: unidadeId });

    if (error) toast.error("Especialidade já vinculada");
    else { toast.success("Especialidade adicionada!"); fetchAll(); }
  }

  async function removerVínculoEspecialidade(vinculoId: string) {
    const { error } = await supabase.from("profissional_especialidades").delete().eq('id', vinculoId);
    if (!error) fetchAll();
  }

  async function salvarEdicaoNomeProfissional() {
    const { error } = await supabase
      .from("profissionais")
      .update({
        nome: editandoProfissional.nome,
        hora_inicio: editandoProfissional.hora_inicio || null,
        hora_fim: editandoProfissional.hora_fim || null,
      })
      .eq('id', editandoProfissional.id);

    if (!error) {
      toast.success("Profissional atualizado!");
      setEditandoProfissional(null);
      fetchAll();
    }
  }

  async function alterarStatusProfissional(profissional: any) {
    try {

      if (
        !confirm(
          profissional.ativo
            ? "Deseja inativar este profissional?"
            : "Deseja ativar este profissional?"
        )
      ) return;

      const { error } = await supabase
        .from("profissionais")
        .update({
          ativo: !profissional.ativo
        })
        .eq("id", profissional.id);

      if (error) throw error;

      toast.success(
        !profissional.ativo
          ? "Profissional ativado!"
          : "Profissional inativado!"
      );

      fetchAll();

    } catch (error: any) {
      toast.error(error.message);
    }
  }

  const profissionaisFiltrados = profissionais.filter((p) => {
    // Status
    if (filtroStatus === "ativos" && !p.ativo) {
      return false;
    }

    // Busca por nome
    if (
      busca &&
      !p.nome.toLowerCase().includes(busca.toLowerCase())
    ) {
      return false;
    }

    // Especialidade
    if (filtroEspecialidade !== "todas") {
      const possuiEspecialidade =
        p.profissional_especialidades?.some(
          (e: any) =>
            e.especialidade_id === filtroEspecialidade
        );

      if (!possuiEspecialidade) {
        return false;
      }
    }

    // Jornada
    if (filtroJornada === "sem-jornada") {
      if (p.hora_inicio && p.hora_fim) {
        return false;
      }
    }

    if (filtroJornada === "com-jornada") {
      if (!p.hora_inicio || !p.hora_fim) {
        return false;
      }
    }

    return true;
  });

  const getEspecialidadeNome = (id: string | null) => {
    if (!id) return "RECEPÇÃO";
    const esp = especialidades.find(e => e.id === id);
    return esp ? esp.nome : "RECEPÇÃO";
  };

  const formatarAndar = (andar: number) => {
    return Number(andar) === 0 ? "Térreo" : `${andar}º Andar`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest text-center">Sincronizando Banco de Dados...</p>
      </div>
    );
  }

  return (
    <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
      <div className="w-full mx-auto space-y-5">

        {/* HEADER */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/20 p-3 rounded-xl"><Settings2 className="w-5 h-5 text-blue-400" /></div>
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Configuração do Sistema</h1>
              <p className="text-gray-400 text-[11px] font-bold tracking-[0.2em] uppercase">salas e profissionais</p>
            </div>
          </div>
        </div>

        <Accordion type="multiple">
          {/* SEÇÃO PROFISSIONAIS */}
          <AccordionItem value="item-1" className="space-y-2">
            <AccordionTrigger className="flex items-center gap-2 border-l-4 border-emerald-500 pl-4">
              <UserCog className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100">Profissionais</h2>
            </AccordionTrigger>

            <AccordionContent className="space-y-4 h-fit">
              <div className="flex flex-col md:flex-row bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-400 dark:border-gray-600 gap-3 shadow-sm items-center">
                <div className="w-full flex flex-col items-start justify-between gap-5">
                  <div className="w-full flex flex-row gap-3">
                    <Input
                      placeholder="Buscar profissional..."
                      value={busca}
                      className="w-50 border border-gray-400 dark:border-gray-600"
                      onChange={(e) => setBusca(e.target.value)}
                    />
                    <div className="flex flex-row gap-2">
                      <Select
                        value={filtroEspecialidade}
                        onValueChange={setFiltroEspecialidade}
                      >
                        <SelectTrigger className="w-fit border border-gray-400 dark:border-gray-600">
                          <SelectValue placeholder="Especialidade" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="todas">
                            Todas especialidades
                          </SelectItem>

                          {especialidades.map((e) => (
                            <SelectItem
                              key={e.id}
                              value={e.id}
                            >
                              {e.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filtroJornada}
                        onValueChange={setFiltroJornada}
                      >
                        <SelectTrigger className="w-fit border border-gray-400 dark:border-gray-600">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="todas">
                            Todas jornadas
                          </SelectItem>

                          <SelectItem value="com-jornada">
                            Com jornada
                          </SelectItem>

                          <SelectItem value="sem-jornada">
                            Sem jornada
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <span className="text-[11px] font-black uppercase">
                        Exibir:
                      </span>

                      <Button
                        size="sm"
                        variant={filtroStatus === "ativos" ? "default" : "outline"}
                        onClick={() => setFiltroStatus("ativos")}
                        className={`text-[11px] font-black border border-gray-400 dark:border-gray-600 ${filtroStatus === "ativos" ? "bg-emerald-600" : "outline"}`}
                      >
                        Ativos
                      </Button>

                      <Button
                        size="sm"
                        variant={filtroStatus === "todos" ? "default" : "outline"}
                        onClick={() => setFiltroStatus("todos")}
                        className="text-[11px] font-black border border-gray-400 dark:border-gray-600"
                      >
                        Todos
                      </Button>
                    </div>
                  </div>

                  <div className="w-full flex justify-between">
                    <div className="rounded-xl flex flex-col sm:flex-row gap-3 items-center">
                      <Input placeholder="NOME DO PROFISSIONAL" className="h-10 text-[10px] font-black tracking-widest border border-gray-400 dark:border-gray-600" value={novoProfissional.nome} onChange={e => setNovoProfissional({ ...novoProfissional, nome: e.target.value })} />
                      <Select onValueChange={(val) => setNovoProfissional({ ...novoProfissional, especialidade_id: val })}>
                        <SelectTrigger className="h-10 w-full sm:w-[300px] text-[10px] font-black uppercase border border-gray-400 dark:border-gray-600"><SelectValue placeholder="ESPECIALIDADE INICIAL" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ID_RECEPCAO} className="text-[10px] font-black uppercase text-emerald-500">RECEPÇÃO</SelectItem>
                          {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Button onClick={criarProfissional} className="bg-emerald-600 font-black uppercase text-[10px] px-8"><Plus className="w-4 h-4 mr-2" />Cadastrar</Button>
                    </div>
                    <div>
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full flex flex-row justify-center gap-4">
                    <Card className="w-25 h-18 py-2">
                      <CardContent className="px-3">
                        <span className="text-xs text-muted-foreground">
                          Profissionais
                        </span>

                        <h2 className="text-2xl font-bold">
                          {profissionais.length}
                        </h2>
                      </CardContent>
                    </Card>

                    <Card className="w-25 h-18 py-2">
                      <CardContent className="px-3">
                        <span className="text-xs text-muted-foreground p-0 m-0">Ativos</span>
                        <h2 className="text-2xl font-bold">{profissionais.filter(p => p.ativo).length}</h2>
                      </CardContent>
                    </Card>

                    <Card className="w-25 h-18 py-2">
                      <CardContent className="px-3">
                        <span className="text-xs text-muted-foreground">Salas</span>
                        <h2 className="text-2xl font-bold">{salas.length}</h2>
                      </CardContent>
                    </Card>

                    <Card className="w-25 h-18 py-2">
                      <CardContent className="px-3">
                        <span className="text-xs text-muted-foreground">Sem Jornada</span>
                        <h2 className="text-2xl font-bold">
                          {profissionais.filter(
                            p => !p.hora_inicio || !p.hora_fim
                          ).length}
                        </h2>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">
                      Exibindo {profissionaisFiltrados.length} profissionais
                    </span>
                  </div>
                </div>

              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">

                {profissionaisFiltrados.map((p) => (
                  <Card
                    key={p.id}
                    className={`
                  group border border-gray-400 dark:border-gray-600
                  bg-white dark:bg-gray-900 shadow-sm
                  transition-all
                  ${!p.ativo ? "opacity-50 grayscale" : ""}
                `}
                  >
                    <CardContent className="p-0">
                      <div className="h-1 bg-emerald-500" />
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500"><UserRound className="w-5 h-5" /></div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => alterarStatusProfissional(p)}
                            className="h-7 w-7"
                          >
                            {p.ativo ? (
                              <Badge className="bg-red-500 text-[11px]">
                                Inativar
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500 text-[11px]">
                                Ativar
                              </Badge>
                            )}
                          </Button>
                        </div>

                        {editandoProfissional?.id === p.id ? (
                          <div className="space-y-2">
                            <Input
                              className="h-8 text-[11px] font-black"
                              value={editandoProfissional.nome}
                              onChange={e =>
                                setEditandoProfissional({
                                  ...editandoProfissional,
                                  nome: e.target.value
                                })
                              }
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="time"
                                className="h-8 text-[10px] font-black"
                                value={editandoProfissional.hora_inicio || ""}
                                onChange={e =>
                                  setEditandoProfissional({
                                    ...editandoProfissional,
                                    hora_inicio: e.target.value
                                  })
                                }
                              />

                              <Input
                                type="time"
                                className="h-8 text-[10px] font-black"
                                value={editandoProfissional.hora_fim || ""}
                                onChange={e =>
                                  setEditandoProfissional({
                                    ...editandoProfissional,
                                    hora_fim: e.target.value
                                  })
                                }
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-green-600 h-7 text-[9px] font-black" onClick={salvarEdicaoNomeProfissional}><Check className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black" onClick={() => setEditandoProfissional(null)}><X className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="w-full flex items-center gap-2">
                              <h3 className="font-black text-slate-800 dark:text-slate-100 text-[14px] truncate">
                                {p.nome}
                              </h3>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditandoProfissional(p)}
                                className="h-4 w-4 ml-auto"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>

                            {(!p.hora_inicio || !p.hora_fim) ? (
                              <Badge className="w-fit bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                                definir jornada
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2 w-fit px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {p.hora_inicio.slice(0, 5)} → {p.hora_fim.slice(0, 5)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Especialidades</p>
                          <div className="flex flex-col gap-1">
                            {p.recepcao ? (
                              <Badge className="bg-blue-600 text-white text-[9px] font-black uppercase border-none">
                                RECEPÇÃO
                              </Badge>
                            ) : null}

                            {p.profissional_especialidades?.map((v: any) => (
                              <Badge key={v.id} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase border-none py-1 group/badge flex items-center gap-1">
                                {getEspecialidadeNome(v.especialidade_id)}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    removerVínculoEspecialidade(v.id);
                                  }}
                                  className="hover:bg-red-100 p-0.5 rounded-full transition-colors ml-1"
                                >
                                  <X className="w-2.5 h-2.5 text-red-400" />
                                </button>
                              </Badge>
                            ))}

                            {!p.recepcao && (!p.profissional_especialidades || p.profissional_especialidades.length === 0) && (
                              <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400">
                                SEM ESPECIALIDADE
                              </Badge>
                            )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-400 dark:border-gray-600">
                            <Select onValueChange={(val) => adicionarEspecialidadeAoProfissional(p.id, val)}>
                              <SelectTrigger className="border border-gray-400 dark:border-gray-600 h-8 text-[9px] font-black uppercase"><SelectValue placeholder="+ Adicionar Especialidade" /></SelectTrigger>
                              <SelectContent>
                                {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SEÇÃO SALAS */}
          <AccordionItem value="item-2" className="space-y-2 pt-6 mt-4 border-t border-gray-600">
            <AccordionTrigger className="flex items-center gap-2 border-l-4 border-blue-500 pl-4">
              <DoorOpen className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100">Gerenciamento de Salas</h2>
            </AccordionTrigger>

            <AccordionContent className="space-y-4 h-fit">
              <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-400 dark:border-gray-600 flex flex-col sm:flex-row gap-3 items-center shadow-sm">
                <Input placeholder="Nº DA SALA" type="number" className="w-80 h-10 text-[10px] border border-gray-400 dark:border-gray-600 font-black uppercase tracking-widest" value={novaSala.numero} onChange={e => setNovaSala({ ...novaSala, numero: e.target.value })} />
                {falaAndar && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-400 dark:border-gray-600">
                    <div className="flex flex-col leading-none gap-1">
                      <Label
                        htmlFor="input-andar"
                        className="text-[11px] font-black uppercase tracking-widest"
                      >
                        Andar
                      </Label>

                      <span className="text-[11px] font-medium">
                        0 = Térreo
                      </span>
                    </div>

                    <Input
                      id="input-andar"
                      type="number"
                      min="0"
                      placeholder="0"
                      className="
                      w-20
                      h-10
                      text-center
                      text-sm
                      font-black
                      border-gray-400
                      dark:border-gray-600
                    "
                      value={novaSala.andar}
                      onChange={(e) =>
                        setNovaSala({
                          ...novaSala,
                          andar: Number(e.target.value)
                        })
                      }
                    />
                  </div>
                )}
                <Select
                  onValueChange={(val) => {
                    if (novaSala.especialidades.includes(val)) return;

                    setNovaSala({
                      ...novaSala,
                      especialidades: [...novaSala.especialidades, val]
                    });
                  }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-[300px] text-[10px] font-black uppercase border border-gray-400 dark:border-gray-600"><SelectValue placeholder="SETOR / ESPECIALIDADE" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ID_RECEPCAO} className="text-[10px] font-black uppercase text-blue-500">RECEPÇÃO</SelectItem>
                    {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
                <div className="flex flex-col gap-1 mt-2">
                  {novaSala.especialidades.map((espId) => (
                    <Badge
                      key={espId}
                      className="flex items-center gap-1 text-[9px]"
                    >
                      {getEspecialidadeNome(espId)}

                      <button
                        onClick={() =>
                          setNovaSala({
                            ...novaSala,
                            especialidades: novaSala.especialidades.filter(
                              (id) => id !== espId
                            )
                          })
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Button onClick={criarSala} className="bg-blue-600 font-black uppercase text-[10px] px-8"><Plus className="w-4 h-4 mr-2" /> Adicionar Sala</Button>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                {salas.map((s) => (
                  <Card key={s.id} className="w-full sm:w-64 border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm hover:border-blue-500/30 transition-all border">
                    <CardContent className="p-5 py-3 space-y-3 ">
                      {editandoSala?.id === s.id ? (
                        <><div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <Label htmlFor="num-sala" className="text-md">Sala:</Label>
                            <Input
                              className="w-20 h-8 text-[10px] font-black uppercase"
                              id="num-sala"
                              value={editandoSala.numero}
                              onChange={e =>
                                setEditandoSala({
                                  ...editandoSala,
                                  numero: e.target.value
                                })
                              }
                            /></div>
                          {falaAndar && (
                            <div className="flex gap-2 mb-2">
                              <Label htmlFor="andar" className="text-md">Andar: </Label>
                              <Input
                                type="number"
                                min="0"
                                className="w-20 h-8 text-[10px] font-black uppercase"
                                id="andar"
                                value={editandoSala.andar}
                                onChange={(e) =>
                                  setEditandoSala({
                                    ...editandoSala,
                                    andar: Number(e.target.value)
                                  })
                                }
                              />
                            </div>
                          )}
                          {editandoSala.especialidades?.map((espId: string) => (
                            <div className="flex flex-wrap" key={espId}>
                              <Badge
                                className="flex items-center gap-1 text-[9px]"
                              >
                                {getEspecialidadeNome(espId)}

                                <button
                                  onClick={() => {
                                    setEditandoSala({
                                      ...editandoSala,
                                      especialidades: editandoSala.especialidades.filter(
                                        (id: string) => id !== espId
                                      )
                                    });
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            </div>
                          ))}
                        </div>
                          <Select
                            onValueChange={(val) => {
                              if (editandoSala.especialidades.includes(val)) return;

                              setEditandoSala({
                                ...editandoSala,
                                especialidades: [...editandoSala.especialidades, val]
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-[9px] font-black uppercase">
                              <SelectValue placeholder="Adicionar especialidade" />
                            </SelectTrigger>

                            <SelectContent>
                              {especialidades.map((e) => (
                                <SelectItem
                                  key={e.id}
                                  value={e.id}
                                  className="text-[10px] font-black uppercase"
                                >
                                  {e.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 h-7 text-[9px] font-black"
                              onClick={salvarEdicaoSala}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Salvar
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="flex-1 h-7 text-[9px] font-black"
                              onClick={() => setEditandoSala(null)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Sair
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500"><DoorOpen className="w-5 h-5" /></div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() =>
                                setEditandoSala({
                                  ...s,
                                  andar: s.andar ?? 0,
                                  especialidades:
                                    s.sala_especialidades?.map(
                                      (v: any) => v.especialidade_id
                                    ) || []
                                })
                              } className="h-7 w-7"><Pencil className="h-3 w-3 text-slate-400" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => removerSala(s.id)} className="h-7 w-7"><Trash2 className="h-3 w-3 text-red-400" /></Button>
                            </div>
                          </div>
                          <div className="border-t border-gray-400 dark:border-gray-600 pt-2">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase">SALA {s.numero}</h3>
                            {falaAndar && (
                              <p className="text-[10px] text-slate-500 font-bold uppercase">
                                {formatarAndar(s.andar)}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {s.sala_especialidades?.map((v: any) => (
                                <Badge
                                  key={v.id}
                                  variant="outline"
                                  className="text-[9px] font-black uppercase"
                                >
                                  {getEspecialidadeNome(v.especialidade_id)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

      </div>
    </div >
  );
}
