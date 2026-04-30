'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Clock, ChevronDown, ChevronUp,
    Table as TableIcon, LogIn, ArrowUpDown, Calendar1,
    ArrowRightCircle,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { BotaoImprimirRelatorio } from '@/components/atendimento/relatorios/ImprimirRelatorioGeral';
import { BotaoImprimirDeclaracao } from '@/components/atendimento/relatorios/ImprimirDelcaracao';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export default function PaginaRelatorio() {
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [range, setRange] = useState<any>();
    const [periodo, setPeriodo] = useState<'manha' | 'tarde' | 'personalizado' | 'todos'>('todos');
    const [dias, setDias] = useState<'hoje' | 'ontem' | 'semana' | 'quinzena' | 'mes' | 'personalizado'>('hoje');

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
        const unidadeSalva = localStorage.getItem('unidade_ativa_id');
        if (unidadeSalva) setFiltros(prev => ({ ...prev, unidadeId: unidadeSalva }));
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

            const res = await fetch("/api/relatorio", { method: "POST", body: formData });
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
    }, [dadosRelatorio, filtros, sortConfig]);

    const exportToExcel = () => {
        const dataToExport = dadosFiltradosOrdenados.map(item => ({
            Paciente: item.cabecalho.nome,
            Empresa: item.cabecalho.empresa,
            Senha: item.cabecalho.senha,
            Acionamento: item.cabecalho.acionamento,
            Tempo_Total: item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '',
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `Relatorio_${filtros.dataInicio}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black/40 p-4">
            <div className='max-w-7xl mx-auto space-y-6'>
                {/* HEADER */}
                <div className="bg-gray-900 rounded-2xl p-4 flex justify-between items-center border border-gray-700 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase">Gestão de Atendimentos</h1>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Análise de Fluxo e Tempo</p>
                        </div>
                    </div>
                    <div>
                        {/* <Button variant="outline" onClick={exportToExcel} className="border-gray-600 text-gray-300 hover:bg-gray-800"><TableIcon className="w-4 h-4 mr-2" /> Exportar Excel</Button> */}
                    <BotaoImprimirRelatorio item={dadosFiltradosOrdenados} text="Relatório Geral" />
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

                {/* TABELA */}
                <div className="bg-background rounded-2xl shadow-sm border border-border overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="px-6 py-4 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('senha')}>
                                    <div className='flex items-center gap-2'>Senha <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="py-4 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('nome')}>
                                    <div className='flex items-center gap-2'>Paciente <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('acionamento')}>
                                    <div className='flex items-center gap-2'>Acionamento <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tempo')}>
                                    <div className='flex items-center gap-2'>Permanência <ArrowUpDown className="w-3 h-3" /></div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('tempo')}>
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
                                        <td className="px-6 py-4 flex flex-col items-center"><span className="text-xs font-black">{item.cabecalho.acionamento.split(' ')[1]}</span>
                                            <span className="text-xs font-sm">{item.cabecalho.acionamento.split(' ')[0]}</span></td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black bg-blue-50 px-2 py-1 rounded text-blue-700">
                                                {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <BotaoImprimirDeclaracao item={item} />
                                            <BotaoImprimirRelatorio item={[item]} text="Relatório" />
                                            <button onClick={() => setExpandedRow(expandedRow === item.cabecalho.atendimento_id ? null : item.cabecalho.atendimento_id)} className="p-2 rounded-lg bg-blue-600 text-white shadow-lg">
                                                {expandedRow === item.cabecalho.atendimento_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>

                                    {expandedRow === item.cabecalho.atendimento_id && (
                                        <tr>
                                            <td colSpan={4} className="p-0 bg-blue-50/40 dark:bg-blue-900/10">
                                                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 border-b border-gray-200">
                                                    <div className="lg:col-span-2 space-y-4">
                                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                            <ArrowRightCircle className="w-3 h-3" /> Timeline de Atendimento
                                                        </h4>
                                                        <div className="relative border-l-2 border-gray-200 dark:border-gray-600 ml-3 space-y-4">
                                                            {/* RECEPÇÃO */}
                                                            {item.recepcao && (
                                                                <div className="relative pl-8">
                                                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-4 border-white" />
                                                                    <div className="bg-background py-4 px-5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex justify-between items-center">
                                                                        <div>
                                                                            <span className="text-[12px] font-black text-blue-500 uppercase">Recepção</span>
                                                                            <div className="text-xs font-bold uppercase">{item.recepcao.atendente}</div>
                                                                            <div className="text-[10px] font-mono text-gray-400">{item.recepcao.periodo}</div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 rounded italic">Tempo de Espera: {item.recepcao.espera}</div>
                                                                            <div className="text-xs font-black text-foreground">Duração: {item.recepcao.duracao}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* PROCEDIMENTOS */}
                                                            {item.procedimentos.map((proc: any, idx: number) => (
                                                                <div key={idx} className="relative pl-8">
                                                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white" />
                                                                    <div className="bg-background py-4 px-5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex justify-between items-center">
                                                                        <div>
                                                                            <span className="text-[12px] font-black text-emerald-500 uppercase">{proc.especialidade || proc.especialiade}</span>
                                                                            <div className="text-xs font-bold uppercase">Sala {proc.sala} • {proc.profissional}</div>
                                                                            <div className="text-[10px] font-mono text-gray-400">{proc.periodo}</div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <div className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1 rounded italic">Tempo de Espera: {proc.espera_intervalo}</div>
                                                                            <div className="text-xs font-black text-foreground">Duração: {proc.duracao_sala}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* CARD RESUMO LATERAL */}
                                                    <div className="bg-gray-900 p-6 rounded-2xl text-white space-y-6 self-start shadow-xl">
                                                        <div>
                                                            <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-4">Resumo</h5>
                                                            <div className="flex justify-between items-end">
                                                                <span className="text-xs text-gray-400">Tempo Total na Clínica</span>
                                                                <span className="text-3xl font-black text-blue-400 leading-none">
                                                                    {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="pt-6 border-t border-gray-800 space-y-2">
                                                            <p className="text-[10px] flex justify-between uppercase"><span className="text-gray-500">Nascimento:</span> {item.cabecalho.nascimento || '---'}</p>
                                                            <p className="text-[10px] flex justify-between uppercase"><span className="text-gray-500">Idade:</span> {item.cabecalho.idade || '---'}</p>
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
    );
}