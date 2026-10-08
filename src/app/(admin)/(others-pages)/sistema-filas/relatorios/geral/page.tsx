'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Monitor, Search, ChevronDown, ChevronUp,
    Table as TableIcon, ArrowUpDown, Calendar1,
    ArrowRightCircle,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { BotaoImprimirRelatorio } from '@/components/atendimento/relatorios/ImprimirRelatorioGeral';
import { BotaoImprimirDeclaracao } from '@/components/atendimento/relatorios/ImprimirDelcaracao';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from '@/lib/supabase';

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

    const [formUnidade, setFormUnidade] = useState({
        razao_social: "",
        endereco: "",
        numero: "",
        bairro: "",
        cidade: "",
        estado: "",
        cnpj: "",
        logo_url: "",
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

                if (!data?.unidade_id) return;

                const { data: unidadeData } = await supabase
                    .from("unidades")
                    .select("*")
                    .eq("id", data.unidade_id)
                    .single();

                if (error) throw error;

                setFormUnidade({
                    razao_social: unidadeData.razao_social || "",
                    endereco: unidadeData.endereco || "",
                    numero: unidadeData.numero || "",
                    bairro: unidadeData.bairro || "",
                    cidade: unidadeData.cidade || "",
                    estado: unidadeData.estado || "",
                    cnpj: unidadeData.cnpj || "",
                    logo_url: unidadeData.logo_url || ""
                });

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

    // useEffect(() => {
    //     handleGerarRelatorio(new Event('change') as any);
    // }, [filtros.dataInicio, filtros.dataFim, filtros.horaInicio, filtros.horaFim, filtros.unidadeId]);

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
            setLoading(true);

            const formData = new FormData();
            formData.append("dataInicio", filtros.dataInicio);
            formData.append("dataFim", filtros.dataFim);
            formData.append("unidadeId", filtros.unidadeId);

            const start = await fetch("/api/relatorio", {
                method: "POST",
                body: formData
            });
            console.log("start", start);

            const { jobId } = await start.json();

            let terminou = false;

            while (!terminou) {

                await new Promise(r => setTimeout(r, 3000));

                const status = await fetch(
                    `/api/consulta-relatorios/?id=${jobId}`
                );

                const resultado = await status.json();

                const respostaBruta = Array.isArray(resultado)
                    ? resultado[0]
                    : resultado;

                const resposta = respostaBruta.json ?? respostaBruta;

                if (resposta.status === "processing") {
                    continue;
                }

                if (resposta.status === "empty") {
                    toast.warning(`0 atendimentos encontrados`);
                    terminou = true;

                }

                if (resposta.status === "done") {

                    terminou = true;

                    setDadosRelatorio(resposta.data);

                    toast.success(`${resposta.data.length} atendimentos encontrados`);
                }

            }
        }
        catch {
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

                const itensGrupo = grupoAtual.grupo_especialidade_itens || [];
                const especialidadesExcludentes = itensGrupo
                    .filter((i: any) => i.excludente === true)
                    .map((i: any) => normalizar(i.especialidades.nome));
                const especialidadesGrupo = itensGrupo
                    .filter((i: any) => i.excludente !== true)
                    .map((i: any) => normalizar(i.especialidades.nome));

                const especialidadesAtendimento: string[] =
                    (item.especialidades || []).map((e: string) => normalizar(e));

                if (especialidadesExcludentes.some(
                    (especialidade: string) => especialidadesAtendimento.includes(especialidade)
                )) return false;

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

                    const obrigatorias = itensGrupo
                        .filter((i: any) => i.obrigatoria === true && i.excludente !== true)
                        .map((i: any) => normalizar(i.especialidades.nome));

                    const adicionais = itensGrupo
                        .filter((i: any) => i.obrigatoria !== true && i.excludente !== true)
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

    const indicadores = useMemo(() => {

        const total = dadosFiltradosOrdenados.length;

        const normais = dadosFiltradosOrdenados.filter(
            item => item.cabecalho?.senha?.startsWith('N')
        ).length;

        const preferenciais = dadosFiltradosOrdenados.filter(
            item => item.cabecalho?.senha?.startsWith('P')
        ).length;

        const encaixes = dadosFiltradosOrdenados.filter(
            item => item.cabecalho?.encaixe === true
        ).length;

        const tempos = dadosFiltradosOrdenados.map(item => {

            const tempo =
                item.tempo_total_dispensado
                    ?.split('(')[1]
                    ?.replace(')', '');

            return parseTempoToSegundos(tempo);

        });

        const temposValidos = tempos.filter(t => t > 0);

        const mediaSegundos =
            temposValidos.length > 0
                ? temposValidos.reduce((a, b) => a + b, 0) / temposValidos.length
                : 0;

        const maiorTempo =
            temposValidos.length > 0
                ? Math.max(...temposValidos)
                : 0;

        const menorTempo =
            temposValidos.length > 0
                ? Math.min(...temposValidos)
                : 0;

        const formatarSegundos = (segundos: number) => {

            const h = Math.floor(segundos / 3600);
            const m = Math.floor((segundos % 3600) / 60);
            const s = Math.floor(segundos % 60);

            if (h > 0) {
                return `${h}h ${m}m`;
            }

            if (m > 0) {
                return `${m}m ${s}s`;
            }

            return `${s}s`;
        };

        return {
            total,
            normais,
            preferenciais,
            encaixes,
            mediaTempo: formatarSegundos(mediaSegundos),
            maiorTempo: formatarSegundos(maiorTempo),
            menorTempo: formatarSegundos(menorTempo)
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
                            obrigatoria,
                            excludente,
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
                "Empresa": item.cabecalho.empresa,
                "Funcionário": item.cabecalho.nome,
                "Sequencial Ficha": item.cabecalho.sequencial_ficha,
                "Tipo Exame": item.cabecalho.tipo_exame,
                "Acionamento": item.cabecalho.acionamento,
                "Recepcionista": item.recepcao?.atendente || "",

                "Fluxo de Atendimento":
                    item.procedimentos
                        ?.map((p: any) =>
                            `${p.especialidade} (${p.profissional})`
                        )
                        .join(" → "),
                "Exames": item.exames_atendimento.map((ex: any) => `${ex.exame} ${ex.realizado ? '✔️' : '❌'}`).join(', '),
                "Tempo Total": item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '',
            }));

            dadosFiltradosOrdenados.map(item => (
                console.log(item.recepcao, item.procedimentos)
            ));

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
                `RELATÓRIO DE ATENDIMENTOS - ${dataInicioStr} ${dataFimStr ? `até ${dataFimStr}` : ''}`;

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

            // MESCLA A1:K1
            ws["!merges"] = [
                {
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: 8 }
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
                { wch: 12 }, // Ficha
                { wch: 15 }, // Tipo Exame
                { wch: 15 }, // Acionamento
                { wch: 20 }, // Recepcionista
                { wch: 60 }, // Fluxo
                { wch: 60 }, // Exames
                { wch: 15 }, // Tempo Total
            ];

            // FILTRO AUTOMÁTICO NO CABEÇALHO
            ws["!autofilter"] = {
                ref: "A2:G2"
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
            for (let col = 0; col <= 8; col++) {

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

    return (
        <>
            <div className="min-h-screen rounded-xl bg-gray-500/20 p-2">
                <div className='w-full mx-auto space-y-6'>
                    {/* HEADER */}
                    <div className="bg-gray-900 rounded-2xl p-4 flex justify-between items-center border border-gray-700 shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-white uppercase">Relatório Geral de Atendimentos</h1>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest italic">Análise de Fluxo e Tempo</p>
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
                            <BotaoImprimirRelatorio item={dadosFiltradosOrdenados} unidade={formUnidade} text="Relatório Geral" />
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

                        <div className="bg-background border border-border rounded-2xl p-5">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">
                                Total de Atendimentos
                            </p>

                            <div className="mt-3">
                                <div className="text-3xl font-black">
                                    {indicadores.total}
                                </div>

                                <div className="mt-2 text-xs space-y-1">
                                    <div>
                                        Normal:
                                        <span className="font-bold ml-1 text-blue-600">
                                            {indicadores.normais}
                                        </span>
                                    </div>

                                    <div>
                                        Preferencial:
                                        <span className="font-bold ml-1 text-amber-600">
                                            {indicadores.preferenciais}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-background border border-border rounded-2xl p-5">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">
                                Tempo Médio
                            </p>

                            <div className="mt-3 text-3xl font-black">
                                {indicadores.mediaTempo}
                            </div>
                        </div>

                        <div className="bg-background border border-border rounded-2xl p-5">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">
                                Menor Permanência
                            </p>

                            <div className="mt-3 text-3xl font-black text-emerald-500">
                                {indicadores.menorTempo}
                            </div>
                        </div>


                        <div className="bg-background border border-border rounded-2xl p-5">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">
                                Maior Permanência
                            </p>

                            <div className="mt-3 text-3xl font-black text-red-500">
                                {indicadores.maiorTempo}
                            </div>
                        </div>

                        <div className="bg-background border border-border rounded-2xl p-5">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">
                                Encaixes
                            </p>

                            <div className="mt-3 text-3xl font-black">
                                {indicadores.encaixes}
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
                                    <th className="px-6 py-4 text-[11px] font-bold tracking-wider uppercase text-muted-foreground cursor-pointer" onClick={() => handleSort('tempo')}>
                                        <div className='flex items-center gap-2'>Permanência <ArrowUpDown className="w-3 h-3" /></div>
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
                                            <td className="px-6 py-4 flex flex-col items-center"><span className="text-xs font-black">{item.cabecalho.acionamento.split(' ')[1]}</span>
                                                <span className="text-xs font-sm">{item.cabecalho.acionamento.split(' ')[0]}</span></td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-black bg-blue-50 px-2 py-1 rounded text-blue-700">
                                                    {item.tempo_total_dispensado.split('(')[1]?.replace(')', '') || '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                <BotaoImprimirDeclaracao item={item} unidade={formUnidade} />
                                                <BotaoImprimirRelatorio item={[item]} text="Relatório" unidade={formUnidade} />
                                                <button onClick={() => setExpandedRow(expandedRow === item.cabecalho.atendimento_id ? null : item.cabecalho.atendimento_id)} className="p-2 rounded-lg bg-blue-600 text-white shadow-lg">
                                                    {expandedRow === item.cabecalho.atendimento_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </td>
                                        </tr>

                                        {expandedRow === item.cabecalho.atendimento_id && (
                                            <tr>
                                                <td colSpan={6} className="p-0 bg-blue-50/40 dark:bg-blue-900/10">
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
