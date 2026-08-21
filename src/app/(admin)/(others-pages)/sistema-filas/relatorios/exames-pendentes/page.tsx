'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Clock, ChevronDown, ChevronUp,
    Table as TableIcon, LogIn, ArrowUpDown, Calendar1,
    ArrowRightCircle,
    Loader2,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from '@/lib/supabase';

import { DialogGrupoEspecialidade } from '@/components/grupos/DialogGrupoEspecialidade';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ItemProps = {
    label: string;
    value: React.ReactNode;
};

const Item: React.FC<ItemProps> = ({ label, value }) => {
    return (
        <div className="flex justify-between items-start">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-semibold text-sm text-right">{value}</div>
        </div>
    );
};

export default function PaginaRelatorio() {
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [range, setRange] = useState<any>();
    const [periodo, setPeriodo] = useState<'manha' | 'tarde' | 'personalizado' | 'todos'>('todos');
    const [dias, setDias] = useState<'hoje' | 'ontem' | 'semana' | 'quinzena' | 'mes' | 'personalizado'>('hoje');

    const [openGrupo, setOpenGrupo] = useState(false);
    const [grupoSelecionado, setGrupoSelecionado] = useState('todos');
    const [grupos, setGrupos] = useState<any[]>([]);

    // Configuração de ordenação: key é a coluna, direction é 'asc' ou 'desc'
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const [filtros, setFiltros] = useState({
        dataInicio: '',
        dataFim: '',
        horaInicio: '00:00',
        horaFim: '23:59',
        unidadeId: '',
        buscaNome: '',
        tipoSenha: 'todos'
    });

    useEffect(() => {
        const carregarUnidade = async () => {
            try {

                const { data: authData } = await supabase.auth.getUser();

                const userId = authData.user?.id;

                if (!userId) return;

                const { data, error } = await supabase
                    .from('profiles')
                    .select('unidade_id')
                    .eq('id', userId)
                    .single();

                if (error) throw error;

                if (data?.unidade_id) {
                    setFiltros(prev => ({
                        ...prev,
                        unidadeId: data.unidade_id
                    }));
                }

            } catch (error) {
                console.error("Erro ao buscar unidade:", error);
            }
        };

        carregarUnidade();
    }, []);

    useEffect(() => {
        if (filtros.unidadeId) {
            carregarGrupos();
        }
    }, [filtros.unidadeId]);

    useEffect(() => {
        handleGerarRelatorio(new Event('change') as any);
    }, [filtros.dataInicio, filtros.dataFim, filtros.horaInicio, filtros.horaFim, filtros.unidadeId]);

    useEffect(() => {
        if (periodo === 'todos') {
            setFiltros(prev => ({ ...prev, horaInicio: '07:00', horaFim: '17:59' }));
        }
        if (periodo === 'manha') {
            setFiltros(prev => ({ ...prev, horaInicio: '07:00', horaFim: '13:00' }));
        }
        if (periodo === 'tarde') {
            setFiltros(prev => ({ ...prev, horaInicio: '13:01', horaFim: '17:59' }));
        }

        if (dias === 'hoje') {
            const hoje = new Date();
            const dataStr = hoje.toISOString().split('T')[0];
            setFiltros(prev => ({ ...prev, dataInicio: dataStr, dataFim: dataStr }));
        }
        if (dias === 'ontem') {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const dataStr = ontem.toISOString().split('T')[0];
            setFiltros(prev => ({ ...prev, dataInicio: dataStr, dataFim: dataStr }));
        }
        if (dias === 'semana') {
            const hoje = new Date();

            const dataFim = new Date(hoje);
            const dataInicio = new Date(hoje);
            dataInicio.setDate(dataInicio.getDate() - 6);

            setFiltros(prev => ({
                ...prev,
                dataInicio: dataInicio.toISOString().split('T')[0],
                dataFim: dataFim.toISOString().split('T')[0]
            }));
        }

        if (dias === 'quinzena') {
            const hoje = new Date();

            const dataFim = new Date(hoje);
            const dataInicio = new Date(hoje);
            dataInicio.setDate(dataInicio.getDate() - 14);

            setFiltros(prev => ({
                ...prev,
                dataInicio: dataInicio.toISOString().split('T')[0],
                dataFim: dataFim.toISOString().split('T')[0]
            }));
        }

        if (dias === 'mes') {
            const hoje = new Date();

            const dataFim = new Date(hoje);
            const dataInicio = new Date(hoje);
            dataInicio.setDate(dataInicio.getDate() - 29);

            setFiltros(prev => ({
                ...prev,
                dataInicio: dataInicio.toISOString().split('T')[0],
                dataFim: dataFim.toISOString().split('T')[0]
            }));
        }
    }, [periodo, dias]);

    // Converte data "DD/MM/YYYY HH:mm:ss" para Date objeto
    const parseAcionamentoToDate = (str: string) => {
        const [d, t] = str.split(' ');
        const [day, month, year] = d.split('/');
        return new Date(`${year}-${month}-${day}T${t}`);
    };

    const parseTempoToSegundos = (tempoStr: string) => {
        if (!tempoStr || tempoStr === '---') return 0;
        const h = parseInt(tempoStr.match(/(\d+)h/)?.[1] || '0');
        const m = parseInt(tempoStr.match(/(\d+)m/)?.[1] || '0');
        const s = parseInt(tempoStr.match(/(\d+)s/)?.[1] || '0');
        return h * 3600 + m * 60 + s;
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleGerarRelatorio = async (e: any) => {
        e.preventDefault();
        if (!filtros.dataInicio || !filtros.dataFim) {
            toast.warning("Selecione o período.");
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("dataInicio", filtros.dataInicio);
            formData.append("dataFim", filtros.dataFim);
            formData.append("unidadeId", filtros.unidadeId);

            const res = await fetch("/api/relatorio-exames", { method: "POST", body: formData });
            const result = await res.json();
            const data = Array.isArray(result) ? result : result.data || [];
            const normalizado = data.map((item: any) => item.json || item);
            setDadosRelatorio(normalizado);
            toast.success(`${normalizado.length} atendimentos.`);
        } catch (error) {
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const grupoAtual = useMemo(() => {
        if (grupoSelecionado === 'todos') return null;
        return grupos.find(g => String(g.id) === String(grupoSelecionado)) || null;
    }, [grupos, grupoSelecionado]);

    const normalizar = (texto: string) =>
        (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

    const dadosFiltradosOrdenados = useMemo(() => {
        let items = [...dadosRelatorio];

        // 1. FILTRAGEM
        items = items.filter(item => {
            const nome = item?.cabecalho?.nome || "";
            const senha = item?.cabecalho?.senha || "";
            const acionamentoStr = item?.cabecalho?.acionamento || "";
            const busca = filtros.buscaNome.toLowerCase();

            const horaAtendimento = acionamentoStr.split(' ')[1]?.substring(0, 5);
            if (horaAtendimento && (horaAtendimento < filtros.horaInicio || horaAtendimento > filtros.horaFim)) return false;

            const atendeTipo = () => {
                if (filtros.tipoSenha === 'todos') return true;
                if (filtros.tipoSenha === 'encaixe') return item.cabecalho.encaixe === true;
                if (filtros.tipoSenha === 'normal') return senha.startsWith('N');
                if (filtros.tipoSenha === 'preferencial') return senha.startsWith('P');
                return true;
            };

            const atendeBusca = nome.toLowerCase().includes(busca) || senha.toLowerCase().includes(busca);
            return atendeTipo() && atendeBusca;
        });

        if (
            grupoSelecionado !== 'todos' &&
            grupoAtual
        ) {

            items = items.filter(item => {

                const especialidadesGrupo =
                    grupoAtual.grupo_especialidade_itens.map(
                        (i: any) => normalizar(i.especialidades.nome)
                    );

                const especialidadesAtendimento: string[] =
                    (item.especialidades || []).map((e: string) => normalizar(e));

                // TODAS as especialidades do grupo (match exato)
                if (grupoAtual.tipo_filtro === 'todos') {

                    const grupoOrdenado = [...especialidadesGrupo].sort();
                    const atendimentoOrdenado = [...especialidadesAtendimento].sort();

                    return (
                        grupoOrdenado.length === atendimentoOrdenado.length &&
                        grupoOrdenado.every(
                            (esp, idx) => esp === atendimentoOrdenado[idx]
                        )
                    );
                }

                // PELO MENOS UMA especialidade do grupo
                if (grupoAtual.tipo_filtro === 'algum') {

                    return especialidadesGrupo.some(
                        (espGrupo: string) =>
                            especialidadesAtendimento.includes(espGrupo)
                    );
                }

                // APENAS especialidades do grupo (qualquer combinação entre elas, sem extras)
                if (grupoAtual.tipo_filtro === 'apenas_do_grupo') {

                    return (
                        especialidadesAtendimento.length > 0 &&
                        especialidadesAtendimento.every(
                            (esp: string) => especialidadesGrupo.includes(esp)
                        )
                    );
                }

                // OBRIGATÓRIA(S) + PELO MENOS UMA ADICIONAL
                if (grupoAtual.tipo_filtro === 'obrigatorio_mais_algum') {

                    const itensGrupo = grupoAtual.grupo_especialidade_itens || [];

                    const obrigatorias = itensGrupo
                        .filter((i: any) => i.obrigatoria === true)
                        .map((i: any) => normalizar(i.especialidades.nome));

                    const adicionais = itensGrupo
                        .filter((i: any) => i.obrigatoria !== true)
                        .map((i: any) => normalizar(i.especialidades.nome));

                    const permitidas = new Set([...obrigatorias, ...adicionais]);

                    // Filtra apenas especialidades que o grupo referencia
                    // (especialidades universais como TRIAGEM não bloqueiam o match)
                    const especialidadesRelevantes = especialidadesAtendimento.filter(
                        (esp: string) => especialidadesGrupo.includes(esp)
                    );

                    const todasObrigatoriasPresentes = obrigatorias.every(
                        (o: string) => especialidadesAtendimento.includes(o)
                    );

                    const possuiPeloMenosUmaAdicional = especialidadesAtendimento.some(
                        (esp: string) => adicionais.includes(esp)
                    );

                    const nenhumaForaDoGrupo = especialidadesRelevantes.every(
                        (esp: string) => permitidas.has(esp)
                    );

                    return (
                        todasObrigatoriasPresentes &&
                        possuiPeloMenosUmaAdicional &&
                        nenhumaForaDoGrupo
                    );
                }

                return true;
            });
        }

        // 2. ORDENAÇÃO
        if (sortConfig) {
            items.sort((a, b) => {
                let valA: any, valB: any;

                if (sortConfig.key === 'tempo') {
                    valA = parseTempoToSegundos(a.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '');
                    valB = parseTempoToSegundos(b.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '');
                } else if (sortConfig.key === 'acionamento') {
                    valA = parseAcionamentoToDate(a.cabecalho.acionamento).getTime();
                    valB = parseAcionamentoToDate(b.cabecalho.acionamento).getTime();
                } else {
                    valA = a.cabecalho[sortConfig.key as keyof typeof a.cabecalho] || '';
                    valB = b.cabecalho[sortConfig.key as keyof typeof b.cabecalho] || '';
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // ORDENAÇÃO PADRÃO: Acionamento (Cronológico)
            // ORDENAÇÃO FIXA (SEMPRE CRONOLÓGICA)
            items.sort((a, b) => {
                const dateA = parseAcionamentoToDate(a.cabecalho.acionamento);
                const dateB = parseAcionamentoToDate(b.cabecalho.acionamento);

                return dateA.getTime() - dateB.getTime();
            });
        }

        return items;
    }, [dadosRelatorio, filtros, sortConfig, grupoSelecionado, grupoAtual]);

    const estatisticas = useMemo(() => {

        const total = dadosFiltradosOrdenados.length;

        const empresas = new Set(
            dadosFiltradosOrdenados.map(
                i => i.cabecalho.empresa
            )
        ).size;

        const totalPendencias =
            dadosFiltradosOrdenados.reduce(
                (acc, item) =>
                    acc + item.exames_pendentes.length,
                0
            );

        const totalExames =
            dadosFiltradosOrdenados.reduce(
                (acc, item) =>
                    acc + item.exames_atendimento.length,
                0
            );

        const realizados =
            dadosFiltradosOrdenados.reduce(
                (acc, item) =>
                    acc +
                    item.exames_atendimento.filter(
                        (e: any) => e.realizado
                    ).length,
                0
            );

        const taxaConclusao =
            totalExames > 0
                ? (
                    (realizados / totalExames) * 100
                ).toFixed(1)
                : "0";

        return {
            total,
            empresas,
            totalPendencias,
            totalExames,
            realizados,
            taxaConclusao
        };

    }, [dadosFiltradosOrdenados]);

    const carregarGrupos = async () => {
        try {
            const { data, error } = await supabase
                .from('grupos_especialidades')
                .select(`
                            *,
                            grupo_especialidade_itens(
                            especialidade_id,
                            especialidades(
                                id,
                                nome
                            )
                            )
                        `)
                .eq('unidade_id', filtros.unidadeId)
                .order('nome');

            if (error) throw error;

            setGrupos(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar grupos');
        }
    };

    const exportToExcel = () => {
        try {
            const rows = dadosFiltradosOrdenados.map(item => ({

                "Empresa":
                    item.cabecalho.empresa,

                "Funcionário":
                    item.cabecalho.nome,

                "CPF":
                    item.cabecalho.cpf,

                "Sequencial Ficha":
                    item.cabecalho.sequencial_ficha,

                "Tipo Exame":
                    item.cabecalho.tipo_exame,

                "Total Exames":
                    item.total_exames,

                "Pendentes":
                    item.total_pendentes,

                "Realizados":
                    item.total_realizados,

                "Exames Pendentes":
                    item.exames_pendentes
                        ?.map((ex: any) => ex.exame)
                        .join(", ") || "",

                "Exames Realizados":
                    item.exames_realizados
                        ?.map((ex: any) => ex.exame)
                        .join(", ") || "",

                "Acionamento":
                    item.cabecalho.acionamento,
            }));

            const dataInicioStr = filtros.dataInicio
                ? filtros.dataInicio
                    .split("-")
                    .reverse()
                    .join("/")
                : "";

            const dataFimStr = filtros.dataFim
                ? filtros.dataFim
                    .split("-")
                    .reverse()
                    .join("/")
                : "";

            const titulo =
                `RELATÓRIO DE PENDÊNCIAS DE EXAMES - ${dataInicioStr} ${dataFimStr ? `até ${dataFimStr}` : ''}`;

            const ws = XLSX.utils.aoa_to_sheet([]);

            // TÍTULO
            XLSX.utils.sheet_add_aoa(
                ws,
                [[titulo]],
                { origin: "A1" }
            );

            // DADOS
            XLSX.utils.sheet_add_json(
                ws,
                rows,
                {
                    origin: "A2",
                    skipHeader: false
                }
            );

            ws["!merges"] = [
                {
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: 10 }
                }
            ];

            // ALTURA DAS LINHAS
            ws["!rows"] = [
                { hpt: 30 },
                { hpt: 22 }
            ];

            // LARGURA DAS COLUNAS
            ws["!cols"] = [
                { wch: 40 }, // Empresa
                { wch: 35 }, // Funcionário
                { wch: 15 }, // CPF
                { wch: 22 }, // Sequencial
                { wch: 18 }, // Tipo Exame
                { wch: 12 }, // Total Exames
                { wch: 12 }, // Pendentes
                { wch: 12 }, // Realizados
                { wch: 60 }, // Exames Pendentes
                { wch: 60 }, // Exames Realizados
                { wch: 20 }, // Acionamento
            ];

            // FILTRO AUTOMÁTICO NO CABEÇALHO
            ws["!autofilter"] = {
                ref: "A2:K2"
            };

            // ===== ESTILOS (somente com xlsx-js-style) =====

            // TÍTULO
            if (ws["A1"]) {
                ws["A1"].s = {
                    font: {
                        bold: true,
                        sz: 16,
                        color: { rgb: "FFFFFF" }
                    },
                    fill: {
                        fgColor: { rgb: "009688" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center"
                    }
                };
            }

            // CABEÇALHO (linha 2)
            for (let col = 0; col <= 10; col++) {

                const cellAddress =
                    XLSX.utils.encode_cell({
                        r: 1,
                        c: col
                    });

                if (!ws[cellAddress]) continue;

                ws[cellAddress].s = {
                    font: {
                        bold: true,
                        color: { rgb: "FFFFFF" }
                    },
                    fill: {
                        fgColor: { rgb: "009688" }
                    },
                    alignment: {
                        horizontal: "center",
                        vertical: "center"
                    }
                };
            }

            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
                wb,
                ws,
                "ASOs"
            );

            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

            for (let row = range.s.r; row <= range.e.r; row++) {
                for (let col = range.s.c; col <= range.e.c; col++) {

                    const cellAddress = XLSX.utils.encode_cell({
                        r: row,
                        c: col
                    });

                    if (!ws[cellAddress]) continue;

                    ws[cellAddress].s = {
                        ...(ws[cellAddress].s || {}),
                        border: {
                            top: {
                                style: "thin",
                                color: { rgb: "D1D5DB" }
                            },
                            bottom: {
                                style: "thin",
                                color: { rgb: "D1D5DB" }
                            },
                            left: {
                                style: "thin",
                                color: { rgb: "D1D5DB" }
                            },
                            right: {
                                style: "thin",
                                color: { rgb: "D1D5DB" }
                            }
                        }
                    };
                }
            }

            XLSX.writeFile(
                wb,
                `relatorio_atendimentos_${filtros.dataInicio}.xlsx`
            );

            toast.success("Exportado para Excel.");

        } catch (error) {

            console.error(error);

            toast.error(
                "Erro ao exportar para Excel."
            );
        }
    };

    const marcarComoRealizado = async (
        atendimentoId: string,
        exameId: string
    ) => {

        try {

            const { data, error } = await supabase
                .from('atendimentos')
                .select('id, exames_list')
                .eq('id', atendimentoId)
                .single();

            if (error) throw error;

            const examesAtualizados =
                (data.exames_list || []).map(
                    (exame: any) => {

                        if (exame.exame_id === exameId) {

                            return {
                                ...exame,
                                realizado: true
                            };
                        }

                        return exame;
                    }
                );

            const { error: updateError } =
                await supabase
                    .from('atendimentos')
                    .update({
                        exames_list: examesAtualizados
                    })
                    .eq('id', atendimentoId);

            if (updateError) throw updateError;

            toast.success(
                'Pendência removida com sucesso'
            );

            await handleGerarRelatorio({
                preventDefault: () => { }
            } as any);

        } catch (err) {

            console.error(err);

            toast.error(
                'Erro ao atualizar exame'
            );
        }
    };

    return (
        <>
            <div className="min-h-screen rounded-xl bg-gray-500/20 p-2">
                <div className='w-full mx-auto space-y-6'>
                    {/* HEADER */}
                    <div className="bg-gray-900
                                rounded-2xl
                                shadow-2xl
                                p-4
                                flex
                                justify-between
                                items-center
                                border
                                border-gray-700">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase">Relatório de Pendências de Exames</h1>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Análise de atendimentos com exames pendentes</p>
                            </div>
                        </div>
                        <div className='flex items-center gap-1'>
                            <Button
                                onClick={() => setOpenGrupo(true)}
                                className='bg-blue-600 hover:bg-blue-800'
                            >
                                Criar Grupo de Filtro
                            </Button>
                            <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-800"><TableIcon className="w-4 h-4 mr-2" /> Exportar Excel</Button>
                        </div>
                    </div>

                    {/* FILTROS AVANÇADOS */}
                    <div className="bg-background rounded-2xl shadow-sm border border-border p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Busca */}
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Buscar (Nome/Senha)</label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                    <input type="text" className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl text-sm"
                                        placeholder="Ex: João Carlos..." value={filtros.buscaNome} onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })} />
                                </div>
                            </div>

                            {/* Tipo Senha */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Tipo de Senha</label>
                                <select className="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl text-sm" value={filtros.tipoSenha} onChange={(e) => setFiltros({ ...filtros, tipoSenha: e.target.value })}>
                                    <option value="todos">Todos</option>
                                    <option value="normal">Normal</option>
                                    <option value="preferencial">Preferencial</option>
                                    <option value="encaixe">Encaixe</option>
                                </select>
                            </div>

                            {/* Ação */}
                            <div className="flex items-end">
                                <Button onClick={handleGerarRelatorio} disabled={loading} className="w-fit bg-blue-600 hover:bg-blue-700 h-[42px] rounded-xl font-bold uppercase">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar Dados"}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Período de atendimento</label>
                                <select
                                    value={dias}
                                    onChange={(e) => setDias(e.target.value as any)}
                                    className="w-full p-2 bg-background border border-border rounded-xl text-sm"
                                >
                                    <option value="hoje">Hoje</option>
                                    <option value="ontem">Ontem</option>
                                    <option value="semana">Últimos 7 dias</option>
                                    <option value="quinzena">Últimos 15 dias</option>
                                    <option value="mes">Últimos 30 dias</option>
                                    <option value="personalizado">Personalizado</option>
                                </select>
                                {dias === 'personalizado' && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-fit h-9 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-lg text-sm">
                                                <Calendar1 className="mr-2 h-4 w-4" />
                                                {range?.from ? (
                                                    range.to ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
                                                        : range.from.toLocaleDateString()
                                                ) : "Selecionar período"}
                                            </Button>
                                        </PopoverTrigger>

                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="range"
                                                selected={range}
                                                onSelect={(val) => {
                                                    setRange(val);

                                                    if (val?.from) {
                                                        setFiltros(prev => ({
                                                            ...prev,
                                                            dataInicio: val.from ? val.from.toISOString().split('T')[0] : '',
                                                            dataFim: val.to ? val.to.toISOString().split('T')[0] : (val.from ? val.from.toISOString().split('T')[0] : '')
                                                        }));
                                                    }
                                                }}
                                                numberOfMonths={2}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )
                                }
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase">Horário</label>

                                <select
                                    value={periodo}
                                    onChange={(e) => setPeriodo(e.target.value as any)}
                                    className="w-full p-2 bg-background border border-border rounded-xl text-sm"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="manha">Manhã</option>
                                    <option value="tarde">Tarde</option>
                                    <option value="personalizado">Personalizado</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase">Grupo de Filtro</label>

                                <Select
                                    value={grupoSelecionado}
                                    onValueChange={setGrupoSelecionado}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Grupo de Especialidades" />
                                    </SelectTrigger>

                                    <SelectContent>
                                        <SelectItem value="todos">
                                            Todos
                                        </SelectItem>

                                        {grupos.length === 0 ? (
                                            <SelectItem value="vazio" disabled>
                                                Nenhum grupo cadastrado
                                            </SelectItem>
                                        ) : (
                                            grupos.map(grupo => (
                                                <SelectItem
                                                    key={grupo.id}
                                                    value={grupo.id}
                                                >
                                                    {grupo.nome}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {periodo === 'personalizado' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase">Hora Início</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 bg-background border border-border rounded-xl text-sm"
                                            value={filtros.horaInicio}
                                            onChange={(e) => setFiltros({ ...filtros, horaInicio: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase">Hora Fim</label>
                                        <input
                                            type="time"
                                            className="w-full p-2 bg-background border border-border rounded-xl text-sm"
                                            value={filtros.horaFim}
                                            onChange={(e) => setFiltros({ ...filtros, horaFim: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Atendimentos com Pendências
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.total}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Total de exames
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.totalExames}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Exames Pendentes
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.totalPendencias}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Exames Realizados
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.realizados}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Taxa de Conclusão
                            </div>

                            <div className="text-3xl font-black mt-2 text-emerald-600">
                                {estatisticas.taxaConclusao}%
                            </div>
                        </div>
                    </div>

                    {/* TABELA */}
                    <div className="bg-background rounded-2xl shadow-sm border border-border overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-muted/30 border-b backdrop-blur">
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('senha')}>
                                        <div className='flex items-center gap-2'>Senha <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('nome')}>
                                        <div className='flex items-center gap-2'>Paciente <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('acionamento')}>
                                        <div className='flex items-center gap-2'>Acionamento <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('tipo_exame')}>
                                        <div className='flex items-center gap-2'>Tipo Exame <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('total_pendentes')}>
                                        <div className='flex items-center gap-2'>Pendências <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                                        <div className='flex items-center gap-2'></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {dadosFiltradosOrdenados.map((item) => (
                                    <React.Fragment key={item.cabecalho.atendimento_id}>
                                        <tr className={`transition-colors ${expandedRow === item.cabecalho.atendimento_id ? 'bg-blue-50/40' : ''}`}>
                                            <td className={`px-6 py-5 ${item.cabecalho.encaixe == true ? "flex flex-col text-left" : ""} `}>
                                                <span className="text-[14px] font-black text-blue-600">{item.cabecalho.senha}</span>
                                                {item.cabecalho.encaixe && <span className="w-fit text-xs font-bold text-emerald-600 rounded italic">Encaixe</span>}
                                            </td>
                                            <td>
                                                <div>
                                                    <div className="font-bold text-sm">{item.cabecalho.nome}</div>
                                                    <div className="text-[11px] text-gray-500 uppercase">{item.cabecalho.empresa}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 flex flex-col items-center ">
                                                <span className="text-xs font-black">{item.cabecalho.acionamento.split(' ')[1]}</span>
                                                <span className="text-xs font-sm">{item.cabecalho.acionamento.split(' ')[0]}</span>
                                            </td>
                                            <td className="text-center"><span className="text-xs font-bold">{item.cabecalho.tipo_exame}</span></td>
                                            <td className="text-center"><span className="text-xs font-bold">{item.total_pendentes}</span></td>
                                            <td className="m-5 pflex items-center justify-center gap-2">
                                                <button onClick={() => setExpandedRow(expandedRow === item.cabecalho.atendimento_id ? null : item.cabecalho.atendimento_id)} className="p-2 rounded-lg bg-blue-600 text-white shadow-lg">
                                                    {expandedRow === item.cabecalho.atendimento_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {expandedRow === item.cabecalho.atendimento_id && (

                                            <tr>
                                                <td colSpan={6}>

                                                    <div className="p-6 bg-muted/20">

                                                        {/* RESUMO */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">

                                                            <div className="rounded-xl border p-4">
                                                                <div className="text-xs text-muted-foreground">
                                                                    Total de Exames
                                                                </div>

                                                                <div className="text-2xl font-black">
                                                                    {item.total_exames}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                                                <div className="text-xs text-emerald-700">
                                                                    Realizados
                                                                </div>

                                                                <div className="text-2xl font-black text-emerald-700">
                                                                    {item.total_realizados}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                                                <div className="text-xs text-red-700">
                                                                    Pendentes
                                                                </div>

                                                                <div className="text-2xl font-black text-red-700">
                                                                    {item.total_pendentes}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border p-4">
                                                                <div className="text-xs text-muted-foreground">
                                                                    Conclusão
                                                                </div>

                                                                <div className="text-2xl font-black">
                                                                    {item.percentual_conclusao}%
                                                                </div>
                                                            </div>

                                                        </div>

                                                        {/* CONTEÚDO */}
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                                                            {/* DADOS PACIENTE */}
                                                            <div className='flex flex-col gap-2'>
                                                                <div className="border rounded-xl p-4 h-fit">

                                                                    <h4 className="font-black text-md mb-4">
                                                                        Dados do Paciente
                                                                    </h4>

                                                                    <div className="space-y-3 text-sm">

                                                                        <Item
                                                                            label="Nome"
                                                                            value={item.cabecalho.nome}
                                                                        />

                                                                        <Item
                                                                            label="CPF"
                                                                            value={item.cabecalho.cpf}
                                                                        />

                                                                        <Item
                                                                            label="Empresa"
                                                                            value={item.cabecalho.empresa}
                                                                        />

                                                                        <Item
                                                                            label="Nascimento"
                                                                            value={item.cabecalho.nascimento.split("-")
                                                                                .reverse()
                                                                                .join("/")}
                                                                        />

                                                                        <Item
                                                                            label="Ficha"
                                                                            value={item.cabecalho.sequencial_ficha}
                                                                        />

                                                                        <Item
                                                                            label="Tipo"
                                                                            value={item.cabecalho.tipo_exame}
                                                                        />
                                                                    </div>
                                                                </div>


                                                                {/* ESPECIALIDADES */}
                                                                <div className="space-y-4">

                                                                    <div className="border rounded-xl p-5">

                                                                        <h4 className="font-black text- mb-4">
                                                                            Especialidades Realizadas
                                                                        </h4>

                                                                        <div className="flex flex-wrap gap-2">

                                                                            {item.especialidades.map(
                                                                                (esp: string) => (
                                                                                    <span
                                                                                        key={esp}
                                                                                        className="
                                                                                    px-3 py-1
                                                                                    rounded-full
                                                                                    bg-blue-100
                                                                                    text-blue-700
                                                                                    text-xs
                                                                                    font-bold
                                                                                "
                                                                                    >
                                                                                        {esp}
                                                                                    </span>
                                                                                )
                                                                            )}

                                                                        </div>

                                                                    </div>

                                                                </div>
                                                            </div>


                                                            {/* REALIZADOS */}
                                                            <div className="border rounded-xl p-5 md:col-span-2">

                                                                <h4 className="font-black mb-4 text-emerald-700">
                                                                    Exames Realizados
                                                                </h4>

                                                                <div className="h-fit overflow-auto grid grid-cols-1 md:grid-cols-2 gap-2">

                                                                    {item.exames_atendimento
                                                                        .filter((e: any) => e.realizado)
                                                                        .map((exame: any, idx: number) => (

                                                                            <div
                                                                                key={idx}
                                                                                className="
                                                                                flex
                                                                                items-center
                                                                                justify-between
                                                                                rounded-lg
                                                                                border
                                                                                border-emerald-200
                                                                                bg-emerald-50
                                                                                p-2
                                                                            "
                                                                            >
                                                                                <span className="text-sm">
                                                                                    {exame.exame}
                                                                                </span>

                                                                                <span
                                                                                    className="
                                                                                        text-xs
                                                                                        font-bold
                                                                                        text-emerald-700
                                                                                    "
                                                                                >
                                                                                    OK
                                                                                </span>
                                                                            </div>

                                                                        ))}

                                                                </div>

                                                            </div>

                                                            {/* PENDENTES */}
                                                            <div className="border rounded-xl p-5">

                                                                <h4 className="font-black mb-4 text-red-600">
                                                                    Exames Pendentes
                                                                </h4>

                                                                <div className="space-y-2">

                                                                    {item.exames_pendentes.map(
                                                                        (exame: any, idx: number) => (

                                                                            <div
                                                                                key={idx}
                                                                                className="
                                                                                rounded-lg
                                                                                border
                                                                                border-red-200
                                                                                bg-red-50
                                                                                p-3
                                                                                flex
                                                                                items-center
                                                                                justify-between
                                                                                gap-4
                                                                            "
                                                                            >

                                                                                <div>

                                                                                    <div className="font-semibold text-red-700 text-sm">
                                                                                        {exame.exame}
                                                                                    </div>

                                                                                </div>

                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => {

                                                                                        const confirmar =
                                                                                            window.confirm(
                                                                                                `Marcar "${exame.exame}" como realizado?`
                                                                                            );

                                                                                        if (!confirmar) return;

                                                                                        marcarComoRealizado(
                                                                                            item.cabecalho.atendimento_id,
                                                                                            exame.exame_id
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                                                </Button>

                                                                            </div>

                                                                        )
                                                                    )}

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div>

                                                </td>
                                            </tr>

                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <DialogGrupoEspecialidade
                open={openGrupo}
                onOpenChange={setOpenGrupo}
                onSuccess={() => {
                    carregarGrupos();
                }}
                unidadeId={filtros.unidadeId}
            />
        </>
    );
}