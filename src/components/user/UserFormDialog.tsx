"use client";

import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { User, Mail, Shield, Loader2, Trash2 } from "lucide-react";

interface UserFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: any;
    unidadeAtiva: any;
    onSuccess: () => void;
}

export default function UserFormDialog({ open, onOpenChange, user, unidadeAtiva, onSuccess }: UserFormProps) {
    const [especialidades, setEspecialidades] = useState<{ id: string, nome: string }[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const {
        register,
        handleSubmit,
        control,
        reset,
        formState: { isSubmitting }
    } = useForm({
        defaultValues: {
            email: "",
            first_name: "",
            last_name: "",
            password: "",
            role: "operador",
            especialidade_id: "none",
        },
    });

    useEffect(() => {
        async function loadEspecialidades() {
            const { data } = await supabase.from("especialidades").select("id, nome").eq("unidade_id", unidadeAtiva).order("nome");
            if (data) setEspecialidades(data);
        }
        if (open) loadEspecialidades();
    }, [open]);

    useEffect(() => {
        if (user && open) {
            reset({
                email: user.email,
                first_name: user.first_name || "",
                last_name: user.last_name || "",
                role: user.role || "operador",
                especialidade_id: user.especialidade_id || "none",
            });
        }
    }, [user, open, reset]);

    const onSubmit = async (values: any) => {
        try {

            // =====================================
            // EDITAR
            // =====================================
            if (user) {

                const { error } = await supabase
                    .from("profiles")
                    .update({
                        email: values.email,
                        first_name: values.first_name,
                        last_name: values.last_name,
                        role: values.role,
                        especialidade_id:
                            values.especialidade_id === "none"
                                ? null
                                : values.especialidade_id
                    })
                    .eq("id", user.id);

                if (error) throw error;

                toast.success("Usuário atualizado!");

            }

            // =====================================
            // CRIAR
            // =====================================
            else {

                const { error } = await supabase.auth.signUp({
                    email: values.email,
                    password: values.password,
                    options: {
                        data: {
                            first_name: values.first_name,
                            last_name: values.last_name,

                            unidade_id: unidadeAtiva,

                            role: values.role,

                            especialidade_id:
                                values.especialidade_id === "none"
                                    ? null
                                    : values.especialidade_id
                        }
                    }
                });

                toast.success("Usuário criado com sucesso!");
            }

            onSuccess();
            onOpenChange(false);

        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Tem certeza que deseja excluir este perfil?")) return;

        try {
            setIsDeleting(true);
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", user.id);

            if (error) throw error;

            toast.success("Profissional removido!");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error("Erro ao excluir: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-950 border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="bg-slate-900 p-6 text-white flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]">
                        <User className="w-4 h-4 text-emerald-400" />
                        Editar Profissional
                    </DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">

                    <div className="space-y-4">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">01. Informações de Acesso</p>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 text-xs">E-mail (Login)</Label>
                            <Input
                                {...register("email")}
                                placeholder="sala01@gmail.com"
                                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-12 text-[11px] font-bold"
                            />
                        </div>
                        {!user && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                                    Senha Inicial
                                </Label>

                                <Input
                                    type="password"
                                    {...register("password")}
                                    className="bg-slate-50 dark:bg-slate-900 h-12 text-[11px] font-bold"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-2">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">02. Identificação</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Visível</Label>
                                <Input {...register("first_name")} className="bg-slate-50 dark:bg-slate-900 h-12 text-[11px] font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Sobrenome</Label>
                                <Input {...register("last_name")} className="bg-slate-50 dark:bg-slate-900 h-12 text-[11px] font-bold" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">03. Regras de Negócio</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nível de Acesso</Label>
                                <Controller
                                    control={control}
                                    name="role"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900 h-12 text-[10px] font-black uppercase">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Administrador</SelectItem>
                                                <SelectItem value="recepcao">Recepção</SelectItem>
                                                <SelectItem value="especialista">Especialista</SelectItem>
                                                <SelectItem value="operador">Operador</SelectItem>
                                                <SelectItem value="painel">Painel</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Especialidade (Fila)</Label>
                                <Controller
                                    control={control}
                                    name="especialidade_id"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900 h-12 text-[10px] font-black uppercase">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="uppercase text-slate-400 italic">Nenhuma / Geral</SelectItem>
                                                {especialidades.map((esp) => (
                                                    <SelectItem className="uppercase" key={esp.id} value={esp.id}>{esp.nome}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-6">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest h-14 shadow-lg shadow-emerald-900/20"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}