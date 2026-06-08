'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Clock, ChevronDown, ChevronUp,
    Table as TableIcon, LogIn, ArrowUpDown, Calendar1,
    ArrowRightCircle,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { BotaoImprimirRelatorio } from '@/components/atendimento/relatorios/ImprimirRelatorioGeral';
import { BotaoImprimirDeclaracao } from '@/components/atendimento/relatorios/ImprimirDelcaracao';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DialogGrupoEspecialidade } from '@/components/grupos/DialogGrupoEspecialidade';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
            const primeiroDia = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
            const ultimoDia = new Date(hoje.setDate(primeiroDia.getDate() + 6));
            setFiltros(prev => ({ ...prev, dataInicio: primeiroDia.toISOString().split('T')[0], dataFim: ultimoDia.toISOString().split('T')[0] }));
        }
        if (dias === 'quinzena') {
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const meioDia = new Date(hoje.getFullYear(), hoje.getMonth(), 15);
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            setFiltros(prev => ({ ...prev, dataInicio: primeiroDia.toISOString().split('T')[0], dataFim: meioDia.toISOString().split('T')[0] }));
        }
        if (dias === 'mes') {
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            setFiltros(prev => ({ ...prev, dataInicio: primeiroDia.toISOString().split('T')[0], dataFim: ultimoDia.toISOString().split('T')[0] }));
        }
    }, [periodo, dias]);

    // Converte data "DD/MM/YYYY HH:mm:ss" para Date objeto
    // const parseAcionamentoToDate = (str: string) => {
    //     const [d, t] = str.split(' ');
    //     const [day, month, year] = d.split('/');
    //     return new Date(`${year}-${month}-${day}T${t}`);
    // };

    useEffect(() => {
        if (filtros.unidadeId) {
            carregarGrupos();
        }
    }, [filtros.unidadeId]);

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

            const res = await fetch("/api/relatorio-aso", { method: "POST", body: formData });
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

    const dadosFiltradosOrdenados = useMemo(() => {
        let items = [...dadosRelatorio];
        // 1. FILTRAGEM
        items = items.filter(item => {
            const nome = item?.dados_gerais?.nome || "";
            const busca = filtros.buscaNome.toLowerCase();

            const atendeBusca =
                nome.toLowerCase().includes(busca) ||
                (item.dados_gerais?.razao_social || "")
                    .toLowerCase()
                    .includes(busca);
            return /*atendeTipo() &&*/ atendeBusca;
        });

        if (
            grupoSelecionado !== 'todos' &&
            grupoAtual
        ) {

            items = items.filter(item => {

                const especialidadesGrupo =
                    grupoAtual.grupo_especialidade_itens.map(
                        (i: any) => i.especialidades.nome
                    );

                const especialidadesAtendimento =
                    item.especialidades || [];

                // TODAS as especialidades do grupo
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
                            especialidadesAtendimento.includes(
                                espGrupo
                            )
                    );
                }

                return true;
            });
        }

        return items;
    }, [dadosRelatorio, filtros, sortConfig, grupoSelecionado, grupoAtual]);

    const exportToExcel = () => {
        try {
            const rows = dadosFiltradosOrdenados.map(item => ({
                "Empresa": item.dados_gerais.razao_social,
                "CNPJ": item.dados_gerais.cnpj,
                "Funcionário": item.dados_gerais.nome,
                "CPF": item.dados_gerais.cpf,
                "Setor": item.dados_gerais.setor,
                "Cargo": item.dados_gerais.cargo,
                "Tipo ASO": item.dados_gerais.tipo_aso,
                "Data ASO": item.dados_gerais.data_aso,
                "Ficha": item.dados_gerais.sequencial_ficha,
                "Exames": (item.exames || []).map((e: any) => e.nome_exame).join(", "),
                "Riscos": (item.riscos || []).map((r: any) => r.descricao_risco).join(", ")
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ASOs');
            const fileName = `relatorio_asos_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success('Exportado para Excel.');
        } catch (error) {
            console.error('Erro exportando excel', error);
            toast.error('Erro ao exportar para Excel.');
        }
    };

    const estatisticas = useMemo(() => ({
        total: dadosFiltradosOrdenados.length,
        periodicos: dadosFiltradosOrdenados.filter(i => i.dados_gerais.tipo_aso === 'Periódico').length,
        admissionais: dadosFiltradosOrdenados.filter(i => i.dados_gerais.tipo_aso === 'Admissional').length,
        demissionais: dadosFiltradosOrdenados.filter(i => i.dados_gerais.tipo_aso === 'Demissional').length,
        empresas: new Set(
            dadosFiltradosOrdenados.map(i => i.dados_gerais.razao_social)
        ).size
    }), [dadosFiltradosOrdenados]);

    const corAso = {
        "Admissional": "bg-emerald-100 text-emerald-700",
        "Periódico": "bg-blue-100 text-blue-700",
        "Demissional": "bg-red-100 text-red-700",
        "Mudança de Função": "bg-orange-100 text-orange-700",
        "Retorno ao Trabalho": "bg-violet-100 text-violet-700"
    };

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

    return (
        <>
            <div className="min-h-screen bg-gray-50 dark:bg-black/40 p-4">
                <div className='max-w-7xl mx-auto space-y-6'>
                    {/* HEADER */}
                    <div className="bg-gray-900 rounded-2xl p-4 flex justify-between items-center border border-gray-700 shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase">Relatório de ASO's</h1>
                                {/* <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Análise de Fluxo e Tempo</p> */}
                            </div>
                        </div>
                        <div className='flex items-center gap-2'>
                            <Button
                                onClick={() => setOpenGrupo(true)}
                                className='bg-blue-600 hover:bg-blue-800'
                            >
                                Criar Grupo de Filtro
                            </Button>
                            <Button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-800"><TableIcon className="w-4 h-4 mr-2" /> Exportar Excel</Button>
                            {/* <BotaoImprimirRelatorio item={dadosFiltradosOrdenados} text="Relatório Geral" /> */}
                        </div>
                    </div>

                    {/* FILTROS AVANÇADOS */}
                    <div className="bg-background rounded-2xl shadow-sm border border-border p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Busca */}
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase">Buscar</label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                    <input type="text" className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl text-sm"
                                        placeholder="Nome do funcionário..." value={filtros.buscaNome} onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })} />
                                </div>
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
                                Total de ASOs
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.total}
                            </div>
                        </div>


                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Admissionais
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.admissionais}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Periódicos
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.periodicos}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Demissionais
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.demissionais}
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-background p-5">
                            <div className="text-xs uppercase text-muted-foreground">
                                Empresas
                            </div>
                            <div className="text-3xl font-black mt-2">
                                {estatisticas.empresas}
                            </div>
                        </div>

                    </div>

                    {/* TABELA */}
                    <div className="bg-background rounded-2xl shadow-sm border border-border overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-muted/30 border-b backdrop-blur">
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('senha')}>
                                        <div className='flex items-center gap-2'>Funcionário <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('nome')}>
                                        <div className='flex items-center gap-2'>Empresa <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('acionamento')}>
                                        <div className='flex items-center gap-2'>Tipo ASO <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('tempo')}>
                                        <div className='flex items-center gap-2'>Data ASO <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('tempo')}>
                                        <div className='flex items-center gap-2'>Cargo <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground" onClick={() => handleSort('tempo')}>
                                        <div className='flex items-center gap-2'></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {dadosFiltradosOrdenados.map((item) => (
                                    <React.Fragment key={`i${item.dados_gerais.sequencial_ficha}-c${item.dados_gerais.cpf}`}>
                                        <tr
                                            className={`
                                        group
                                        transition-all
                                        duration-200
                                        hover:bg-blue-50/50
                                        dark:hover:bg-blue-950/20
                                        ${expandedRow === `${item.dados_gerais.sequencial_ficha}-${item.dados_gerais.cpf}` ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                                                }
                                    `}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">

                                                    <div className="
                                                    h-10
                                                    w-10
                                                    rounded-full
                                                    bg-blue-100
                                                    text-blue-700
                                                    flex
                                                    items-center
                                                    justify-center
                                                    font-black
                                                    text-sm
                                                    ">
                                                        {item.dados_gerais.nome
                                                            ?.split(' ')
                                                            .slice(0, 2)
                                                            .map((n: string) => n[0])
                                                            .join('')
                                                        }
                                                    </div>

                                                    <div>
                                                        <div className="font-semibold text-sm">
                                                            {item.dados_gerais.nome || item.dados_gerais.msg}
                                                        </div>

                                                        <div className="text-xs text-muted-foreground">
                                                            Sequencial de Ficha: {item.dados_gerais.sequencial_ficha}
                                                        </div>
                                                    </div>

                                                </div>
                                            </td>
                                            <td>
                                                <div>
                                                    <div className="font-medium text-sm">
                                                        {item.dados_gerais.razao_social}
                                                    </div>

                                                    <div className="text-xs text-muted-foreground">
                                                        {item.dados_gerais.cnpj}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <Badge
                                                    className={
                                                        corAso[item.dados_gerais.tipo_aso as keyof typeof corAso] ??
                                                        "bg-slate-100 text-slate-700"
                                                    }
                                                >
                                                    {item.dados_gerais.tipo_aso}
                                                </Badge>
                                            </td>

                                            <td>
                                                <div className="flex items-center gap-2 text-sm">

                                                    <Calendar1 className="h-4 w-4 text-muted-foreground" />

                                                    {item.dados_gerais.data_aso}

                                                </div>
                                            </td>
                                            <td>
                                                <span className="
                                                inline-flex
                                                rounded-full
                                                px-3
                                                py-1
                                                text-xs
                                                font-medium
                                                bg-muted
                                            ">
                                                    {item.dados_gerais.cargo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                {/* <BotaoImprimirRelatorio item={[item]} text="Relatório" /> */}
                                                <button onClick={() => setExpandedRow(expandedRow === `${item.dados_gerais.sequencial_ficha}-${item.dados_gerais.cpf}` ? null : `${item.dados_gerais.sequencial_ficha}-${item.dados_gerais.cpf}`)} className="
                                                h-9
                                                w-9
                                                flex
                                                items-center
                                                justify-center
                                                rounded-xl
                                                border
                                                bg-background
                                                hover:bg-blue-50
                                                hover:border-blue-300
                                                transition-all
                                                ">
                                                    {expandedRow === `${item.dados_gerais.sequencial_ficha}-${item.dados_gerais.cpf}` ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {expandedRow === `${item.dados_gerais.sequencial_ficha}-${item.dados_gerais.cpf}` && (
                                            <tr className=''>
                                                <td colSpan={6} className="p-0 bg-blue-50/40 dark:bg-blue-90/10">
                                                    <div className="p-4 flex flex-col md:flex-row gap-4">

                                                        <div className='flex flex-col gap-4'>
                                                            {/* DADOS GERAIS */}
                                                            <div className="
                                                            bg-background
                                                            rounded-2xl
                                                            border
                                                            shadow-sm
                                                            p-6
                                                            h-fit
                                                            w-100
                                                        ">
                                                                <h4 className="
                                                            text-xs
                                                            uppercase
                                                            tracking-widest
                                                            text-muted-foreground
                                                            font-black
                                                            mb-5
                                                        ">
                                                                    Dados Gerais
                                                                </h4>

                                                                <div className="space-y-2 text-sm">

                                                                    <div className="grid grid-cols-2 gap-4 text-sm">

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                CPF
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.cpf}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                RG
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.rg}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                Nascimento
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.data_nascimento}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                Setor
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.setor}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                Cargo
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.cargo}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                Unidade
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.unidade}
                                                                            </div>
                                                                        </div>

                                                                        <div>
                                                                            <span className="text-muted-foreground">
                                                                                Parecer
                                                                            </span>

                                                                            <div className="font-semibold">
                                                                                {item.dados_gerais.aptidao}
                                                                            </div>
                                                                        </div>
                                                                    </div>


                                                                </div>
                                                            </div>

                                                            {/* EXAMES */}
                                                            <div className="bg-background
                                                            rounded-2xl
                                                            border
                                                            shadow-sm
                                                            p-6
                                                            h-fit
                                                            w-100">
                                                                <h4 className="text-xs
                                                            uppercase
                                                            tracking-widest
                                                            text-muted-foreground
                                                            font-black
                                                            mb-5">
                                                                    Exames
                                                                </h4>

                                                                <div className="flex flex-wrap gap-2">

                                                                    {item.exames.map((exame: any, idx: number) => (

                                                                        <Badge
                                                                            key={idx}
                                                                            variant="secondary"
                                                                            className="rounded-full text-sm"
                                                                        >
                                                                            {exame.nome_exame} - {exame.data_exame}
                                                                        </Badge>

                                                                    ))}

                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* RISCOS */}
                                                        <div className="bg-background
                                                            rounded-2xl
                                                            border
                                                            shadow-sm
                                                            p-6
                                                            h-fit
                                                            w-fit">
                                                            <h4 className="text-xs
                                                            uppercase
                                                            tracking-widest
                                                            text-muted-foreground
                                                            font-black
                                                            mb-5">
                                                                Riscos Ocupacionais
                                                            </h4>

                                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                                                                {item.riscos.map((risco: any, idx: number) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="
                                                                border
                                                                rounded-xl
                                                                p-3
                                                                bg-muted/20
                                                                "
                                                                    >

                                                                        <Badge className="mb-1">
                                                                            {risco.agente || "Outros"}
                                                                        </Badge>

                                                                        <p className="text-xs leading-relaxed">
                                                                            {risco.descricao_risco}
                                                                        </p>

                                                                    </div>
                                                                ))}
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