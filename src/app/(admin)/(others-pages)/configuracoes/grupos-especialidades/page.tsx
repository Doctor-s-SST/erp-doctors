"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    Layers3,
} from "lucide-react";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DialogGrupoEspecialidade } from "@/components/grupos/DialogGrupoEspecialidade";
import type { GrupoEspecialidadeConfiguracao } from "../types";

export default function UnidadeConfigPage() {
    const [loading, setLoading] = useState(true);
    const [grupos, setGrupos] = useState<GrupoEspecialidadeConfiguracao[]>([]);
    const [unidadeId, setUnidadeId] = useState("");
    const [openDialog, setOpenDialog] = useState(false);

    const [grupoEditando, setGrupoEditando] = useState<GrupoEspecialidadeConfiguracao | null>(null);

    const excluirGrupo = async (id: string) => {

        if (
            !confirm(
                'Deseja realmente excluir?'
            )
        ) {
            return;
        }

        try {

            await supabase
                .from(
                    'grupo_especialidade_itens'
                )
                .delete()
                .eq('grupo_id', id);

            await supabase
                .from(
                    'grupos_especialidades'
                )
                .delete()
                .eq('id', id);

            toast.success(
                'Grupo removido'
            );

            carregarGrupos();

        } catch {

            toast.error(
                'Erro ao remover grupo'
            );

        }
    };

    const carregarGrupos = async () => {
        try {
            setLoading(true);

            const { data: authData } =
                await supabase.auth.getUser();

            const userId = authData.user?.id;

            if (!userId) {
                setGrupos([]);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('unidade_id')
                .eq('id', userId)
                .single();

            const unidadeId = profile?.unidade_id;
            setUnidadeId(unidadeId);

            if (!unidadeId) {
                setGrupos([]);
                return;
            }

            const { data, error } = await supabase
                .from('grupos_especialidades')
                .select(`
                *,
                grupo_especialidade_itens(
                id,
                especialidade_id,
                obrigatoria,
                excludente,
                    especialidades(
                        id,
                        nome
                    )
                )
            `)
                .eq('unidade_id', unidadeId)
                .order('nome');

            if (error) throw error;

            setGrupos(data || []);

        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar grupos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void carregarGrupos();
    }, []);

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
        <>
            <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
                <div className="w-full mx-auto space-y-5">

                    {/* HEADER */}
                    <div className="
                                bg-gray-900
                                rounded-2xl
                                shadow-2xl
                                p-4
                                flex
                                justify-between
                                items-center
                                border
                                border-gray-700
                            ">
                        <div className="flex items-center gap-4">

                            <div className="
                                        bg-emerald-500/20
                                        p-3
                                        rounded-xl
                                    ">
                                <Layers3 className="
                                    w-5 h-5
                                    text-emerald-400
                                " />
                            </div>

                            <div>
                                <h1 className="
                                            text-xl
                                            font-black
                                            uppercase
                                            text-white
                                    ">
                                    Grupos de Especialidades
                                </h1>
                            </div>

                        </div>

                        <Button
                            onClick={() => {
                                setGrupoEditando(null);
                                setOpenDialog(true);
                            }}
                            className="bg-emerald-600"
                        >
                            Novo Grupo
                        </Button>
                    </div>

                    {/* CARD */}
                    <div className="grid
                                grid-cols-2
                                md:grid-cols-4 gap-4">
                        {grupos.map((grupo) => (
                        <Card
                            key={grupo.id}
                            className="
                                overflow-hidden
                                border
                                border-gray-200
                                "   
                            >
                            <div className="h-1 bg-emerald-500" />

                            <CardContent className="p-5">

                                <div className="
                                        flex
                                        justify-between
                                        items-start
                                    ">

                                    <div>

                                        <h3 className="
                                                font-black
                                                uppercase
                                                text-sm
                                            ">
                                            {grupo.nome}
                                        </h3>

                                        <p className="
                                                text-xs
                                                text-muted-foreground
                                            ">
                                            {
                                                grupo.grupo_especialidade_itens.length
                                            } especialidades
                                        </p>

                                    </div>

                                    <Badge>
                                        {
                                            grupo.ativo
                                                ? "Ativo"
                                                : "Inativo"
                                        }
                                    </Badge>

                                </div>

                                <div className="
                                        flex
                                        flex-wrap
                                        gap-2
                                        mt-4
                                    ">
                                    {grupo.grupo_especialidade_itens.map(
                                        (item) => (
                                            <Badge
                                                key={item.id}
                                                variant="secondary"
                                                className={item.excludente
                                                    ? "bg-red-500/15 text-red-700 dark:text-red-300"
                                                    : item.obrigatoria
                                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                                        : ""
                                                }
                                            >
                                                {grupo.tipo_filtro === "obrigatorio_mais_algum"
                                                    ? item.excludente
                                                        ? "Impede: "
                                                        : item.obrigatoria
                                                            ? "Obrigatória: "
                                                            : "Opcional: "
                                                    : ""
                                                }
                                                {item.especialidades.nome}
                                            </Badge>
                                        )
                                    )}
                                </div>

                                <div className="
                                        flex
                                        justify-end
                                        gap-2
                                        mt-5
                                    ">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setGrupoEditando(grupo);
                                            setOpenDialog(true);
                                        }}
                                    >
                                        Editar
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        onClick={() =>
                                            excluirGrupo(grupo.id)
                                        }
                                    >
                                        Excluir
                                    </Button>
                                </div>

                            </CardContent>
                        </Card>
                    ))}
                    </div>
                </div>
            </div>

            <DialogGrupoEspecialidade
                open={openDialog}
                onOpenChange={setOpenDialog}
                unidadeId={unidadeId}
                grupo={grupoEditando}
                onSuccess={() => {
                    carregarGrupos();
                    setOpenDialog(false);
                }}
            />
        </>
    );
}
