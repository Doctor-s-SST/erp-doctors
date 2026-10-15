"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileData } from "./types";
import { mensagemErroProfile, validarAlteracaoSenha } from "./utils";
import { CampoProfile } from "./components/CampoProfile";

export default function Profile() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoCompacta, setLogoCompacta] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const alterarSenha = async () => {
    try {
      const erroValidacao = validarAlteracaoSenha({
        atual: senhaAtual,
        nova: novaSenha,
        confirmacao: confirmarSenha,
      });
      if (erroValidacao) return toast.error(erroValidacao);

      setSavingPassword(true);

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user?.email) return toast.error("Usuário não identificado");

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: senhaAtual,
        });

      if (loginError) {
        return toast.error("Senha atual incorreta");
      }

      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");

      toast.success("Senha alterada com sucesso!");
    } catch (error: unknown) {
      toast.error(mensagemErroProfile(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const fetchUserContext = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(`
          email,
          first_name,
          last_name,
          role,
          especialidade_id,
          unidade_id
        `)
        .eq("id", user.id)
        .single();

      let nomeEspecialidade = "";

      if (profile?.especialidade_id) {
        const { data: esp } = await supabase
          .from("especialidades")
          .select("nome")
          .eq("id", profile.especialidade_id)
          .single();

        nomeEspecialidade = esp?.nome || "";
      }

      if (profile?.unidade_id) {
        const { data: unidade } = await supabase
          .from("unidades")
          .select("logo_icone_url")
          .eq("id", profile.unidade_id)
          .single();

        setLogoCompacta(unidade?.logo_icone_url || "");
      }

      setProfileData({
        email: profile?.email || "",
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        role: profile?.role || "",
        unidade_id: profile?.unidade_id,
        especialidade: {
          nome: nomeEspecialidade,
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void fetchUserContext());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!profileData) {
    return null;
  }

  return (
    <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
      <div className="w-full mx-auto space-y-5">

        {/* HEADER */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">

          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>

            <div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                Minha Conta
              </h1>

              <p className="text-xs text-gray-400 uppercase font-bold">
                Configurações do Usuário
              </p>
            </div>
          </div>
        </div>

        {/* CARD PRINCIPAL */}
        <Card className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
          <CardContent className="p-0">

            <div className="h-1.5 bg-emerald-500" />

            <div className="p-6 space-y-10">

              {/* PERFIL */}
              <div className="space-y-6">

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />

                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Perfil do Usuário
                  </h2>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl py-4 px-3 border border-gray-200 dark:border-gray-700">

                  <div className="flex flex-col md:flex-row items-center gap-6">

                    <div className="w-28 h-28 p-1 rounded-2xl border border-gray-300 dark:border-gray-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                      {logoCompacta ? (
                        <img
                          src={logoCompacta}
                          alt="Logo"
                          className="w-20 h-20 object-contain"
                        />
                      ) : (
                        <Image
                          src="/images/logo/doctors-svg.svg"
                          alt="Logo"
                          width={80}
                          height={80}
                        />
                      )}
                    </div>

                    <div className="flex-1">

                      <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                        {profileData?.first_name} {profileData?.last_name}
                      </h2>

                      <p className="text-slate-500 mt-1">
                        {profileData?.especialidade?.nome}
                      </p>

                      <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">
                        {profileData?.role}
                      </div>

                    </div>

                  </div>

                </div>
              </div>

              {/* DADOS PESSOAIS */}
              <div className="space-y-5">

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500" />

                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Dados Pessoais
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">

                  <CampoProfile label="Nome" value={profileData.first_name} />
                  <CampoProfile label="Sobrenome" value={profileData.last_name} />
                  <CampoProfile label="E-mail" value={profileData.email} className="space-y-2 md:col-span-2" />

                </div>
              </div>

              {/* ALTERAÇÃO DE SENHA */}
              <div className="space-y-5">

                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-500" />

                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                    Segurança
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Senha Atual
                    </label>

                    <Input
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Nova Senha
                    </label>

                    <Input
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500">
                      Confirmar Senha
                    </label>

                    <Input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      className="h-12"
                    />
                  </div>

                </div>
              </div>

              {/* FOOTER */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">

                <Button
                  onClick={alterarSenha}
                  disabled={savingPassword}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6 text-[10px] font-black uppercase tracking-widest"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Alterar Senha
                    </>
                  )}
                </Button>

              </div>

            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
