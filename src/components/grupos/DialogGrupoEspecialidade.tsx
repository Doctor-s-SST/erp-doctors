'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
    Loader2,
    PlusCircle,
    HelpCircle,
    Info,
    Check,
    Layers,
    Search,
    Star,
    Ban,
    Sparkles,
    SlidersHorizontal,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    unidadeId: string;
    grupo?: any;
}

interface Especialidade {
    id: string;
    nome: string;
}

type TipoFiltro = 'apenas_do_grupo' | 'todos' | 'algum' | 'obrigatorio_mais_algum';

interface CriterioConfig {
    id: TipoFiltro;
    titulo: string;
    subtitulo: string;
    descricao: string;
    exemplo: string;
}

const CRITERIOS: CriterioConfig[] = [
    {
        id: 'apenas_do_grupo',
        titulo: 'Apenas do Grupo',
        subtitulo: 'Sem nenhuma especialidade externa',
        descricao: 'O atendimento pode conter qualquer especialidade deste grupo (uma ou várias), mas NÃO pode ter nenhuma outra especialidade fora do grupo no mesmo dia.',
        exemplo: 'Ex: [Clínico + Triagem] aceita só Clínico, só Triagem ou Clínico + Triagem. Rejeita se o paciente tiver outra especialidade.',
    },
    {
        id: 'todos',
        titulo: 'Conjunto Exato',
        subtitulo: 'Exatamente todas juntas',
        descricao: 'O atendimento deve conter obrigatoriamente todas as especialidades selecionadas no grupo, nem mais nem menos.',
        exemplo: 'Ex: [Clínico + Triagem] só aceita quem fizer os dois no mesmo atendimento.',
    },
    {
        id: 'algum',
        titulo: 'Uma ou Mais',
        subtitulo: 'Ao menos uma (permite extras)',
        descricao: 'O atendimento precisa ter pelo menos uma especialidade do grupo, sendo permitido ter quaisquer outras especialidades adicionais.',
        exemplo: 'Ex: [Clínico] aceita quem tem Clínico, mesmo que também faça Raio-X, ECG, Toxicológico, etc.',
    },
    {
        id: 'obrigatorio_mais_algum',
        titulo: 'Obrigatórias + Extra',
        subtitulo: 'Obrigatórias + 1 opcional',
        descricao: 'Exige todas as obrigatórias, pelo menos uma opcional e rejeita o atendimento se qualquer especialidade marcada como impeditiva estiver presente.',
        exemplo: 'Ex: Clínico obrigatório + [Audiometria, ECG] opcionais; Toxicológico impeditivo. Aceita Clínico + Audiometria, mas rejeita se também houver Toxicológico.',
    },
];

export function DialogGrupoEspecialidade({
    open,
    onOpenChange,
    onSuccess,
    unidadeId,
    grupo
}: Props) {
    const [loading, setLoading] = useState(false);
    const [nome, setNome] = useState('');
    const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
    const [obrigatorias, setObrigatorias] = useState<string[]>([]);
    const [excludentes, setExcludentes] = useState<string[]>([]);
    const [selecionadas, setSelecionadas] = useState<string[]>([]);
    const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('apenas_do_grupo');
    const [buscaEspecialidade, setBuscaEspecialidade] = useState('');

    useEffect(() => {
        if (!grupo) {
            setNome('');
            setSelecionadas([]);
            setObrigatorias([]);
            setExcludentes([]);
            setTipoFiltro('apenas_do_grupo');
            setBuscaEspecialidade('');
            return;
        }

        setNome(grupo.nome || '');
        setTipoFiltro(grupo.tipo_filtro || 'apenas_do_grupo');
        setBuscaEspecialidade('');

        const itens = grupo.grupo_especialidade_itens || [];
        setSelecionadas(itens.map((i: any) => i.especialidade_id));
        setObrigatorias(
            itens
                .filter((i: any) => i.obrigatoria)
                .map((i: any) => i.especialidade_id)
        );
        setExcludentes(
            itens
                .filter((i: any) => i.excludente)
                .map((i: any) => i.especialidade_id)
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

    const toggleObrigatoria = (id: string) => {
        setExcludentes(prev => prev.filter(item => item !== id));
        setObrigatorias(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleExcludente = (id: string) => {
        setObrigatorias(prev => prev.filter(item => item !== id));
        setExcludentes(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleEspecialidade = (id: string) => {
        setSelecionadas(prev => {
            const jaSelecionada = prev.includes(id);
            if (jaSelecionada) {
                setObrigatorias(obrigatoriasPrev =>
                    obrigatoriasPrev.filter(item => item !== id)
                );
                setExcludentes(excludentesPrev =>
                    excludentesPrev.filter(item => item !== id)
                );
                return prev.filter(item => item !== id);
            }
            return [...prev, id];
        });
    };

    const especialidadesFiltradas = useMemo(() => {
        if (!buscaEspecialidade.trim()) return especialidades;
        const termo = buscaEspecialidade.toLowerCase().trim();
        return especialidades.filter(e => e.nome.toLowerCase().includes(termo));
    }, [especialidades, buscaEspecialidade]);

    const selecionarTodas = () => {
        const idsVisiveis = especialidadesFiltradas.map(e => e.id);
        const novoConjunto = new Set([...selecionadas, ...idsVisiveis]);
        setSelecionadas(Array.from(novoConjunto));
    };

    const desmarcarTodas = () => {
        setSelecionadas([]);
        setObrigatorias([]);
        setExcludentes([]);
    };

    const criterioAtual = useMemo(() => {
        return CRITERIOS.find(c => c.id === tipoFiltro) || CRITERIOS[0];
    }, [tipoFiltro]);

    const salvarGrupo = async () => {
        if (!nome.trim()) {
            toast.warning('Informe o nome do grupo');
            return;
        }

        if (selecionadas.length === 0) {
            toast.warning('Selecione ao menos uma especialidade');
            return;
        }

        if (
            tipoFiltro === 'obrigatorio_mais_algum' &&
            obrigatorias.length === 0
        ) {
            toast.warning('Selecione ao menos uma especialidade obrigatória (estrela)');
            return;
        }

        if (
            tipoFiltro === 'obrigatorio_mais_algum' &&
            selecionadas.filter(id => !obrigatorias.includes(id) && !excludentes.includes(id)).length === 0
        ) {
            toast.warning('Selecione pelo menos uma especialidade adicional (opcional)');
            return;
        }

        try {
            setLoading(true);
            let grupoId: string;

            // Edição
            if (grupo?.id) {
                const { error } = await supabase
                    .from('grupos_especialidades')
                    .update({
                        nome: nome.trim(),
                        tipo_filtro: tipoFiltro
                    })
                    .eq('id', grupo.id);

                if (error) throw error;
                grupoId = grupo.id;

                const { error: deleteError } = await supabase
                    .from('grupo_especialidade_itens')
                    .delete()
                    .eq('grupo_id', grupoId);

                if (deleteError) throw deleteError;
            }
            // Novo Grupo
            else {
                const { data, error } = await supabase
                    .from('grupos_especialidades')
                    .insert({
                        unidade_id: unidadeId,
                        nome: nome.trim(),
                        tipo_filtro: tipoFiltro
                    })
                    .select()
                    .single();

                if (error) throw error;
                grupoId = data.id;
            }

            const itens = selecionadas.map(especialidade_id => ({
                unidade_id: unidadeId,
                grupo_id: grupoId,
                especialidade_id,
                obrigatoria: tipoFiltro === 'obrigatorio_mais_algum' && obrigatorias.includes(especialidade_id),
                excludente: tipoFiltro === 'obrigatorio_mais_algum' && excludentes.includes(especialidade_id)
            }));

            const { error: erroItens } = await supabase
                .from('grupo_especialidade_itens')
                .insert(itens);

            if (erroItens) throw erroItens;

            toast.success(
                grupo?.id ? 'Grupo atualizado com sucesso' : 'Grupo criado com sucesso'
            );

            setNome('');
            setSelecionadas([]);
            setObrigatorias([]);
            setExcludentes([]);
            onOpenChange(false);
            onSuccess?.();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar grupo');
        } finally {
            setLoading(false);
        }
    };

    return (
        <TooltipProvider delayDuration={100}>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    {/* CABEÇALHO FIXO */}
                    <DialogHeader className="p-5 px-6 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-xl">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                                    {grupo ? 'Editar Grupo de Especialidades' : 'Novo Grupo de Especialidades'}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Configure as especialidades e o critério de filtragem para este grupo.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* CORPO ROLÁVEL */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* NOME DO GRUPO */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Nome do Grupo
                                </label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs p-2.5 text-xs">
                                        Nome identificador do grupo que aparecerá nos filtros da fila e nos relatórios.
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            <Input
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                placeholder="Ex: Clínico + Triagem"
                                className="h-10 text-sm bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
                            />
                        </div>

                        {/* CRITÉRIO DO FILTRO */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Critério de Filtragem
                                    </label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs p-2.5 text-xs">
                                            Define a regra lógica usada pelo sistema para incluir ou excluir atendimentos ao aplicar o filtro deste grupo.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    Clique no critério desejado
                                </span>
                            </div>

                            {/* GRID DE CARDS INTERATIVOS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {CRITERIOS.map(criterio => {
                                    const isSelected = tipoFiltro === criterio.id;
                                    return (
                                        <button
                                            key={criterio.id}
                                            type="button"
                                            onClick={() => {
                                                setTipoFiltro(criterio.id);
                                                if (criterio.id !== 'obrigatorio_mais_algum') {
                                                    setObrigatorias([]);
                                                    setExcludentes([]);
                                                }
                                            }}
                                            className={`
                                                relative text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2
                                                ${isSelected
                                                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 ring-1 ring-emerald-500 shadow-sm'
                                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-900/80'
                                                }
                                            `}
                                        >
                                            <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">
                                                {criterio.titulo}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* CARD DETALHADO DO CRITÉRIO SELECIONADO */}
                            <div className="bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                                    <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>Como funciona: {criterioAtual.titulo}</span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[12px]">
                                    {criterioAtual.descricao}
                                </p>
                                <div className="pt-1 text-[12px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/20">
                                    {criterioAtual.exemplo}
                                </div>
                            </div>
                        </div>

                        {/* SELEÇÃO DE ESPECIALIDADES */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                        Especialidades
                                    </label>
                                    <Badge variant="outline" className="text-[10px] font-bold border-slate-300 dark:border-slate-700">
                                        {selecionadas.length} de {especialidades.length} selecionadas
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selecionarTodas}
                                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                    >
                                        Marcar todas
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <button
                                        type="button"
                                        onClick={desmarcarTodas}
                                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            </div>

                            {/* CAMPO DE BUSCA DE ESPECIALIDADES */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                <Input
                                    value={buscaEspecialidade}
                                    onChange={e => setBuscaEspecialidade(e.target.value)}
                                    placeholder="Filtrar especialidade por nome..."
                                    className="h-8 pl-8 text-xs bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                                />
                            </div>

                            {/* LISTA ROLÁVEL DE ESPECIALIDADES */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/30">
                                <ScrollArea className="h-[180px] p-2">
                                    <div className="space-y-1">
                                        {especialidadesFiltradas.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">
                                                Nenhuma especialidade encontrada.
                                            </div>
                                        ) : (
                                            especialidadesFiltradas.map(esp => {
                                                const selecionada = selecionadas.includes(esp.id);
                                                const obrigatoria = obrigatorias.includes(esp.id);
                                                const excludente = excludentes.includes(esp.id);

                                                return (
                                                    <div
                                                        key={esp.id}
                                                        className={`
                                                            flex items-center justify-between gap-3 p-2 px-3 rounded-lg border transition-all
                                                            ${selecionada
                                                                ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                                                                : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-900'
                                                            }
                                                        `}
                                                    >
                                                        <div
                                                            className="flex items-center gap-2.5 cursor-pointer flex-1 select-none"
                                                            onClick={() => toggleEspecialidade(esp.id)}
                                                        >
                                                            <Checkbox
                                                                checked={selecionada}
                                                                onCheckedChange={() => toggleEspecialidade(esp.id)}
                                                                className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                            />
                                                            <span className={`text-xs ${selecionada ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {esp.nome}
                                                            </span>
                                                        </div>

                                                        {/* TOGGLE OBRIGATÓRIA (SÓ EM 'obrigatorio_mais_algum') */}
                                                        {tipoFiltro === 'obrigatorio_mais_algum' && selecionada && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleObrigatoria(esp.id);
                                                                    }}
                                                                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-semibold transition-all ${obrigatoria
                                                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                                                                        }`}
                                                                >
                                                                    <Star className={`w-3 h-3 ${obrigatoria ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                                                                    <span>{obrigatoria ? 'Obrigatória' : 'Opcional'}</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExcludente(esp.id);
                                                                    }}
                                                                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-semibold transition-all ${excludente
                                                                        ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-400'
                                                                        }`}
                                                                >
                                                                    <Ban className="w-3 h-3" />
                                                                    <span>{excludente ? 'Impeditiva' : 'Impedir'}</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    {/* RODAPÉ FIXO */}
                    <div className="p-4 px-6 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {selecionadas.length}
                            </span> {selecionadas.length === 1 ? 'especialidade selecionada' : 'especialidades selecionadas'}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                className="h-9 px-4 text-xs font-semibold"
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="button"
                                size="sm"
                                onClick={salvarGrupo}
                                disabled={loading}
                                className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                        Salvando...
                                    </>
                                ) : grupo ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                        Salvar Alterações
                                    </>
                                ) : (
                                    <>
                                        <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                                        Criar Grupo
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
