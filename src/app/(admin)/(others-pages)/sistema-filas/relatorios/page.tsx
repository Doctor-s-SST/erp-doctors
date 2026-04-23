'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Users, Clock, Building2,
    ChevronDown, ChevronUp, Stethoscope, FileDown, Table as TableIcon,
    ArrowRightCircle, LogIn, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BotaoImprimirRelatorio } from '@/components/atendimento/relatorios/ImprimirRelatorioGeral';
import { BotaoImprimirDeclaracao } from '@/components/atendimento/relatorios/ImprimirDelcaracao';


export default function PaginaRelatorio() {
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filtros, setFiltros] = useState({
        dataInicio: '',
        dataFim: '',
        unidadeId: '',
        buscaNome: '',
        tipoSenha: 'todos'
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

            const normalizado = data.map((item: any) => item.json || item);
            setDadosRelatorio(normalizado);
            toast.success(`${normalizado.length} atendimentos encontrados.`);
        } catch (error) {
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const dadosFiltrados = dadosRelatorio.filter(item => {
        const nome = item?.cabecalho?.nome || "";
        const senha = item?.cabecalho?.senha || "";
        const busca = filtros.buscaNome.toLowerCase();

        // Lógica do filtro de tipo de senha
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

    const exportToExcel = () => {
        const dataToExport = dadosFiltrados.map(item => ({
            Paciente: item.cabecalho.nome,
            Empresa: item.cabecalho.empresa,
            Senha: item.cabecalho.senha,
            Acionamento: item.cabecalho.acionamento,
            Tempo_Total: item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '',
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `Relatorio_Atendimento_${filtros.dataInicio}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Relatório de Atendimentos SST", 14, 20);

        const tableRows: any[] = [];
        dadosFiltrados.forEach((item) => {
            tableRows.push([
                { content: `SENHA: ${item.cabecalho.senha}\n${item.cabecalho.nome}`, styles: { fontStyle: 'bold', fillColor: [245, 245, 245] } },
                { content: `INÍCIO: ${item.cabecalho.acionamento.split(' ')[1]}\nTOTAL: ${item.tempo_total_dispensado.split('(')[1]?.replace(')', '')}`, styles: { fillColor: [245, 245, 245] } },
                { content: `${item.cabecalho.empresa}`, styles: { fillColor: [245, 245, 245] } }
            ]);

            let detalhes = `RECEPÇÃO: ${item.recepcao?.duracao} (Espera: ${item.recepcao?.espera})\n`;
            item.procedimentos?.forEach((p: any) => {
                detalhes += `${p.especialidade || p.especialiade}: ${p.duracao_sala} (Intervalo: ${p.espera_intervalo})\n`;
            });
            tableRows.push([{ content: detalhes, colSpan: 3, styles: { fontSize: 8, textColor: [100, 100, 100] } }]);
        });

        autoTable(doc, {
            startY: 30,
            head: [['Paciente / Senha', 'Tempos', 'Empresa']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42] }
        });
        doc.save(`Relatorio_Doctors_${filtros.dataInicio}.pdf`);
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
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Emissão de Relatório e Declaração de Comparecimento</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportToExcel} className="border-gray-600 text-gray-300 hover:bg-gray-800"><TableIcon className="w-4 h-4 mr-2" /> Excel</Button>
                        {/* <Button variant="outline" onClick={exportToPDF} className="border-gray-600 text-gray-300 hover:bg-gray-800"><FileDown className="w-4 h-4 mr-2" /> PDF</Button> */}
                        <BotaoImprimirRelatorio item={dadosFiltrados} />
                    </div>
                </div>

                {/* FILTROS */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[250px] space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Buscar por Nome ou Senha</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
                                    placeholder="João Carlos... N001..." value={filtros.buscaNome} onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })} />
                            </div>
                        </div>

                        {/* FILTRO: TIPO DE SENHA */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tipo de Senha</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                value={filtros.tipoSenha}
                                onChange={(e) => setFiltros({ ...filtros, tipoSenha: e.target.value })}
                            >
                                <option value="todos">Todos os Tipos</option>
                                <option value="normal">Normal</option>
                                <option value="preferencial">Preferencial</option>
                                <option value="encaixe">Encaixe</option>
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <input type="date" className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl text-sm" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
                            <input type="date" className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 rounded-xl text-sm" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
                        </div>
                        <Button onClick={handleGerarRelatorio} disabled={loading} className="bg-blue-600 hover:bg-blue-700 h-[45px] px-8 rounded-xl font-bold uppercase">
                            {loading ? "Processando..." : "Gerar Relatório"}
                        </Button>
                    </div>
                </div>

                {/* TABELA */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 text-gray-400">
                                <th className="px-6 py-4 text-[10px] font-black uppercase">Paciente / Senha</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase"><div className='flex items-center gap-2'><LogIn className='w-3 h-3' /> Acionamento</div></th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-center">Tempo de Permanência</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {dadosFiltrados.map((item) => {
                                const estaExpandido = expandedRow === item.cabecalho.atendimento_id;
                                return (
                                    <React.Fragment key={item.cabecalho.atendimento_id}>
                                        <tr className={`transition-colors ${estaExpandido ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col bg-gray-100 dark:bg-gray-800 border border-gray-200 rounded-lg px-3 py-1 text-center">
                                                        <span className="text-[14px] font-black text-blue-600">{item.cabecalho.senha}</span>
                                                        {item.cabecalho.encaixe &&
                                                            <span className='text-[9px] font-black text-green-600 uppercase'>Encaixe</span>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-gray-100 uppercase text-sm">{item.cabecalho.nome}</div>
                                                        <div className="text-[11px] text-gray-500 uppercase">{item.cabecalho.empresa}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-gray-700 dark:text-gray-300">{item.cabecalho.acionamento.split(' ')[1]}</span>
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase">Emissão da Senha</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100">
                                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                                                        {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center gap-2">
                                                <BotaoImprimirDeclaracao item={item} />

                                                <button onClick={() => setExpandedRow(estaExpandido ? null : item.cabecalho.atendimento_id)}
                                                    className="p-2 rounded-lg bg-blue-600 text-white shadow-lg hover:opacity-90 transition-all">
                                                    {estaExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {estaExpandido && (
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
                                                                        <div className="bg-white dark:bg-gray-900 py-4 px-5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex justify-between items-center">
                                                                            <div>
                                                                                <span className="text-[12px] font-black text-blue-500 uppercase">Recepção</span>
                                                                                <div className="text-xs font-bold uppercase">{item.recepcao.atendente}</div>
                                                                                <div className="text-[10px] font-mono text-gray-400">{item.recepcao.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 rounded italic">Tempo de Espera: {item.recepcao.espera}</div>
                                                                                <div className="text-xs font-black text-gray-700 dark:text-gray-200">Duração: {item.recepcao.duracao}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* PROCEDIMENTOS */}
                                                                {item.procedimentos.map((proc: any, idx: number) => (
                                                                    <div key={idx} className="relative pl-8">
                                                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white" />
                                                                        <div className="bg-white dark:bg-gray-900 py-4 px-5 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm flex justify-between items-center">
                                                                            <div>
                                                                                <span className="text-[12px] font-black text-emerald-500 uppercase">{proc.especialidade || proc.especialiade}</span>
                                                                                <div className="text-xs font-bold uppercase">Sala {proc.sala} • {proc.profissional}</div>
                                                                                <div className="text-[10px] font-mono text-gray-400">{proc.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1 rounded italic">Tempo de Espera: {proc.espera_intervalo}</div>
                                                                                <div className="text-xs font-black text-gray-700 dark:text-gray-200">Duração: {proc.duracao_sala}</div>
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}