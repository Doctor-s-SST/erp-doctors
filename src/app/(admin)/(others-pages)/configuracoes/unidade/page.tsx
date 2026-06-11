"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
    Building2,
    ImagePlus,
    Loader2,
    Save,
    ShieldCheck,
    ImageIcon,
} from "lucide-react";

import { toast } from "sonner";
import { refresh } from "next/cache";

export default function UnidadeConfigPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingCompacta, setUploadingCompacta] = useState(false);

    const [unidade, setUnidade] = useState<any>(null);

    const [form, setForm] = useState({
        nome: "",
        flag: "",
        cnpj: "",
        razao_social: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: "",
        logo_url: "",
        logo_icone_url: "",
    });

    // =========================================
    // CARREGA UNIDADE ATIVA
    // =========================================
    useEffect(() => {
        carregarUnidade();
    }, []);

    const carregarUnidade = async () => {
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

            const { data: unidadeData, error } = await supabase
                .from("unidades")
                .select("*")
                .eq("id", profile.unidade_id)
                .single();

            if (error) throw error;

            setUnidade(unidadeData);

            setForm({
                nome: unidadeData.nome || "",
                flag: unidadeData.flag || "",

                cnpj: unidadeData.cnpj || "",
                razao_social: unidadeData.razao_social || "",
                endereco: unidadeData.endereco || "",
                numero: unidadeData.numero || "",
                complemento: unidadeData.complemento || "",
                bairro: unidadeData.bairro || "",
                cidade: unidadeData.cidade || "",
                estado: unidadeData.estado || "",
                cep: unidadeData.cep || "",

                logo_url: unidadeData.logo_url || "",
                logo_icone_url: unidadeData.logo_icone_url || "",
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    // =========================================
    // VALIDA ARQUIVO
    // =========================================
    const validarArquivo = (file: File) => {

        // LIMITE 2MB
        const limite = 2 * 1024 * 1024;

        if (file.size > limite) {
            throw new Error("Arquivo muito grande. Máximo permitido: 2MB.");
        }

        // TIPOS PERMITIDOS
        const tiposPermitidos = [
            "image/png",
            "image/jpeg",
            "image/svg+xml",
        ];

        if (!tiposPermitidos.includes(file.type)) {
            throw new Error("Formato inválido. Utilize PNG, JPG ou SVG.");
        }
    };

    // =========================================
    // FUNÇÃO GENÉRICA DE UPLOAD
    // =========================================
    const uploadLogo = async (
        file: File,
        tipo: "logo-expandida" | "logo-compacta"
    ) => {
        const extensao = file.name.split(".").pop();

        const caminho = `${unidade.id}/${tipo}.${extensao}`;

        const { error } = await supabase.storage
            .from("logos")
            .upload(caminho, file, {
                upsert: true,
            });

        if (error) throw error;

        const {
            data: { publicUrl },
        } = supabase.storage
            .from("logos")
            .getPublicUrl(caminho);

        return publicUrl;
    };

    // =========================================
    // LOGO EXPANDIDA
    // =========================================
    const handleUploadLogo = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        try {
            const file = e.target.files?.[0];

            if (!file) return;

            validarArquivo(file);

            setUploadingLogo(true);

            const publicUrl = await uploadLogo(
                file,
                "logo-expandida"
            );

            setForm((prev) => ({
                ...prev,
                logo_url: publicUrl,
            }));

            toast.success("Logo expandida enviada!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUploadingLogo(false);
        }
    };

    // =========================================
    // LOGO COMPACTA
    // =========================================
    const handleUploadCompacta = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        try {
            const file = e.target.files?.[0];

            if (!file) return;

            validarArquivo(file);

            setUploadingCompacta(true);

            const publicUrl = await uploadLogo(
                file,
                "logo-compacta"
            );

            setForm((prev) => ({
                ...prev,
                logo_icone_url: publicUrl,
            }));

            toast.success("Logo compacta enviada!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUploadingCompacta(false);
        }
    };

    // =========================================
    // SALVAR
    // =========================================
    const handleSalvar = async () => {
        try {
            setSaving(true);

            const somenteNumeros = (valor: string) =>
                valor.replace(/\D/g, "");

            const { error } = await supabase
                .from("unidades")
                .update({
                    nome: form.nome,
                    flag: form.flag,

                    cnpj: somenteNumeros(form.cnpj),
                    razao_social: form.razao_social,
                    endereco: form.endereco,
                    numero: form.numero,
                    complemento: form.complemento,
                    bairro: form.bairro,
                    cidade: form.cidade,
                    estado: form.estado,
                    cep: somenteNumeros(form.cep),

                    logo_url: form.logo_url,
                    logo_icone_url: form.logo_icone_url,
                })
                .eq("id", unidade.id);

            if (error) throw error;

            toast.success("Configurações salvas!");
            location.reload()
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const formatarCNPJ = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2")
            .slice(0, 18);
    };

    const formatarCEP = (value: string) => {
        return value
            .replace(/\D/g, "")
            .replace(/^(\d{5})(\d)/, "$1-$2")
            .slice(0, 9);
    };

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
                                Configuração da Unidade
                            </h1>
                        </div>
                    </div>
                </div>

                {/* CARD */}
                <Card className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <CardContent className="p-0">

                        {/* TOPO */}
                        <div className="h-1.5 bg-emerald-500" />

                        <div className="p-6 space-y-10">

                            {/* IDENTIDADE VISUAL */}
                            <div className="space-y-6">

                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />

                                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                        Identidade Visual
                                    </h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                    {/* LOGO EXPANDIDA */}
                                    <div className="space-y-4">

                                        <div className="space-y-1">
                                            <h3 className="text-[10px] font-black uppercase text-slate-500">
                                                Logo Expandida
                                            </h3>

                                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                Sidebar aberta / login
                                            </p>
                                        </div>

                                        {/* PREVIEW */}
                                        <div className="w-full h-40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {form.logo_url ? (
                                                <img
                                                    src={form.logo_url}
                                                    alt="Logo"
                                                    className="w-full h-full object-contain p-6"
                                                />
                                            ) : (
                                                <ImageIcon className="w-10 h-10 text-slate-400" />
                                            )}
                                        </div>

                                        {/* BOTÃO */}
                                        <div className="flex flex-col gap-2">
                                            <label
                                                htmlFor="logo-upload"
                                                className="cursor-pointer"
                                            >
                                                <div className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                                                    {uploadingLogo ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <ImagePlus className="w-4 h-4" />
                                                    )}

                                                    Upload Logo Expandida
                                                </div>
                                            </label>

                                            <input
                                                id="logo-upload"
                                                type="file"
                                                accept="image/png,image/svg+xml,image/jpeg"
                                                className="hidden"
                                                onChange={handleUploadLogo}
                                            />

                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                Logo horizontal da clínica (recomendado: 400px x 120px • PNG transparente ou SVG)
                                            </p>
                                        </div>
                                    </div>

                                    {/* LOGO COMPACTA */}
                                    <div className="space-y-4">

                                        <div className="space-y-1">
                                            <h3 className="text-[10px] font-black uppercase text-slate-500">
                                                Logo Compacta
                                            </h3>

                                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                Sidebar recolhida
                                            </p>
                                        </div>

                                        {/* PREVIEW */}
                                        <div className="w-full h-40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {form.logo_icone_url ? (
                                                <img
                                                    src={form.logo_icone_url}
                                                    alt="Logo Compacta"
                                                    className="w-24 h-24 object-contain"
                                                />
                                            ) : (
                                                <ImageIcon className="w-10 h-10 text-slate-400" />
                                            )}
                                        </div>

                                        {/* BOTÃO */}
                                        <div className="flex flex-col gap-2">
                                            <label
                                                htmlFor="logo-compacta-upload"
                                                className="cursor-pointer"
                                            >
                                                <div className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all">
                                                    {uploadingCompacta ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <ImagePlus className="w-4 h-4" />
                                                    )}

                                                    Upload Logo Compacta
                                                </div>
                                            </label>

                                            <input
                                                id="logo-compacta-upload"
                                                type="file"
                                                accept="image/png,image/svg+xml,image/jpeg"
                                                className="hidden"
                                                onChange={handleUploadCompacta}
                                            />

                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                Ícone reduzido da clínica (recomendado: 128px x 128px • PNG transparente ou SVG)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DADOS */}
                            <div className="space-y-5">

                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-blue-500" />

                                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                        Dados da Empresa
                                    </h2>
                                </div>


                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                    {/* NOME FANTASIA */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Nome Fantasia (exibido no sistema)
                                        </label>

                                        <Input
                                            value={form.nome}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    nome: e.target.value,
                                                })
                                            }
                                            className="h-12 text-[11px] font-black border-gray-300 dark:border-gray-700"
                                        />
                                    </div>

                                    {/* RAZÃO SOCIAL  */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Razão Social (usado na ficha de atendimento e declarações)
                                        </label>

                                        <Input
                                            value={form.razao_social}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    razao_social: e.target.value,
                                                })
                                            }
                                            className="h-12 text-[11px] font-black border-gray-300 dark:border-gray-700"
                                        />
                                    </div>

                                    {/* CNPJ */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            CNPJ (usado em declarações)
                                        </label>

                                        <Input
                                            value={form.cnpj}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    cnpj: formatarCNPJ(e.target.value),
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>


                                    {/* FLAG */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Sigla / Código
                                        </label>

                                        <Input
                                            value={form.flag}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    flag: e.target.value.toUpperCase(),
                                                })
                                            }
                                            className="h-12 text-[11px] font-black border-gray-300 dark:border-gray-700"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* ENDERECO */}
                            <div className="space-y-5">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-orange-500" />
                                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                                        Endereço
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    {/* CEP */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            CEP
                                        </label>

                                        <Input
                                            value={form.cep}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    cep: formatarCEP(e.target.value),
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Endereço */}
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Endereço
                                        </label>

                                        <Input
                                            value={form.endereco}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    endereco: e.target.value,
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Número */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Número
                                        </label>

                                        <Input
                                            value={form.numero}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    numero: e.target.value,
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Complemento */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Complemento
                                        </label>

                                        <Input
                                            value={form.complemento}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    complemento: e.target.value,
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Bairro */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Bairro
                                        </label>

                                        <Input
                                            value={form.bairro}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    bairro: e.target.value,
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Cidade */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Cidade
                                        </label>

                                        <Input
                                            value={form.cidade}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    cidade: e.target.value,
                                                })
                                            }
                                            className="h-12"
                                        />
                                    </div>

                                    {/* Estado */}
                                    <div className="">
                                        <label className="text-[10px] font-black uppercase text-slate-500">
                                            Estado
                                        </label>

                                        <Input
                                            value={form.estado}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    estado: e.target.value.toUpperCase(),
                                                })
                                            }
                                            maxLength={2}
                                            className="h-12"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* FOOTER */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                            <Button
                                onClick={handleSalvar}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6 text-[10px] font-black uppercase tracking-widest"
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