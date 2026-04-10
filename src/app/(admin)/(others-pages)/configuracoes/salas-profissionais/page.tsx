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

export default function ConfiguracoesPage() {
  const [salas, setSalas] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [novaSala, setNovaSala] = useState({ numero: "", especialidade_id: "" });
  const [novoProfissional, setNovoProfissional] = useState({ nome: "", especialidade_id: "" });

  const [editandoSala, setEditandoSala] = useState<any | null>(null);
  const [editandoProfissional, setEditandoProfissional] = useState<any | null>(null);

  const [unidadeId, setUnidadeId] = useState<string | null>(null);

  const ID_RECEPCAO = "recepcao-fixo";

  async function fetchAll(idDaUnidade?: string) {
    const idAtivo = idDaUnidade || unidadeId;
    if (!idAtivo) return;

    try {
      setLoading(true);

      // Fetch Salas filtradas
      const { data: s } = await supabase
        .from("salas")
        .select("*")
        .eq("unidade_id", idAtivo) // Filtro essencial
        .order("numero");

      // Fetch Profissionais filtrados
      const { data: p } = await supabase
        .from("profissionais")
        .select(`
        id, 
        nome, 
        recepcao,
        profissional_especialidades (
          id,
          especialidade_id
        )
      `)
        .eq("unidade_id", idAtivo) // Filtro essencial
        .order("nome");

      const { data: esp } = await supabase.from("especialidades").select("*").eq("unidade_id", idAtivo).order("nome");

      if (s) setSalas(s);
      if (p) setProfissionais(p);
      if (esp) setEspecialidades(esp);
    } finally {
      setLoading(false);
    }
  }

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
          let idFinal = profile.unidade_id;

          // Se for admin, tenta pegar a unidade que ele selecionou no Header
          if (profile.role === 'admin') {
            const unidadeSessao = localStorage.getItem('unidade_ativa_id');
            if (unidadeSessao) {
              idFinal = unidadeSessao;
            }
          }

          setUnidadeId(idFinal);
          // Só chama o fetchAll depois que temos o unidadeId correto
          fetchAll(idFinal);
        }
      }
    };

    fetchUserContext();
  }, []);

  // --- AÇÕES DE SALAS ---
  async function criarSala() {
    if (!novaSala.numero || !novaSala.especialidade_id) return toast.error("Preencha todos os campos");
    const { error } = await supabase.from("salas").insert({
      numero: novaSala.numero,
      especialidade_id: novaSala.especialidade_id === ID_RECEPCAO ? null : novaSala.especialidade_id,
      unidade_id: unidadeId
    });
    console.log("teste: ", unidadeId)
    if (!error) { toast.success("Sala criada!"); fetchAll(); setNovaSala({ numero: "", especialidade_id: "" }); }
  }

  async function salvarEdicaoSala() {
    const { error } = await supabase.from("salas").update({
      numero: editandoSala.numero,
      especialidade_id: editandoSala.especialidade_id === ID_RECEPCAO ? null : editandoSala.especialidade_id
    }).eq('id', editandoSala.id);
    if (!error) { toast.success("Sala atualizada!"); setEditandoSala(null); fetchAll(); }
  }

  async function removerSala(id: string) {
    if (!confirm("Deseja excluir esta sala?")) return;
    const { error } = await supabase.from("salas").delete().eq('id', id);
    if (!error) { toast.success("Sala removida!"); fetchAll(); }
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
    const { error } = await supabase.from("profissionais")
      .update({ nome: editandoProfissional.nome })
      .eq('id', editandoProfissional.id);
    if (!error) { toast.success("Nome atualizado!"); setEditandoProfissional(null); fetchAll(); }
  }

  async function removerProfissional(id: string) {
    if (!confirm("Deseja excluir este profissional e todos os seus vínculos?")) return;
    const { error } = await supabase.from("profissionais").delete().eq('id', id);
    if (!error) { toast.success("Profissional removido!"); fetchAll(); }
  }

  const getEspecialidadeNome = (id: string | null) => {
    if (!id) return "RECEPÇÃO";
    const esp = especialidades.find(e => e.id === id);
    return esp ? esp.nome : "RECEPÇÃO";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* HEADER */}
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/20 p-3 rounded-xl"><Settings2 className="w-8 h-8 text-blue-400" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase leading-none">Configuração do Sistema</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">salas e profissionais</p>
            </div>
          </div>
        </div>

        {/* SEÇÃO SALAS */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-blue-500 pl-4">
            <DoorOpen className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100">Gerenciamento de Salas</h2>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 shadow-sm">
            <Input placeholder="Nº DA SALA" type="number" className="h-10 text-[10px] font-black uppercase tracking-widest" value={novaSala.numero} onChange={e => setNovaSala({ ...novaSala, numero: e.target.value })} />
            <Select onValueChange={(val) => setNovaSala({ ...novaSala, especialidade_id: val })}>
              <SelectTrigger className="h-10 w-full sm:w-[300px] text-[10px] font-black uppercase"><SelectValue placeholder="SETOR / ESPECIALIDADE" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ID_RECEPCAO} className="text-[10px] font-black uppercase text-blue-500">RECEPÇÃO</SelectItem>
                {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={criarSala} className="bg-blue-600 font-black uppercase text-[10px] px-8"><Plus className="w-4 h-4 mr-2" /> Adicionar Sala</Button>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            {salas.map((s) => (
              <Card key={s.id} className="w-full sm:w-64 border-none bg-white dark:bg-slate-900 shadow-sm hover:border-blue-500/30 transition-all border">
                <CardContent className="p-5 py-3 space-y-3">
                  {editandoSala?.id === s.id ? (
                    <div className="space-y-3">
                      <Input className="h-8 text-[10px] font-black uppercase" value={editandoSala.numero} onChange={e => setEditandoSala({ ...editandoSala, numero: e.target.value })} />
                      <Select value={editandoSala.especialidade_id || ID_RECEPCAO} onValueChange={(val) => setEditandoSala({ ...editandoSala, especialidade_id: val })}>
                        <SelectTrigger className="h-8 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ID_RECEPCAO}>RECEPÇÃO</SelectItem>
                          {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-green-600 h-7 text-[9px] font-black" onClick={salvarEdicaoSala}><Check className="w-3 h-3 mr-1" /> Salvar</Button>
                        <Button size="sm" variant="ghost" className="flex-1 h-7 text-[9px] font-black" onClick={() => setEditandoSala(null)}><X className="w-3 h-3 mr-1" /> Sair</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500"><DoorOpen className="w-5 h-5" /></div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditandoSala(s)} className="h-7 w-7"><Pencil className="h-3 w-3 text-slate-400" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => removerSala(s.id)} className="h-7 w-7"><Trash2 className="h-3 w-3 text-red-400" /></Button>
                        </div>
                      </div>
                      <div className="border-t pt-2">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase">SALA {s.numero}</h3>
                        <Badge variant="outline" className="mt-2 text-[9px] font-black uppercase border-slate-200 text-slate-500">{getEspecialidadeNome(s.especialidade_id)}</Badge>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* SEÇÃO PROFISSIONAIS */}
        <section className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-4">
            <UserCog className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-black uppercase text-slate-800 dark:text-slate-100">Profissionais</h2>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 shadow-sm">
            <Input placeholder="NOME DO PROFISSIONAL" className="h-10 text-[10px] font-black tracking-widest" value={novoProfissional.nome} onChange={e => setNovoProfissional({ ...novoProfissional, nome: e.target.value })} />
            <Select onValueChange={(val) => setNovoProfissional({ ...novoProfissional, especialidade_id: val })}>
              <SelectTrigger className="h-10 w-full sm:w-[300px] text-[10px] font-black uppercase"><SelectValue placeholder="ESPECIALIDADE INICIAL" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ID_RECEPCAO} className="text-[10px] font-black uppercase text-emerald-500">RECEPÇÃO</SelectItem>
                {especialidades.map(e => (<SelectItem key={e.id} value={e.id} className="text-[10px] font-black uppercase">{e.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button onClick={criarProfissional} className="bg-emerald-600 font-black uppercase text-[10px] px-8"><Plus className="w-4 h-4 mr-2" /> Cadastrar</Button>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            {profissionais.map((p) => (
              <Card key={p.id} className="group border-none bg-white dark:bg-slate-900 shadow-sm hover:border-emerald-500/30 transition-all border">
                <CardContent className="p-0">
                  <div className="h-1 bg-emerald-500" />
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-500"><UserRound className="w-5 h-5" /></div>
                      <Button variant="ghost" size="icon" onClick={() => removerProfissional(p.id)} className="h-7 w-7"><Trash2 className="h-3 w-3 text-red-400" /></Button>
                    </div>

                    {editandoProfissional?.id === p.id ? (
                      <div className="space-y-2">
                        <Input className="h-8 text-[11px] font-black" value={editandoProfissional.nome} onChange={e => setEditandoProfissional({ ...editandoProfissional, nome: e.target.value })} />
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-green-600 h-7 text-[9px] font-black" onClick={salvarEdicaoNomeProfissional}><Check className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[9px] font-black" onClick={() => setEditandoProfissional(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-[14px] truncate">{p.nome}</h3>
                        <Button variant="ghost" size="icon" onClick={() => setEditandoProfissional(p)} className="h-4 w-4"><Pencil className="h-3 w-3" /></Button>
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
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Select onValueChange={(val) => adicionarEspecialidadeAoProfissional(p.id, val)}>
                          <SelectTrigger className="h-8 text-[9px] font-black uppercase"><SelectValue placeholder="+ Adicionar Especialidade" /></SelectTrigger>
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
        </section>
      </div>
    </div>
  );
}