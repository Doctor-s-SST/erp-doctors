'use client';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Users, Clock, Building2,
    ChevronDown, ChevronUp, UserCheck, Stethoscope, ArrowRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function PaginaRelatorio() {
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filtros, setFiltros] = useState({
        dataInicio: '',
        dataFim: '',
        unidadeId: '',
        buscaNome: '' // Novo filtro local
    });

    useEffect(() => {
        const unidadeSalva = localStorage.getItem('unidade_ativa_id');
        if (unidadeSalva) setFiltros(prev => ({ ...prev, unidadeId: unidadeSalva }));
    }, []);

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

            // O n8n costuma retornar [{json: {...}}], vamos normalizar:
            const normalizado = data.map((item: any) => item.json || item);
            setDadosRelatorio(normalizado);
            toast.success(`${normalizado.length} atendimentos encontrados.`);
        } catch (error) {
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    // Filtro em tempo real no front para facilitar localização
    const dadosFiltrados = dadosRelatorio.filter(item =>
        item.cabecalho.nome.toLowerCase().includes(filtros.buscaNome.toLowerCase()) ||
        item.cabecalho.senha.toLowerCase().includes(filtros.buscaNome.toLowerCase())
    );

    return (
        <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
            <div className='w-full mx-auto space-y-5'>
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-600">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-3 rounded-xl">
                            <Monitor className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Dashboard - Atendimentos</h1>
                            {/* <p className="text-gray-400 text-[11px] font-bold tracking-[0.2em]">{new Date().toLocaleDateString("pt-BR")}</p> */}
                        </div>
                    </div>
                </div>

                {/* BARRA DE FILTROS SUPERIOR */}
                <div className="bg-white dark:bg-gray-900 dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-600 p-5 space-y-4">

                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px] space-y-1">
                            <label className="text-[10px] font-bold uppercase">Buscar Paciente / Senha</label>
                            <div className="relative border border-gray-600 rounded-lg">
                                <Search className="w-4 h-4 absolute left-3 top-2" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="Nome ou senha..."
                                    value={filtros.buscaNome}
                                    onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase">Data Inicial</label>
                                <input type="date" className="w-full p-2 text-sm border border-gray-600 rounded-lg"
                                    value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase">Data Final</label>
                                <input type="date" className="w-full p-2 border border-gray-600 rounded-lg text-sm"
                                    value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
                            </div>
                        </div>
                        <Button onClick={handleGerarRelatorio} disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-8">
                            {loading ? "Processando..." : "Atualizar Dados"}
                        </Button>
                    </div>
                </div>

                {/* TABELA */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-600 overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="50 border-b border-gray-600">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Identificação</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Horários</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">SLA Total</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {dadosFiltrados.map((item) => {
                                const estaExpandido = expandedRow === item.cabecalho.atendimento_id;
                                return (
                                    <>
                                        <tr key={item.cabecalho.atendimento_id} className={`hover:80 transition-all ${estaExpandido ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-600 rounded-lg h-12 w-12 shadow-sm">
                                                        <span className="text-[10px] font-bold leading-none">SENHA</span>
                                                        <span className="text-sm font-black text-blue-600">{item.cabecalho.senha}</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm uppercase">{item.cabecalho.nome}</div>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                                            <Building2 className="w-3 h-3" /> {item.cabecalho.empresa}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-[11px] font-medium text-slate-500">Acionamento</div>
                                                <div className="text-xs font-mono font-bold text-slate-700">{item.cabecalho.acionamento.split(' ')[1]}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full">
                                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="text-xs font-black text-slate-700">
                                                        {item.tempo_total_dispensado.includes('(') ? item.tempo_total_dispensado.split('(')[1].replace(')', '') : '---'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setExpandedRow(estaExpandido ? null : item.cabecalho.atendimento_id)}
                                                    className={`p-2 rounded-lg transition-all ${estaExpandido ? 'bg-blue-600 text-white' : 'hover:bg-slate-200'}`}
                                                >
                                                    {estaExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* EXPANSÃO - FLUXO DETALHADO */}
                                        {estaExpandido && (
                                            <tr>
                                                <td colSpan={4} className="p-0 bg-white dark:bg-gray-900 border-b border-gray-600">
                                                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">

                                                        {/* Timeline Lateral */}
                                                        <div className="lg:col-span-2 space-y-4">
                                                            <h4 className="text-[10px] font-black uppercase flex items-center gap-2">
                                                                <Stethoscope className="w-3 h-3" /> Fluxo de Atendimento
                                                            </h4>

                                                            <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 pb-2">
                                                                {/* Item Recepção */}
                                                                {item.recepcao && (
                                                                    <div className="relative pl-6">
                                                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-sm" />
                                                                        <div className="p-3 rounded-xl border border-gray-600 flex justify-between items-center">
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Recepção</span>
                                                                                <div className="text-xs font-bold text-slate-700 uppercase">{item.recepcao.atendente}</div>
                                                                                <div className="text-[10px] font-mono mt-1">{item.recepcao.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] uppercase">Duração</div>
                                                                                <div className="text-xs font-black text-slate-700">{item.recepcao.duracao}</div>
                                                                                <div className="text-[9px] text-amber-600 font-bold">Espera: {item.recepcao.espera}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Itens Procedimentos */}
                                                                {item.procedimentos.map((proc: any, i: number) => (
                                                                    <div key={i} className="relative pl-6">
                                                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                                                                        <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-600 flex justify-between items-center hover:shadow-md transition-shadow">
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">{proc.especialiade}</span>
                                                                                <div className="text-xs font-bold text-slate-700 uppercase">Sala {proc.sala} • {proc.profissional}</div>
                                                                                <div className="text-[10px] font-mono mt-1">{proc.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-[10px] uppercase">Execução</div>
                                                                                <div className="text-xs font-black text-slate-700">{proc.duracao_sala}</div>
                                                                                <div className="text-[9px] text-amber-600 font-bold">Troca: {proc.espera_intervalo}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Card de Resumo Lateral */}
                                                        <div className="bg-slate-900 rounded-2xl p-5 text-white h-fit space-y-4">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest">Resumo do Ciclo</h4>
                                                            <div className="space-y-4">
                                                                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                                                    <span className="text-xs">Total na Unidade</span>
                                                                    <span className="text-lg font-black text-blue-400">{item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs">Status Final</span>
                                                                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Concluído</span>
                                                                </div>
                                                            </div>
                                                            <div className="pt-4">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Dados do Paciente</div>
                                                                <div className="text-xs space-y-1">
                                                                    <p className="flex justify-between"><span>Idade:</span> <span className="text-slate-300">{item.cabecalho.idade}</span></p>
                                                                    <p className="flex justify-between"><span>Nascimento:</span> <span className="text-slate-300">{item.cabecalho.nascimento}</span></p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}