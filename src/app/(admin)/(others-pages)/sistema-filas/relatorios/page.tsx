'use client';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, Users, Clock, Building2,
    ChevronDown, ChevronUp, Stethoscope, FileDown, Table as TableIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function PaginaRelatorio() {
    const [loading, setLoading] = useState(false);
    const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filtros, setFiltros] = useState({
        dataInicio: '',
        dataFim: '',
        unidadeId: '',
        buscaNome: ''
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

    // EXPORTAR EXCEL
    const exportToExcel = () => {
        const dataToExport = dadosFiltrados.map(item => ({
            Paciente: item.cabecalho.nome,
            Empresa: item.cabecalho.empresa,
            Senha: item.cabecalho.senha,
            Acionamento: item.cabecalho.acionamento,
            SLA_Total: item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '',
            Idade: item.cabecalho.idade
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
        XLSX.writeFile(wb, `Relatorio_Atendimento_${filtros.dataInicio}.xlsx`);
    };

    // EXPORTAR PDF
    const exportToPDF = () => {
        setLoading(true);
        try {
            const doc = new jsPDF();

            // 1. Cabeçalho do Documento
            doc.setFontSize(18);
            doc.text("Relatório de Atendimentos - Doctor's", 14, 20);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Período: ${filtros.dataInicio} até ${filtros.dataFim}`, 14, 28);
            doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 33);

            // 2. Preparar os dados para a tabela
            // Vamos criar uma linha para o paciente e sub-linhas para os procedimentos
            const tableRows: any[] = [];

            dadosFiltrados.forEach((item) => {
                // Linha Principal do Paciente
                tableRows.push([
                    {
                        content: `SENHA: ${item.cabecalho.senha}\n${item.cabecalho.nome}`,
                        styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
                    },
                    {
                        content: `${item.cabecalho.empresa}\nAcionamento: ${item.cabecalho.acionamento.split(' ')[1]}`,
                        styles: { fillColor: [240, 240, 240] }
                    },
                    {
                        content: `Total: ${item.tempo_total_dispensado?.split('(')[1]?.replace(')', '') || '---'}`,
                        styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] }
                    }
                ]);

                // Detalhes de Recepção e Procedimentos (Sub-linhas)
                let detalhes = `RECEPÇÃO: ${item.recepcao?.atendente} (${item.recepcao?.duracao})\n`;
                item.procedimentos?.forEach((p: any) => {
                    detalhes += `${p.especialiade.toUpperCase()}: ${p.profissional} (Sala: ${p.duracao_sala})\n`;
                });

                tableRows.push([
                    {
                        content: detalhes,
                        colSpan: 3,
                        styles: { fontSize: 8, textColor: [80, 80, 80], cellPadding: 5 }
                    }
                ]);
            });

            // 3. Gerar a Tabela
            autoTable(doc, {
                startY: 40,
                head: [['Identificação / Paciente', 'Empresa / Hora', 'Tempo de Atendimento']],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 80 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 40 },
                },
                didParseCell: function (data) {
                    // Estilização condicional se necessário
                }
            });

            // 4. Salvar
            doc.save(`Relatorio_Doctors_${filtros.dataInicio}.pdf`);
            toast.success("PDF gerado com sucesso via Data-Engine!");

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            toast.error("Erro ao processar os dados do relatório.");
        } finally {
            setLoading(false);
        }
    };

    const dadosFiltrados = dadosRelatorio.filter(item => {
    const nome = item?.cabecalho?.nome || "";
    const senha = item?.cabecalho?.senha || "";
    const busca = filtros.buscaNome.toLowerCase();

    return (
        nome.toLowerCase().includes(busca) ||
        senha.toLowerCase().includes(busca)
    );
});

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black/40 p-4 transition-colors">
            <div className='max-w-7xl mx-auto space-y-6'>

                {/* HEADER COM AÇÕES DE EXPORTAÇÃO */}
                <div className="bg-gray-900 dark:bg-gray-950 rounded-2xl shadow-xl p-4 flex flex-col md:flex-row justify-between items-center gap-6 border border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-tight">Atendimentos</h1>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Painel Operacional</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportToExcel} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                            <TableIcon className="w-4 h-4 mr-2" /> Excel
                        </Button>
                        <Button variant="outline" onClick={exportToPDF} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                            <FileDown className="w-4 h-4 mr-2" /> PDF
                        </Button>
                    </div>
                </div>

                {/* FILTROS - TEMA CLARO/ESCURO */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[250px] space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Pesquisa Rápida</label>
                            <div className="relative group">
                                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                    placeholder="Nome do paciente ou número da senha..."
                                    value={filtros.buscaNome}
                                    onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Início</label>
                                <input type="date" className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Fim</label>
                                <input type="date" className="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
                            </div>
                        </div>
                        <Button onClick={handleGerarRelatorio} disabled={loading} className="bg-blue-600 hover:bg-blue-700 h-[45px] px-8 rounded-xl font-bold shadow-lg shadow-blue-500/20">
                            {loading ? "Carregando..." : "FILTRAR"}
                        </Button>
                    </div>
                </div>

                {/* TABELA PRINCIPAL */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-gray-400">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Identificação</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Acionamento</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Tempo Total</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {dadosFiltrados.map((item) => {
                                const estaExpandido = expandedRow === item.cabecalho.atendimento_id;
                                return (
                                    <React.Fragment key={item.cabecalho.atendimento_id}>
                                        <tr className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${estaExpandido ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 min-w-[50px] text-center shadow-sm">
                                                        <span className="text-[9px] block text-gray-400 font-bold leading-none mb-1">SENHA</span>
                                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{item.cabecalho.senha}</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 dark:text-gray-100 uppercase text-sm">{item.cabecalho.nome}</div>
                                                        <div className="text-[11px] text-gray-500 flex items-center gap-1">
                                                            <Building2 className="w-3 h-3" /> {item.cabecalho.empresa}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400">
                                                    {item.cabecalho.acionamento.split(' ')[1]}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700">
                                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                                                        {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setExpandedRow(estaExpandido ? null : item.cabecalho.atendimento_id)}
                                                    className={`p-2 rounded-lg transition-all ${estaExpandido ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                >
                                                    {estaExpandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* DETALHES (TIMELINE) */}
                                        {estaExpandido && (
                                            <tr>
                                                <td colSpan={4} className="p-0 bg-gray-50/50 dark:bg-black/10">
                                                    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 border-b border-gray-200 dark:border-gray-800">
                                                        <div className="lg:col-span-2 space-y-6">
                                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                <Stethoscope className="w-3 h-3" /> Jornada do Atendimento
                                                            </h4>
                                                            <div className="relative border-l-2 border-gray-200 dark:border-gray-800 ml-3 space-y-6">
                                                                {/* Recepção */}
                                                                {item.recepcao && (
                                                                    <div className="relative pl-8">
                                                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-950" />
                                                                        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex justify-between items-center">
                                                                            <div>
                                                                                <span className="text-[9px] font-black text-blue-500 uppercase">Recepção</span>
                                                                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">{item.recepcao.atendente}</div>
                                                                                <div className="text-[10px] font-mono text-gray-400 mt-1">{item.recepcao.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xs font-black text-gray-700 dark:text-gray-300">{item.recepcao.duracao}</div>
                                                                                <div className="text-[9px] font-bold text-amber-600">Espera: {item.recepcao.espera}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {/* Procedimentos */}
                                                                {item.procedimentos.map((proc: any, idx: number) => (
                                                                    <div key={idx} className="relative pl-8">
                                                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-gray-950" />
                                                                        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex justify-between items-center transition-all hover:border-emerald-500/30">
                                                                            <div>
                                                                                <span className="text-[9px] font-black text-emerald-500 uppercase">{proc.especialiade}</span>
                                                                                <div className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase">Sala {proc.sala} • {proc.profissional}</div>
                                                                                <div className="text-[10px] font-mono text-gray-400 mt-1">{proc.periodo}</div>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <div className="text-xs font-black text-gray-700 dark:text-gray-300">{proc.duracao_sala}</div>
                                                                                <div className="text-[9px] font-bold text-amber-600">Troca: {proc.espera_intervalo}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Resumo Final */}
                                                        <div className="bg-gray-900 dark:bg-black p-6 rounded-3xl text-white space-y-6 shadow-2xl">
                                                            <div>
                                                                <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-4 tracking-widest">Performance</h5>
                                                                <div className="flex justify-between items-end">
                                                                    <span className="text-xs text-gray-400 italic">Total na Unidade</span>
                                                                    <span className="text-2xl font-black text-blue-400 leading-none">
                                                                        {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="pt-6 border-t border-gray-800 space-y-3">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase">Paciente</div>
                                                                <p className="text-xs flex justify-between uppercase"><span className="text-gray-400">Idade:</span> {item.cabecalho.idade}</p>
                                                                <p className="text-xs flex justify-between uppercase"><span className="text-gray-400">Nascimento:</span> {item.cabecalho.nascimento}</p>
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

                {/* EMPTY STATE */}
                {!loading && dadosFiltrados.length === 0 && (
                    <div className="text-center py-24 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 transition-colors">
                        <Users className="w-12 h-12 text-gray-200 dark:text-gray-800 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">Nenhum registro</h3>
                        <p className="text-gray-500 text-sm">Ajuste os filtros ou as datas para buscar novos dados.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Importação necessária para o Fragment
import React from 'react';

// 'use client';
// import { Button } from '@/components/ui/button';
// import {
//     Monitor, Search, Users, Clock, Building2,
//     ChevronDown, ChevronUp, Stethoscope, FileDown, Table as TableIcon
// } from 'lucide-react';
// import React, { useState, useEffect, useRef } from 'react';
// import { toast } from 'sonner';
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable'
// import * as XLSX from 'xlsx';

// export default function PaginaRelatorio() {
//     const [loading, setLoading] = useState(false);
//     const [isExporting, setIsExporting] = useState(false);
//     const [dadosRelatorio, setDadosRelatorio] = useState<any[]>([]);
//     const [expandedRow, setExpandedRow] = useState<string | null>(null);
//     const reportRef = useRef<HTMLDivElement>(null);

//     const [filtros, setFiltros] = useState({
//         dataInicio: '',
//         dataFim: '',
//         unidadeId: '',
//         buscaNome: ''
//     });

//     useEffect(() => {
//         const unidadeSalva = localStorage.getItem('unidade_ativa_id');
//         if (unidadeSalva) setFiltros(prev => ({ ...prev, unidadeId: unidadeSalva }));
//     }, []);

//     const handleGerarRelatorio = async (e: any) => {
//         e.preventDefault();
//         if (!filtros.dataInicio || !filtros.dataFim) {
//             toast.warning("Selecione o período.");
//             return;
//         }
//         setLoading(true);
//         try {
//             const formData = new FormData();
//             formData.append("dataInicio", filtros.dataInicio);
//             formData.append("dataFim", filtros.dataFim);
//             formData.append("unidadeId", filtros.unidadeId);

//             const res = await fetch("/api/relatorio", { method: "POST", body: formData });
//             const result = await res.json();
//             const data = Array.isArray(result) ? result : result.data || [];
//             const normalizado = data.map((item: any) => item.json || item);
//             setDadosRelatorio(normalizado);
//         } catch (error) {
//             toast.error("Erro ao carregar dados.");
//         } finally {
//             setLoading(false);
//         }
//     };

//     const exportToExcel = () => {
//         const dataToExport = dadosFiltrados.map(item => ({
//             Paciente: item.cabecalho.nome,
//             Empresa: item.cabecalho.empresa,
//             Senha: item.cabecalho.senha,
//             SLA: item.tempo_total_dispensado?.split('(')[1]?.replace(')', '') || '',
//         }));
//         const ws = XLSX.utils.json_to_sheet(dataToExport);
//         const wb = XLSX.utils.book_new();
//         XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
//         XLSX.writeFile(wb, `Relatorio_${filtros.dataInicio}.xlsx`);
//     };

//     // NOVA FUNÇÃO COM DOM-TO-IMAGE (Lida melhor com LAB/OKLCH)
//     const exportToPDF = () => {
//         setLoading(true);
//         try {
//             const doc = new jsPDF();

//             // 1. Cabeçalho do Documento
//             doc.setFontSize(18);
//             doc.text("Relatório de Atendimentos - Doctor's", 14, 20);
//             doc.setFontSize(10);
//             doc.setTextColor(100);
//             doc.text(`Período: ${filtros.dataInicio} até ${filtros.dataFim}`, 14, 28);
//             doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 33);

//             // 2. Preparar os dados para a tabela
//             // Vamos criar uma linha para o paciente e sub-linhas para os procedimentos
//             const tableRows: any[] = [];

//             dadosFiltrados.forEach((item) => {
//                 // Linha Principal do Paciente
//                 tableRows.push([
//                     {
//                         content: `SENHA: ${item.cabecalho.senha}\n${item.cabecalho.nome}`,
//                         styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
//                     },
//                     {
//                         content: `${item.cabecalho.empresa}\nAcionamento: ${item.cabecalho.acionamento.split(' ')[1]}`,
//                         styles: { fillColor: [240, 240, 240] }
//                     },
//                     {
//                         content: `Total: ${item.tempo_total_dispensado?.split('(')[1]?.replace(')', '') || '---'}`,
//                         styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] }
//                     }
//                 ]);

//                 // Detalhes de Recepção e Procedimentos (Sub-linhas)
//                 let detalhes = `RECEPÇÃO: ${item.recepcao?.atendente} (${item.recepcao?.duracao})\n`;
//                 item.procedimentos?.forEach((p: any) => {
//                     detalhes += `${p.especialiade.toUpperCase()}: ${p.profissional} (Sala: ${p.duracao_sala})\n`;
//                 });

//                 tableRows.push([
//                     {
//                         content: detalhes,
//                         colSpan: 3,
//                         styles: { fontSize: 8, textColor: [80, 80, 80], cellPadding: 5 }
//                     }
//                 ]);
//             });

//             // 3. Gerar a Tabela
//             autoTable(doc, {
//                 startY: 40,
//                 head: [['Identificação / Paciente', 'Empresa / Hora', 'Tempo de Atendimento']],
//                 body: tableRows,
//                 theme: 'grid',
//                 headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
//                 styles: { fontSize: 9, cellPadding: 3 },
//                 columnStyles: {
//                     0: { cellWidth: 80 },
//                     1: { cellWidth: 70 },
//                     2: { cellWidth: 40 },
//                 },
//                 didParseCell: function (data) {
//                     // Estilização condicional se necessário
//                 }
//             });

//             // 4. Salvar
//             doc.save(`Relatorio_Doctors_${filtros.dataInicio}.pdf`);
//             toast.success("PDF gerado com sucesso via Data-Engine!");

//         } catch (error) {
//             console.error("Erro ao gerar PDF:", error);
//             toast.error("Erro ao processar os dados do relatório.");
//         } finally {
//             setLoading(false);
//         }
//     };

//     const dadosFiltrados = dadosRelatorio.filter(item =>
//         item.cabecalho.nome.toLowerCase().includes(filtros.buscaNome.toLowerCase()) ||
//         item.cabecalho.senha.toLowerCase().includes(filtros.buscaNome.toLowerCase())
//     );

//     return (
//         <div className="min-h-screen bg-gray-50 dark:bg-black/40 p-4 transition-colors">
//             <div className='max-w-7xl mx-auto space-y-6'>

//                 {/* HEADER */}
//                 <div className="bg-gray-900 rounded-2xl p-4 flex justify-between items-center border border-gray-700">
//                     <div className="flex items-center gap-4">
//                         <Monitor className="w-6 h-6 text-blue-400" />
//                         <div>
//                             <h1 className="text-xl font-black text-white uppercase">Relatório Operacional</h1>
//                         </div>
//                     </div>
//                     <div className="flex gap-2">
//                         <Button variant="outline" onClick={exportToExcel} className="text-white border-gray-600">
//                             <TableIcon className="w-4 h-4 mr-2" /> Excel
//                         </Button>
//                         <Button variant="outline" onClick={exportToPDF} disabled={loading} className="text-white border-gray-600">
//                             <FileDown className="w-4 h-4 mr-2" /> {isExporting ? "Gerando..." : "PDF Completo"}
//                         </Button>
//                     </div>
//                 </div>

//                 {/* FILTROS */}
//                 <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 space-y-4">
//                     <div className="flex flex-wrap gap-4 items-end">
//                         <div className="flex-1 min-w-[250px] space-y-2">
//                             <label className="text-[10px] font-black text-gray-400 uppercase">Busca</label>
//                             <input
//                                 type="text"
//                                 className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl dark:text-white"
//                                 placeholder="Nome do paciente..."
//                                 value={filtros.buscaNome}
//                                 onChange={(e) => setFiltros({ ...filtros, buscaNome: e.target.value })}
//                             />
//                         </div>
//                         <Button onClick={handleGerarRelatorio} className="bg-blue-600 h-[42px] px-8">FILTRAR</Button>
//                     </div>
//                 </div>

//                 {/* AREA DE CAPTURA - ADICIONADO ID PARA O DOM-TO-IMAGE */}
//                 <div
//                     id="area-relatorio"
//                     className={`bg-white rounded-2xl overflow-hidden ${isExporting ? 'p-8' : 'dark:bg-gray-900 border border-gray-200 dark:border-gray-800'}`}
//                 >
//                     <table className="w-full text-left">
//                         <thead>
//                             <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-400">
//                                 <th className="px-6 py-4 text-[10px] font-black uppercase">Paciente / Senha</th>
//                                 <th className="px-6 py-4 text-[10px] font-black uppercase">Hora</th>
//                                 <th className="px-6 py-4 text-[10px] font-black uppercase text-center">SLA</th>
//                                 {!isExporting && <th className="px-6 py-4"></th>}
//                             </tr>
//                         </thead>
//                         <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
//                             {dadosFiltrados.map((item) => {
//                                 const estaExpandido = isExporting || (expandedRow === item.cabecalho.atendimento_id);
//                                 return (
//                                     <React.Fragment key={item.cabecalho.atendimento_id}>
//                                         <tr className={estaExpandido && !isExporting ? 'bg-blue-50/20' : ''}>
//                                             <td className="px-6 py-4">
//                                                 <div className="flex items-center gap-3">
//                                                     <span className="font-black text-blue-600">{item.cabecalho.senha}</span>
//                                                     <span className="font-bold text-gray-700 dark:text-gray-200">{item.cabecalho.nome}</span>
//                                                 </div>
//                                             </td>
//                                             <td className="px-6 py-4 text-xs font-mono">{item.cabecalho.acionamento.split(' ')[1]}</td>
//                                             <td className="px-6 py-4 text-center font-black text-xs">
//                                                 {item.tempo_total_dispensado?.split('(')[1]?.replace(')', '') || '---'}
//                                             </td>
//                                             {!isExporting && (
//                                                 <td className="px-6 py-4 text-right">
//                                                     <button onClick={() => setExpandedRow(estaExpandido ? null : item.cabecalho.atendimento_id)}>
//                                                         {estaExpandido ? <ChevronUp /> : <ChevronDown />}
//                                                     </button>
//                                                 </td>
//                                             )}
//                                         </tr>
//                                         {estaExpandido && (
//                                             <tr>
//                                                 <td colSpan={4} className="p-6 bg-gray-50/50 dark:bg-black/20">
//                                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//                                                         <div className="md:col-span-2 space-y-3">
//                                                             {/* TIMELINE SIMPLIFICADA PARA PDF */}
//                                                             <div className="border-l-2 border-blue-500 pl-4 space-y-4">
//                                                                 <div className="text-xs">
//                                                                     <p className="font-black text-blue-500 uppercase">Recepção</p>
//                                                                     <p className="font-bold">{item.recepcao?.atendente}</p>
//                                                                     <p className="text-gray-500">Duração: {item.recepcao?.duracao}</p>
//                                                                 </div>
//                                                                 {item.procedimentos?.map((p: any, i: number) => (
//                                                                     <div key={i} className="text-xs">
//                                                                         <p className="font-black text-emerald-500 uppercase">{p.especialiade}</p>
//                                                                         <p className="font-bold">{p.profissional}</p>
//                                                                         <p className="text-gray-500">Sala: {p.duracao_sala}</p>
//                                                                     </div>
//                                                                 ))}
//                                                             </div>
//                                                         </div>
//                                                         <div className="bg-gray-900 p-4 rounded-xl text-white">
//                                                             <p className="text-[10px] text-gray-400 uppercase">Idade: {item.cabecalho.idade}</p>
//                                                             <p className="text-[10px] text-gray-400 uppercase">Empresa: {item.cabecalho.empresa}</p>
//                                                             <div className="mt-4 border-t border-gray-700 pt-2">
//                                                                 <p className="text-blue-400 font-black text-lg">{item.tempo_total_dispensado?.split('(')[1]?.replace(')', '')}</p>
//                                                             </div>
//                                                         </div>
//                                                     </div>
//                                                 </td>
//                                             </tr>
//                                         )}
//                                     </React.Fragment>
//                                 );
//                             })}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         </div>
//     );
// }