"use client"

import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertCircle,
    Clock3,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Save,
    Send,
} from "lucide-react";
import { FuncionarioModal } from "./FuncionarioModal";
import { ConfirmarAcaoDialog } from "./ConfirmarAcaoDialog";
import { correspondeAoGrupoExames, FiltroGrupoExames } from "./FiltroGrupoExames";
import { FiltroPrazoAso, FiltroPrazoCards } from "./FiltroPrazoCards";
import { PainelFiltrosExames } from "./PainelFiltrosExames";
import { useFiltrosTabelaExames } from "../hooks/useFiltrosTabelaExames";
import { ViewExamesPendentesProps } from "../types";
import {
    classificarTipoExame,
    compararValores,
    normalizarNomeExame,
    parseDateBR,
    parseDateValue,
    adicionarDiasUteis,
    calcularStatusVencimentoVisual,
    exameEstaConcluido,
    possuiAsoMontado,
    obterCpfFuncionario,
    obterIdentificadorFuncionario,
} from "../utils";
import { toast } from "sonner";
import { criarPacienteAssinatura, criarPayloadAcaoAso } from "@/lib/aso-assinatura";
import {
    interpretarRespostaAcaoAso,
    mensagemErrosFuncionarios,
    solicitarResultadoAcaoAso,
} from "@/lib/resultado-acao-aso";

const classificarPrazoPendencia = (item: any): Exclude<FiltroPrazoAso, "todos"> => {
    const examesComStatus = (item.examesDetalhados || []).filter(
        (exame: any) => exame.statusPrazoExame
    );
    if (!examesComStatus.length) return "suspenso";
    return examesComStatus.some((exame: any) => exame.statusPrazoExame.estaVencido)
        ? "vencido"
        : "no-prazo";
};

export function ViewExamesPendentes({
    analytics,
    todosFuncionarios,
    funcionariosSalvos,
    onFuncionariosSalvos,
    filtroTipoExame,
    unidadeId,
    prazosMap,
    cpfsAtendimentosConcluidos,
    onAtendimentosConcluidos,
    cpfsEnviadosDireto,
    onAsosEnviadosDireto,
}: ViewExamesPendentesProps) {
    const pendencias = analytics?.funcionariosComExamesPendentes || [];

    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const {
        busca, setBusca,
        filtroMedico, setFiltroMedico,
        filtroExameEspecifico, setFiltroExameEspecifico,
        filtroPrestador, setFiltroPrestador,
        dataInicio, setDataInicio,
        dataFim, setDataFim,
        grupoExames, setGrupoExames,
        filtroPrazoAso, setFiltroPrazoAso,
        limparFiltros,
    } = useFiltrosTabelaExames();
    const [sortKey, setSortKey] = useState<string>("nome");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());

    // Aba ativa: "pendentes" (ainda não montados) ou "montados" (já salvos/montados)
    const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "montados">("pendentes");

    const [saving, setSaving] = useState(false);
    const [sendingAso, setSendingAso] = useState(false);
    const [concluindoAtendimento, setConcluindoAtendimento] = useState(false);
    const [acaoParaConfirmar, setAcaoParaConfirmar] = useState<"salvar" | "enviar" | "concluido" | null>(null);
    const operacaoEmAndamento = useRef(false);
    const processandoAcao = saving || sendingAso || concluindoAtendimento;

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(15);

    /* ============================================================
       ORDENAÇÃO
    ============================================================ */
    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
       MAPA FUNCIONÁRIOS
    ============================================================ */
    const funcionariosMapeados = useMemo(() => {
        const map = new Map<string, any>();

        todosFuncionarios?.forEach((item) => {
            const res = item.socResumo || item;
            if (!res) return;

            map.set(obterIdentificadorFuncionario(item), item);
        });

        return map;
    }, [todosFuncionarios]);

    /* ============================================================
       FILTRO POR TIPO DE EXAME
    ============================================================ */
    const pendenciasFiltradas = useMemo(() => {
        if (filtroTipoExame === "todos") {
            return pendencias;
        }

        return pendencias.filter((item: any) => {
            const funcionario = funcionariosMapeados.get(obterIdentificadorFuncionario(item)) || item;

            return classificarTipoExame(funcionario, prazosMap) === filtroTipoExame;
        });
    }, [pendencias, funcionariosMapeados, filtroTipoExame, prazosMap]);

    /* ============================================================
       PROCESSA PENDÊNCIAS COM STATUS DE EXAME
       (sem filtro de busca, para que indicadores fiquem estáveis)
    ============================================================ */
    const pendenciasComStatus = useMemo(() => {
        return pendenciasFiltradas.map((item: any) => {
            const identificador = obterIdentificadorFuncionario(item);
            const fDados = funcionariosMapeados.get(identificador);
            const cpf = obterCpfFuncionario(fDados || item);

            const nome =
                item.nomeFuncionario ||
                item.nome ||
                fDados?.nomeFuncionario ||
                fDados?.nome ||
                "Não Informado";

            const empresa =
                fDados?.razaoSocial || fDados?.empresa || item.empresa || item.unidade || "-";
            const codigoEmpresa =
                fDados?.codigoEmpresa || fDados?.codigo_empresa || item.codigoEmpresa || item.codigo_empresa;
            const codigoGed = fDados?.aso?.codigoGed || fDados?.codigo_ged || item.codigoGed || item.codigo_ged;
            const dataCriacaoGed = fDados?.aso?.dataCriacaoGed || fDados?.codigo_ged || item.codigoGed || item.codigo_ged;
            const dataFicha = fDados?.aso?.dataFicha || fDados?.dataFicha || item.dataFicha || null;

            // Exames pendentes reportados para este funcionário
            const examesReportados: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""];

            const listaCompletaExames: any[] =
                fDados?.aso?.listaExamesResumida || fDados?.listaExamesResumida || [];

            const todosExames = listaCompletaExames.length > 0
                ? listaCompletaExames
                    .map((exame: any) => exame?.descricaoExame || exame?.nomeExame || exame?.nome)
                    .filter(Boolean)
                : examesReportados.filter(Boolean);

            const examesList = examesReportados.filter((nomeExame: string) => {
                const nomeNormalizado = normalizarNomeExame(nomeExame);
                const info = listaCompletaExames.find(
                    (exame: any) => normalizarNomeExame(
                        exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
                    ) === nomeNormalizado
                );

                return !info || !exameEstaConcluido(info, prazosMap);
            });

            const temPendenciaReal = examesList.length > 0;

            const examesDetalhados = examesList.map((nomeExame: string) => {
                const nomeNormalizado = normalizarNomeExame(nomeExame);
                const prazoConfig = prazosMap[nomeNormalizado];
                const ignorado = Boolean(prazoConfig?.ignorar_exame);

                const info = listaCompletaExames.find(
                    (e: any) =>
                        normalizarNomeExame(e?.descricaoExame || e?.nomeExame || e?.nome || "") ===
                        nomeNormalizado
                );

                const dataExame = info?.dataExame || null;
                const temRelacao = info?.temRelacao ?? null;

                let statusPrazoExame = null;

                // A flag dispensa somente o GED; prazo e data continuam válidos.
                const prazoDias = Number(prazoConfig?.prazo_dias);
                const possuiPrazoValido = Boolean(prazoConfig) &&
                    Number.isFinite(prazoDias) &&
                    prazoDias >= 0;

                if (dataExame && possuiPrazoValido) {
                    const dataBase = parseDateBR(dataExame);

                    if (dataBase) {
                        const dataLimite = adicionarDiasUteis(dataBase, prazoDias);
                        statusPrazoExame = calcularStatusVencimentoVisual(dataLimite);
                    }
                }

                return { nome: nomeExame, dataExame, temRelacao, statusPrazoExame, ignorado };
            });

            const medicoExaminador = fDados?.aso?.medico || item.medico || "Não informado";
            const sequencialFicha = fDados?.aso?.sequencialFicha || item.sequencialFicha || "-";

            return {
                ...item,
                cpf,
                identificador,
                nome,
                empresa,
                codigoEmpresa,
                codigoGed,
                dataCriacaoGed,
                dataFicha,
                examesList,
                todosExames,
                examesDetalhados,
                medicoExaminador,
                sequencialFicha,
                prestador:
                    item.prestador ||
                    fDados?.prestador ||
                    fDados?.socResumo?.prestador ||
                    fDados?.aso?.prestador ||
                    "Não informado",
                observacao:
                    item.observacao ||
                    fDados?.observacao ||
                    fDados?.socResumo?.observacao ||
                    fDados?.aso?.observacao ||
                    "",
                temPendenciaReal,
            };
        });
    }, [pendenciasFiltradas, funcionariosMapeados, prazosMap]);

    const pendenciasVisiveis = useMemo(
        () => pendenciasComStatus.filter((item: any) => item.temPendenciaReal),
        [pendenciasComStatus]
    );

    /* ============================================================
       HELPER: FUNCIONÁRIO JÁ MONTADO/SALVO
    ============================================================ */
    const isFuncionarioMontado = (funcionario: any) => {
        if (!funcionario) return false;
        return Boolean(
            funcionariosSalvos?.has(obterIdentificadorFuncionario(funcionario)) ||
            possuiAsoMontado(funcionario.observacao)
        );
    };

    /* ============================================================
       LISTAS PARA OS FILTROS (MÉDICO / EXAME)
    ============================================================ */
    const listaMedicosPendentes = useMemo(() => {
        const setM = new Set<string>();

        pendenciasVisiveis.forEach((f: any) => {
            if (f.medicoExaminador) setM.add(f.medicoExaminador);
        });

        return Array.from(setM).sort();
    }, [pendenciasVisiveis]);

    const listaExamesPendentes = useMemo(() => {
        const setE = new Set<string>();

        pendenciasVisiveis.forEach((f: any) => {
            (f.todosExames || []).forEach((exame: string) => {
                if (exame) setE.add(exame);
            });
        });

        return Array.from(setE).sort();
    }, [pendenciasVisiveis]);

    const listaPrestadoresPendentes = useMemo(() => {
        return Array.from(new Set<string>(
            pendenciasVisiveis
                .map((item: any) => item.prestador)
                .filter((prestador: string) => prestador && prestador !== "Não informado")
        )).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [pendenciasVisiveis]);

    /* ============================================================
       FILTROS DE MÉDICO / EXAME ESPECÍFICO
       (sem busca e sem aba, para que os contadores das abas
       fiquem estáveis)
    ============================================================ */
    const pendenciasComFiltros = useMemo(() => {
        return pendenciasVisiveis.filter((item: any) => {
            if (cpfsAtendimentosConcluidos.has(obterIdentificadorFuncionario(item))) {
                return false;
            }

            if (filtroMedico !== "todos" && item.medicoExaminador !== filtroMedico) {
                return false;
            }

            if (filtroPrestador !== "todos" && item.prestador !== filtroPrestador) {
                return false;
            }

            const dataFicha = parseDateValue(item.dataFicha);
            if (dataInicio && (!dataFicha || dataFicha < new Date(`${dataInicio}T00:00:00`))) return false;
            if (dataFim && (!dataFicha || dataFicha > new Date(`${dataFim}T23:59:59.999`))) return false;

            if (filtroExameEspecifico !== "todos") {
                const possuiExame = (item.todosExames || []).some(
                    (exame: string) =>
                        normalizarNomeExame(exame) === normalizarNomeExame(filtroExameEspecifico)
                );

                if (!possuiExame) return false;
            }
            if (!correspondeAoGrupoExames(item.todosExames || [], grupoExames)) return false;
            if (filtroPrazoAso !== "todos" && classificarPrazoPendencia(item) !== filtroPrazoAso) return false;

            return true;
        });
    }, [
        pendenciasVisiveis,
        filtroMedico,
        filtroExameEspecifico,
        filtroPrestador,
        dataInicio,
        dataFim,
        cpfsAtendimentosConcluidos,
        grupoExames,
        filtroPrazoAso,
    ]);

    /* ============================================================
       CONTADORES DAS ABAS
    ============================================================ */
    const quantidadeMontados = useMemo(
        () => pendenciasComFiltros.filter((f: any) => isFuncionarioMontado(f)).length,
        [pendenciasComFiltros, funcionariosSalvos]
    );

    const quantidadePendentesAba = pendenciasComFiltros.length - quantidadeMontados;

    /* ============================================================
       BUSCA + ABA + ORDENAÇÃO
    ============================================================ */
    const pendenciasProcessadas = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const filtrada = pendenciasComFiltros.filter((item: any) => {
            const jaMontado = isFuncionarioMontado(item);

            if (abaAtiva === "pendentes" && jaMontado) return false;
            if (abaAtiva === "montados" && !jaMontado) return false;

            if (!termo) return true;

            return (
                String(item.nome).toLowerCase().includes(termo) ||
                String(item.empresa).toLowerCase().includes(termo) ||
                String(item.cpf || "").includes(termo)
            );
        });

        filtrada.sort((a: any, b: any) => {
            const resultado = compararValores(a, b, sortKey);
            return sortDirection === "asc" ? resultado : -resultado;
        });

        return filtrada;
    }, [pendenciasComFiltros, busca, abaAtiva, sortKey, sortDirection, funcionariosSalvos]);

    const indicadoresExamesPendentes = useMemo(() => {
        let vencidos = 0;
        let noPrazo = 0;
        let suspensos = 0;

        pendenciasVisiveis.forEach((item: any) => {
            const categoria = classificarPrazoPendencia(item);
            if (categoria === "vencido") vencidos++;
            else if (categoria === "no-prazo") noPrazo++;
            else suspensos++;
        });

        return { vencidos, noPrazo, suspensos };
    }, [pendenciasVisiveis]);

    /* ============================================================
       PAGINAÇÃO DOS RESULTADOS
    ============================================================ */
    const totalPaginas = Math.ceil(pendenciasProcessadas.length / itensPorPagina);

    const indiceInicial = (paginaAtual - 1) * itensPorPagina;
    const indiceFinal = indiceInicial + itensPorPagina;
    const pendenciasPaginadas = pendenciasProcessadas.slice(indiceInicial, indiceFinal);

    /* ============================================================
       RESET DA PAGINAÇÃO
    ============================================================ */
    useEffect(() => {
        setPaginaAtual(1);
    }, [busca, filtroTipoExame, filtroMedico, filtroExameEspecifico, filtroPrestador, filtroPrazoAso, dataInicio, dataFim, abaAtiva, sortKey, sortDirection, prazosMap]);

    /* ============================================================
       GARANTE QUE A PÁGINA NÃO FIQUE INVÁLIDA
    ============================================================ */
    useEffect(() => {
        const ultimaPaginaValida = Math.max(1, totalPaginas);
        if (paginaAtual > ultimaPaginaValida) {
            setPaginaAtual(ultimaPaginaValida);
        }
    }, [totalPaginas, paginaAtual]);

    /* ============================================================
       SELEÇÃO
    ============================================================ */
    const cpfsSelecionaveis = pendenciasProcessadas
        .filter((f: any) => !isFuncionarioMontado(f) && !cpfsEnviadosDireto.has(obterIdentificadorFuncionario(f)))
        .map(obterIdentificadorFuncionario)
        .filter(Boolean);

    const allChecked =
        cpfsSelecionaveis.length > 0 &&
        cpfsSelecionaveis.every((cpf: string) => selectedCpfs.has(cpf));

    const disponiveisNaAba = cpfsSelecionaveis.length;

    const handleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedCpfs(new Set());
            return;
        }

        setSelectedCpfs(new Set(cpfsSelecionaveis));
    };

    const handleSelectOne = (cpf: string, checked: boolean) => {
        const funcionario = pendenciasVisiveis.find((f: any) => obterIdentificadorFuncionario(f) === cpf);

        if (!funcionario || isFuncionarioMontado(funcionario) || cpfsEnviadosDireto.has(cpf)) return;

        setSelectedCpfs((prev) => {
            const novoSet = new Set(prev);
            if (checked) {
                novoSet.add(cpf);
            } else {
                novoSet.delete(cpf);
            }
            return novoSet;
        });
    };

    /* ============================================================
       SALVAR EM LOTE
    ============================================================ */
    const handleSaveSelection = async () => {
        if (operacaoEmAndamento.current) return;
        if (selectedCpfs.size === 0) {
            toast.warning("Selecione ao menos um funcionário para salvar.");
            return;
        }

        operacaoEmAndamento.current = true;
        setSaving(true);

        try {
            const selecionados = pendenciasVisiveis.filter(
                (f: any) => selectedCpfs.has(obterIdentificadorFuncionario(f)) && !isFuncionarioMontado(f)
            );

            if (selecionados.length === 0) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const pacientes = selecionados.map((f: any) => ({
                ...criarPacienteAssinatura(funcionariosMapeados.get(obterIdentificadorFuncionario(f)) || f, unidadeId),
                observacao: "ASO montado",
            }));

            const retorno = await solicitarResultadoAcaoAso(
                criarPayloadAcaoAso(pacientes, "LIBERAR", "ASO montado")
            );
            const resultado = interpretarRespostaAcaoAso(retorno, pacientes, "LIBERAR");
            const confirmados = resultado.confirmados;

            if (confirmados.length) {
                const saveBd = await supabase.from("pacientes_assinatura").insert(confirmados);
                if (saveBd.error) {
                    toast.error("Erro ao salvar funcionários.");
                    return;
                }
            }

            const cpfsSalvos = resultado.indicesConfirmados.map(indice => obterIdentificadorFuncionario(selecionados[indice]));
            onFuncionariosSalvos(cpfsSalvos);

            setSelectedCpfs((prev) => {
                const novo = new Set(prev);
                cpfsSalvos.forEach((cpf: any) => novo.delete(cpf));
                return novo;
            });

            if (cpfsSalvos.length) toast.success(`${cpfsSalvos.length} funcionário(s) salvo(s) com sucesso!`);
            if (resultado.nomesComErro.length) toast.error(mensagemErrosFuncionarios(resultado.nomesComErro));
        } catch (error) {
            toast.error(error instanceof Error
                ? error.message
                : "Não foi possível salvar os funcionários selecionados.");
        } finally {
            operacaoEmAndamento.current = false;
            setSaving(false);
        }
    };

    const handleEnviarAso = async () => {
        if (operacaoEmAndamento.current) return;
        if (selectedCpfs.size === 0) {
            toast.warning("Selecione ao menos um funcionário para enviar o ASO.");
            return;
        }

        operacaoEmAndamento.current = true;
        setSendingAso(true);

        try {
            const selecionados = pendenciasVisiveis
                .filter((f: any) => selectedCpfs.has(obterIdentificadorFuncionario(f)))
                .map((f: any) => {
                    /*
                     * Preferimos o funcionário completo vindo de
                     * todosFuncionarios. Isso mantém o mesmo formato
                     * usado pela ViewExamesConcluidos.
                     */
                    const completo = funcionariosMapeados.get(obterIdentificadorFuncionario(f));
                    return {
                        ...(completo || f),
                        identificador: obterIdentificadorFuncionario(f),
                    };
                });

            if (!selecionados.length) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const pacientes = selecionados.map((f: any) => ({
                ...criarPacienteAssinatura(f, unidadeId),
                acao: "ENVIADO_DIRETO" as const,
                observacao: "Enviado direto",
            }));

            const retorno = await solicitarResultadoAcaoAso(
                criarPayloadAcaoAso(pacientes, "LIBERAR-ENVIAR")
            );
            const resultado = interpretarRespostaAcaoAso(retorno, pacientes, "LIBERAR-ENVIAR");
            const confirmados = resultado.confirmados.map(item => ({
                ...item,
                acao: "ENVIADO_DIRETO" as const,
                observacao: "Enviado direto",
            }));

            if (confirmados.length) {
                const saveBd = await supabase.from("pacientes_assinatura").insert(confirmados);
                if (saveBd.error) throw saveBd.error;
            }

            const cpfsEnviados = resultado.indicesConfirmados
                .map(indice => obterIdentificadorFuncionario(selecionados[indice])).filter(Boolean);
            onAsosEnviadosDireto(cpfsEnviados);

            if (cpfsEnviados.length) toast.success(`${cpfsEnviados.length} ASO(s) enviado(s) com sucesso!`);
            if (resultado.nomesComErro.length) toast.error(mensagemErrosFuncionarios(resultado.nomesComErro));
            const indicesConfirmados = new Set(resultado.indicesConfirmados);
            setSelectedCpfs(new Set(
                selecionados.filter((_: any, indice: number) => !indicesConfirmados.has(indice))
                    .map(obterIdentificadorFuncionario).filter(Boolean)
            ));
        } catch (error) {
            console.error("Erro ao enviar ASOs:", error);
            toast.error(error instanceof Error
                ? error.message
                : "Não foi possível enviar os ASOs selecionados.");
        } finally {
            operacaoEmAndamento.current = false;
            setSendingAso(false);
        }
    };

    const handleAtendimentoConcluiido = async () => {
        if (operacaoEmAndamento.current) return;
        if (selectedCpfs.size === 0) {
            toast.warning("Selecione ao menos um funcionário.");
            return;
        }

        operacaoEmAndamento.current = true;
        setConcluindoAtendimento(true);

        try {
            const selecionados = pendenciasVisiveis
                .filter((f: any) => selectedCpfs.has(obterIdentificadorFuncionario(f)))
                .map((f: any) => ({
                    ...(funcionariosMapeados.get(obterIdentificadorFuncionario(f)) || f),
                    identificador: obterIdentificadorFuncionario(f),
                }));

            if (!selecionados.length) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const pacientes = selecionados.map((funcionario: any) =>
                criarPacienteAssinatura(funcionario, unidadeId)
            );

            const retorno = await solicitarResultadoAcaoAso(
                criarPayloadAcaoAso(pacientes, "CONCLUIDO", "Concluído")
            );
            const resultado = interpretarRespostaAcaoAso(retorno, pacientes, "CONCLUIDO");
            const selecionadosConfirmados = resultado.indicesConfirmados.map(indice => selecionados[indice]);

            onAtendimentosConcluidos(
                selecionadosConfirmados
                    .map(obterIdentificadorFuncionario)
                    .filter(Boolean)
            );
            if (selecionadosConfirmados.length) toast.success(`${selecionadosConfirmados.length} atendimento(s) enviado(s) como concluído(s)!`);
            if (resultado.nomesComErro.length) toast.error(mensagemErrosFuncionarios(resultado.nomesComErro));
            const indicesConfirmados = new Set(resultado.indicesConfirmados);
            setSelectedCpfs(new Set(
                selecionados.filter((_: any, indice: number) => !indicesConfirmados.has(indice))
                    .map(obterIdentificadorFuncionario).filter(Boolean)
            ));
        } catch (error) {
            console.error("Erro ao concluir atendimentos:", error);
            toast.error(error instanceof Error
                ? error.message
                : "Não foi possível concluir os atendimentos selecionados.");
        } finally {
            operacaoEmAndamento.current = false;
            setConcluindoAtendimento(false);
        }
    };

    /* ============================================================
       MODAL
    ============================================================ */
    const handleRowClick = (cpf: string, itemPendente: any) => {
        const fCompleto = funcionariosMapeados.get(cpf);

        if (fCompleto) {
            setSelectedFuncionario(fCompleto);
        } else {
            setSelectedFuncionario({
                nomeFuncionario: itemPendente.nomeFuncionario || itemPendente.nome,
                cpfFuncionario: itemPendente.cpfFuncionario || itemPendente.cpf,
                razaoSocial: itemPendente.empresa || "-",
                codigoEmpresa: itemPendente.codigoEmpresa || "-",
                codigoFuncionario: itemPendente.codigoFuncionario || "-",
                aso: {
                    dataAso: itemPendente.dataAso || null,
                    dataFicha: itemPendente.dataFicha || null,
                    resultadoAsoSoc: "Pendente",
                    totalExames: itemPendente.examesPendentes?.length || 0,
                    examesPendentes: itemPendente.examesPendentes?.length || 0,
                    examesConcluidos: 0,
                    sequencialFicha: itemPendente.sequencialFicha,
                    tipoAso: itemPendente.tipoAso,
                    listaExamesResumida: (itemPendente.examesPendentes || []).map((e: string) => ({
                        descricaoExame: e,
                        isPendente: true,
                        dataExame: "-",
                    })),
                },
                documentosGed: [],
            });
        }

        setModalOpen(true);
    };

    /* ============================================================
       EMPTY STATE (nenhuma pendência real em toda a lista)
    ============================================================ */
    if (!analytics || pendenciasVisiveis.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 text-center">
                    {analytics
                        ? "Nenhum funcionário com exames pendentes!"
                        : "Importe uma planilha Excel para ver os exames pendentes."}
                </p>
            </div>
        );
    }

    const renderSortHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: string }) => (
        <TableHead
            className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap transition-colors hover:text-slate-900 dark:hover:text-white"
            onClick={() => handleSort(sortKeyValue)}
        >
            <div className="flex items-center gap-1.5">
                {label}
                {sortKey === sortKeyValue ? (
                    sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-blue-500" />
                    ) : (
                        <ArrowDown className="w-3 h-3 text-blue-500" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                )}
            </div>
        </TableHead>
    );

    return (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-3">
                <div className="flex flex-col gap-2">

                    {/* FAIXA 1 — TÍTULO + ABAS */}
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 shrink-0">
                                <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                            </span>

                            <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                                ASO's com Exames Pendentes
                            </CardTitle>
                        </div>

                        <FiltroPrazoCards
                            filtro={filtroPrazoAso}
                            vencidos={indicadoresExamesPendentes.vencidos}
                            noPrazo={indicadoresExamesPendentes.noPrazo}
                            suspensos={indicadoresExamesPendentes.suspensos}
                            onChange={(filtro) => {
                                setFiltroPrazoAso(filtro);
                                setSelectedCpfs(new Set());
                                setPaginaAtual(1);
                            }}
                        />

                        <div className="flex items-center self-start rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800 xl:self-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    setAbaAtiva("pendentes");
                                    setSelectedCpfs(new Set());
                                    setPaginaAtual(1);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${abaAtiva === "pendentes"
                                    ? "bg-white dark:bg-gray-900 text-red-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                <Clock3 className="w-3.5 h-3.5" />
                                Pendentes
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500/10">
                                    {quantidadePendentesAba}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setAbaAtiva("montados");
                                    setSelectedCpfs(new Set());
                                    setPaginaAtual(1);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${abaAtiva === "montados"
                                    ? "bg-white dark:bg-gray-900 text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Montados
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10">
                                    {quantidadeMontados}
                                </span>
                            </button>
                        </div>
                    </div>


                    {/* FAIXA 3 — BUSCA + FILTROS + AÇÕES */}
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <PainelFiltrosExames
                            busca={busca}
                            onBuscaChange={setBusca}
                            quantidadeResultados={pendenciasProcessadas.length}
                            medico={filtroMedico}
                            onMedicoChange={setFiltroMedico}
                            medicos={listaMedicosPendentes}
                            exame={filtroExameEspecifico}
                            onExameChange={setFiltroExameEspecifico}
                            exames={listaExamesPendentes}
                            prestador={filtroPrestador}
                            onPrestadorChange={setFiltroPrestador}
                            prestadores={listaPrestadoresPendentes}
                            dataInicio={dataInicio}
                            onDataInicioChange={setDataInicio}
                            dataFim={dataFim}
                            onDataFimChange={setDataFim}
                            possuiFiltroExtra={filtroPrazoAso !== "todos" || Boolean(grupoExames)}
                            onLimpar={limparFiltros}
                            filtroGrupo={<FiltroGrupoExames unidadeId={unidadeId} examesDisponiveis={listaExamesPendentes} grupoSelecionado={grupoExames} onGrupoSelecionadoChange={setGrupoExames} />}
                        />

                        {/* AÇÕES (apenas na aba Pendentes) */}
                        {abaAtiva === "pendentes" && (
                            <div className="order-first flex w-full flex-wrap justify-center gap-2">
                                <Button
                                    type="button"
                                    onClick={() => setAcaoParaConfirmar("salvar")}
                                    disabled={processandoAcao || selectedCpfs.size === 0}
                                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wide gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Liberando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3.5 h-3.5" />
                                            Liberar ASO
                                            {selectedCpfs.size > 0 && ` (${selectedCpfs.size})`}
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => setAcaoParaConfirmar("enviar")}
                                    disabled={processandoAcao || selectedCpfs.size === 0}
                                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wide gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
                                >
                                    {sendingAso ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" />
                                            Enviar ASO
                                            {selectedCpfs.size > 0 && ` (${selectedCpfs.size})`}
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => setAcaoParaConfirmar("concluido")}
                                    disabled={processandoAcao || selectedCpfs.size === 0}
                                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wide gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white"
                                >
                                    {concluindoAtendimento ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                            Concluindo...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Atendimento concluído
                                            {selectedCpfs.size > 0 && ` (${selectedCpfs.size})`}
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* TABELA */}
            <CardContent className="p-0 overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-12 text-center">
                                <Checkbox
                                    checked={allChecked}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    disabled={disponiveisNaAba === 0}
                                />
                            </TableHead>

                            {renderSortHeader({ label: "Funcionário", sortKeyValue: "nome" })}
                            {renderSortHeader({ label: "Empresa / Unidade", sortKeyValue: "empresa" })}
                            {renderSortHeader({ label: "Médico Examinador", sortKeyValue: "medicoExaminador" })}
                            {renderSortHeader({ label: "Seq. Ficha", sortKeyValue: "sequencialFicha" })}
                            {renderSortHeader({ label: "Data Ficha", sortKeyValue: "dataFicha" })}
                            {renderSortHeader({ label: "Exames Pendentes", sortKeyValue: "examesList" })}
                        </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pendenciasPaginadas.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                                    {dataInicio || dataFim || filtroMedico !== "todos" || filtroExameEspecifico !== "todos" || filtroPrestador !== "todos" || filtroPrazoAso !== "todos" || grupoExames || busca
                                        ? "Nenhum funcionário encontrado para os filtros informados."
                                        : abaAtiva === "pendentes"
                                            ? "Nenhum funcionário pendente para montagem."
                                            : "Nenhum funcionário salvo ou com ASO montado nesta lista."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            pendenciasPaginadas.map((item: any, idx: number) => {
                                const identificador = obterIdentificadorFuncionario(item);
                                const jaMontado = isFuncionarioMontado(item);
                                const isSelected = selectedCpfs.has(identificador);
                                const enviadoDireto = cpfsEnviadosDireto.has(identificador);

                                return (
                                    <TableRow
                                        key={`${identificador}-${idx}`}
                                        className={`transition-colors ${enviadoDireto
                                            ? "bg-cyan-500/[0.08] hover:bg-cyan-500/[0.12]"
                                            : jaMontado
                                                ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]"
                                                : isSelected
                                                    ? "bg-blue-500/[0.06] hover:bg-blue-500/[0.09]"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            }`}
                                    >
                                        <TableCell className="text-center">
                                            {enviadoDireto ? (
                                                <div className="mx-auto flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/15" title="Enviado direto">
                                                    <Send className="w-3.5 h-3.5 text-cyan-600" />
                                                </div>
                                            ) : jaMontado ? (
                                                <div
                                                    className="mx-auto flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15"
                                                    title="ASO já montado"
                                                >
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                </div>
                                            ) : (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) =>
                                                        handleSelectOne(identificador, !!checked)
                                                    }
                                                />
                                            )}
                                        </TableCell>

                                        {/* FUNCIONÁRIO */}
                                        <TableCell>
                                            <button
                                                type="button"
                                                onClick={() => handleRowClick(identificador, item)}
                                                className="text-left group flex items-center gap-2.5"
                                            >
                                                <span
                                                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${jaMontado
                                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                        : "bg-red-500/10 text-red-500"
                                                        }`}
                                                >
                                                    {jaMontado ? (
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    ) : (
                                                        String(item.nome || "?").charAt(0).toUpperCase()
                                                    )}
                                                </span>
                                                <span
                                                    className={`font-bold text-xs group-hover:underline ${jaMontado
                                                        ? "text-emerald-700 dark:text-emerald-400"
                                                        : "text-blue-600 dark:text-blue-400"
                                                        }`}
                                                >
                                                    {item.nome}
                                                </span>
                                                {enviadoDireto && (
                                                    <Badge className="bg-cyan-600 text-white text-[9px]">Enviado direto</Badge>
                                                )}
                                            </button>
                                        </TableCell>

                                        {/* EMPRESA */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div className="max-w-[220px] truncate" title={item.empresa}>
                                                {item.empresa}
                                            </div>
                                        </TableCell>

                                        {/* MÉDICO EXAMINADOR */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div className="max-w-[180px] truncate" title={item.medicoExaminador}>
                                                {item.medicoExaminador}
                                            </div>
                                        </TableCell>

                                        {/* SEQ. FICHA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.sequencialFicha}
                                        </TableCell>

                                        {/* DATA FICHA */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                            {item.dataFicha || "-"}
                                        </TableCell>

                                        {/* EXAMES */}
                                        <TableCell className="max-w-[280px]">
                                            <div className="flex flex-wrap gap-1.5">
                                                {item.examesDetalhados.map((exame: any, eIdx: number) => {
                                                    return (
                                                        <Badge
                                                            key={eIdx}
                                                            variant="outline"
                                                            className="flex flex-col items-start gap-0 rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold leading-tight text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                            title={
                                                                exame.ignorado
                                                                    ? "Documento GED dispensado; a data do exame define a conclusão"
                                                                    : exame.dataExame
                                                                        ? `Exame realizado em ${exame.dataExame}${exame.temRelacao === false ? " — aguardando vínculo GED" : ""
                                                                        }`
                                                                        : "Exame ainda não realizado"
                                                            }
                                                        >
                                                            <span>
                                                                {exame.nome}
                                                                {exame.ignorado ? " (GED dispensado)" : ""}
                                                            </span>
                                                        </Badge>
                                                    );
                                                })}
                                            </div>
                                        </TableCell>

                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            {/* PAGINAÇÃO */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/30">
                {/* INFORMAÇÕES */}
                <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase font-bold">
                    <span>
                        {pendenciasProcessadas.length > 0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                pendenciasProcessadas.length
                            )} de ${pendenciasProcessadas.length}`
                            : "Nenhum resultado"}
                    </span>

                    {/* ITENS POR PÁGINA */}
                    <div className="flex items-center gap-1.5">
                        <span>Linhas:</span>
                        <Select
                            value={String(itensPorPagina)}
                            onValueChange={(value) => {
                                setItensPorPagina(Number(value));
                                setPaginaAtual(1);
                            }}
                        >
                            <SelectTrigger className="h-7 w-[65px] text-[10px] font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="15">15</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* CONTROLES */}
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual === 1}
                        onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    {/* PÁGINAS */}
                    {Array.from({ length: totalPaginas }, (_, index) => index + 1)
                        .filter((pagina) => {
                            if (totalPaginas <= 7) return true;
                            return pagina === 1 || pagina === totalPaginas || Math.abs(pagina - paginaAtual) <= 1;
                        })
                        .map((pagina, index, array) => {
                            const paginaAnterior = array[index - 1];
                            const mostrarReticencias = paginaAnterior && pagina - paginaAnterior > 1;

                            return (
                                <React.Fragment key={pagina}>
                                    {mostrarReticencias && (
                                        <span className="px-1 text-[10px] text-slate-400">...</span>
                                    )}
                                    <Button
                                        type="button"
                                        variant={paginaAtual === pagina ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setPaginaAtual(pagina)}
                                        className="h-7 min-w-7 px-2 text-[10px] font-bold"
                                    >
                                        {pagina}
                                    </Button>
                                </React.Fragment>
                            );
                        })}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={paginaAtual === totalPaginas}
                        onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* MODAL */}
            <FuncionarioModal open={modalOpen} onOpenChange={setModalOpen} funcionario={selectedFuncionario} />
            <ConfirmarAcaoDialog
                acao={acaoParaConfirmar}
                quantidade={selectedCpfs.size}
                onOpenChange={(open) => !open && setAcaoParaConfirmar(null)}
                onConfirmar={() => {
                    const acao = acaoParaConfirmar;
                    setAcaoParaConfirmar(null);
                    if (acao === "salvar") void handleSaveSelection();
                    if (acao === "enviar") void handleEnviarAso();
                    if (acao === "concluido") void handleAtendimentoConcluiido();
                }}
            />
        </Card>
    );
}
