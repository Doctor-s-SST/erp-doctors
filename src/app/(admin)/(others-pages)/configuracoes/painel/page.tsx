"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
    Building2,
    Loader2,
    Save,
    ShieldCheck,
} from "lucide-react";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";

function mensagemErro(error: unknown) {
    return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export default function UnidadeConfigPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [unidadeId, setUnidadeId] = useState<string | null>(null);
    const [falaAndar, setFalaAndar] = useState(false);
    const [falaTerreo, setFalaTerreo] = useState(false);

    async function carregarConfiguracoes() {
        try {
            setLoading(true);

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("unidade_id")
                .eq("id", user.id)
                .single();

            if (!profile?.unidade_id) return;

            setUnidadeId(profile.unidade_id);

            const { data: config } = await supabase
                .from("painel_config")
                .select("*")
                .eq("unidade_id", profile.unidade_id)
                .single();

            if (config) {
                setFalaAndar(config.fala_andar);
                setFalaTerreo(config.fala_terreo ?? false);
            }
        } catch (error: unknown) {
            toast.error(mensagemErro(error));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void carregarConfiguracoes();
    }, []);

    async function handleSalvar() {
        try {
            if (!unidadeId) return;

            setSaving(true);

            const { error } = await supabase
                .from("painel_config")
                .upsert(
                    {
                        unidade_id: unidadeId,
                        fala_andar: falaAndar,
                        fala_terreo: falaTerreo,
                    },
                    {
                        onConflict: "unidade_id",
                    }
                );

            if (error) throw error;

            toast.success("Configurações salvas!");
        } catch (error: unknown) {
            toast.error(mensagemErro(error));
        } finally {
            setSaving(false);
        }
    }

    // =========================================
    // LOADING
    // =========================================
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
            <div className="w-full mx-auto space-y-5">

                {/* HEADER */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl">
                            <Building2 className="w-5 h-5 text-emerald-400" />
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                                Definições do Painel
                            </h1>
                        </div>
                    </div>
                </div>

                {/* CARD */}
                <Card className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <CardContent className="p-0">

                        <div className="px-6 py-4 space-y-10 grid grid-cols-4 gap-4">
                            <div className="space-y-4">
                                <FieldLabel htmlFor="switch-fala-andar" className="cursor-pointer">
                                    <Field
                                        orientation="horizontal"
                                        className="rounded-xl border border-gray-300 dark:border-gray-700 p-5 hover:bg-muted/30 transition-colors"
                                    >
                                        <FieldContent>
                                            <FieldTitle className="font-black uppercase tracking-wide">
                                                Informar andar das salas
                                            </FieldTitle>

                                            <FieldDescription>
                                                Ative esta opção caso sua clínica possua mais de um andar.
                                                Quando desativada, o painel não informará o andar da sala e o cadastro
                                                de salas ocultará o campo de andar.
                                            </FieldDescription>
                                        </FieldContent>

                                        <Switch
                                            id="switch-fala-andar"
                                            checked={falaAndar}
                                            onCheckedChange={setFalaAndar}
                                        />
                                    </Field>
                                </FieldLabel>
                            </div>

                            <div className="space-y-4">
                                <FieldLabel htmlFor="switch-fala-terreo" className={falaAndar ? "cursor-pointer" : "cursor-not-allowed opacity-60"}>
                                    <Field
                                        orientation="horizontal"
                                        className="rounded-xl border border-gray-300 dark:border-gray-700 p-5 hover:bg-muted/30 transition-colors"
                                    >
                                        <FieldContent>
                                            <FieldTitle className="font-black uppercase tracking-wide">
                                                Informar térreo
                                            </FieldTitle>
                                            <FieldDescription>
                                                Quando ativada, chamadas para salas no andar zero anunciarão “térreo”.
                                            </FieldDescription>
                                        </FieldContent>
                                        <Switch
                                            id="switch-fala-terreo"
                                            checked={falaTerreo}
                                            onCheckedChange={setFalaTerreo}
                                            disabled={!falaAndar}
                                        />
                                    </Field>
                                </FieldLabel>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="pt-4 px-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                                <ShieldCheck className="w-5 h-5 shrink-0" />

                                <div className="space-y-0.5">
                                    <p className="text-sm font-black uppercase tracking-wider">
                                        Atenção
                                    </p>

                                    <p className="text-sm text-muted-foreground">
                                        Após alterar qualquer configuração do painel, é necessário atualizar
                                        (F5) a página do painel de senhas para que as mudanças sejam aplicadas.
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={handleSalvar}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6 text-sm font-black uppercase tracking-widest"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Alterações
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card >
            </div >
        </div >
    );
}
