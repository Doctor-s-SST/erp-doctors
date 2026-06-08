'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    unidadeId: string;
    grupo?: any;
}

interface Especialidade {
    id: number;
    nome: string;
}

export function DialogGrupoEspecialidade({
    open,
    onOpenChange,
    onSuccess,
    unidadeId,
    grupo
}: Props) {

    const [loading, setLoading] = useState(false);

    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');

    const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
    const [selecionadas, setSelecionadas] = useState<number[]>([]);

    const [tipoFiltro, setTipoFiltro] =
        useState('todos');

    useEffect(() => {
        if (!grupo) {
            setNome('');
            setSelecionadas([]);
            return;
        }

        setNome(grupo.nome);
        setTipoFiltro(grupo.tipo_filtro);

        setSelecionadas(
            grupo.grupo_especialidade_itens.map(
                (i: any) => i.especialidade_id
            )
        );
    }, [grupo]);

    useEffect(() => {

        if (!open) return;

        carregarEspecialidades();

    }, [open]);

    const carregarEspecialidades = async () => {

        try {

            const { data, error } = await supabase
                .from('especialidades')
                .select('id,nome')
                .eq('unidade_id', unidadeId)
                .order('nome');

            if (error) throw error;

            setEspecialidades(data || []);

        } catch (err) {
            console.error(err);
            toast.error('Erro ao carregar especialidades');
        }
    };

    const toggleEspecialidade = (id: number) => {

        setSelecionadas(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const salvarGrupo = async () => {

        if (!nome.trim()) {
            toast.warning('Informe o nome do grupo');
            return;
        }

        if (selecionadas.length === 0) {
            toast.warning('Selecione ao menos uma especialidade');
            return;
        }

        try {

            setLoading(true);

            let grupoId: number;

            // ==========================
            // EDIÇÃO
            // ==========================
            if (grupo?.id) {

                const { error } = await supabase
                    .from('grupos_especialidades')
                    .update({
                        nome,
                        tipo_filtro: tipoFiltro
                    })
                    .eq('id', grupo.id);

                if (error) throw error;

                grupoId = grupo.id;

                // Remove vínculos antigos
                const { error: deleteError } = await supabase
                    .from('grupo_especialidade_itens')
                    .delete()
                    .eq('grupo_id', grupoId);

                if (deleteError) throw deleteError;

            }
            // ==========================
            // NOVO
            // ==========================
            else {

                const { data, error } = await supabase
                    .from('grupos_especialidades')
                    .insert({
                        unidade_id: unidadeId,
                        nome,
                        tipo_filtro: tipoFiltro
                    })
                    .select()
                    .single();

                if (error) throw error;

                grupoId = data.id;
            }

            // Insere as especialidades selecionadas
            const itens = selecionadas.map(
                especialidade_id => ({
                    unidade_id: unidadeId,
                    grupo_id: grupoId,
                    especialidade_id
                })
            );

            const { error: erroItens } = await supabase
                .from('grupo_especialidade_itens')
                .insert(itens);

            if (erroItens) throw erroItens;

            toast.success(
                grupo?.id
                    ? 'Grupo atualizado com sucesso'
                    : 'Grupo criado com sucesso'
            );

            setNome('');
            setDescricao('');
            setSelecionadas([]);

            onOpenChange(false);

            onSuccess?.();

        } catch (err) {

            console.error(err);

            toast.error(
                grupo?.id
                    ? 'Erro ao atualizar grupo'
                    : 'Erro ao criar grupo'
            );

        } finally {

            setLoading(false);

        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">

                <DialogHeader>

                    <DialogTitle>
                        {grupo ? 'Editar Grupo de Especialidades' : 'Novo Grupo de Especialidades'}
                    </DialogTitle>

                    <DialogDescription>
                        Defina quais especialidades fazem parte deste grupo.
                    </DialogDescription>

                </DialogHeader>

                <div className="space-y-4">

                    <div>
                        <label className="text-sm font-medium">
                            Nome
                        </label>

                        <Input
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            placeholder="Ex: Clínico + Triagem"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">
                            Critério do Grupo
                        </label>

                        <Select
                            value={tipoFiltro}
                            onValueChange={setTipoFiltro}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="todos">
                                    Obrigatório todas as especialidades
                                </SelectItem>

                                <SelectItem value="algum">
                                    Uma ou mais especialidades
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>

                        <label className="text-sm font-medium mb-2 block">
                            Especialidades
                        </label>

                        <ScrollArea className="h-[250px] border rounded-xl p-3">

                            <div className="space-y-2">

                                {especialidades.map((esp) => (

                                    <div
                                        key={esp.id}
                                        className="
                                            flex
                                            items-center
                                            gap-3
                                            rounded-lg
                                            border
                                            p-3
                                            hover:bg-muted/50
                                            cursor-pointer
                                        "
                                        onClick={() => toggleEspecialidade(esp.id)}
                                    >

                                        <Checkbox
                                            checked={selecionadas.includes(esp.id)}
                                        />

                                        <span className="text-sm">
                                            {esp.nome}
                                        </span>

                                    </div>

                                ))}

                            </div>

                        </ScrollArea>

                    </div>

                    <div className="flex justify-end">

                        <Button
                            onClick={salvarGrupo}
                            disabled={loading}
                            className="bg-emerald-600"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : grupo ? (
                                <>
                                    Salvar Alterações
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4" />
                                    Criar Grupo
                                </>
                            )}
                        </Button>

                    </div>

                </div>

            </DialogContent>
        </Dialog>
    );
}