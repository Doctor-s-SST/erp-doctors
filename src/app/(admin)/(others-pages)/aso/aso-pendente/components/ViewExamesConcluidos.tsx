"use client"

import React, { useEffect, useState, useMemo, useRef } from "react";
import { toast } from "sonner";
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
    CheckCircle2,
    Clock3,
    Save,
    Send,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { FuncionarioModal } from "./FuncionarioModal";
import { ConfirmarAcaoDialog } from "./ConfirmarAcaoDialog";
import { correspondeAoGrupoExames, FiltroGrupoExames } from "./FiltroGrupoExames";
import { FiltroPrazoAso, FiltroPrazoCards } from "./FiltroPrazoCards";
import { PainelFiltrosExames } from "./PainelFiltrosExames";
import { useFiltrosTabelaExames } from "../hooks/useFiltrosTabelaExames";
import { ViewExamesConcluidosProps, FuncionarioItem, StatusVencimentoVisual } from "../types";
import {
    classificarTipoExame,
    possuiAsoMontado,
    asoEstaConcluido,
    obterPrazoAso,
    calcularStatusVencimentoVisual,
    parseDateBR,
    parseDateValue,
    normalizarNomeExame,
    obterCpfFuncionario,
    obterIdentificadorFuncionario,
} from "../utils";
import { criarPacienteAssinatura, criarPayloadAcaoAso } from "@/lib/aso-assinatura";
import {
    interpretarRespostaAcaoAso,
    mensagemErrosFuncionarios,
    solicitarResultadoAcaoAso,
} from "@/lib/resultado-acao-aso";
import { persistirPacientesAssinatura } from "@/lib/persistencia-pacientes-assinatura";

type FuncionarioComPrazo = FuncionarioItem & {
    prazoAso: { maiorPrazo: number; dataBase: Date; dataLimite: Date } | null;
    statusPrazo: StatusVencimentoVisual;
};

export function ViewExamesConcluidos({
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
}: ViewExamesConcluidosProps) {
    const [selectedFuncionario, setSelectedFuncionario] = useState<any | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    // Aba Ativa: "pendentes" (disponíveis para montagem) ou "salvos" (montados/salvos)
    const [abaAtiva, setAbaAtiva] = useState<"pendentes" | "salvos">("pendentes");

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

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [itensPorPagina, setItensPorPagina] = useState(15);

    const [sendingAso, setSendingAso] = useState(false);
    const [concluindoAtendimento, setConcluindoAtendimento] = useState(false);
    const [acaoParaConfirmar, setAcaoParaConfirmar] = useState<"salvar" | "enviar" | "concluido" | null>(null);
    const operacaoEmAndamento = useRef(false);
    const processandoAcao = saving || sendingAso || concluindoAtendimento;

    /* ============================================================
   FUNCIONÁRIOS CONCLUÍDOS
   ============================================================ */
    const funcionariosConcluidos = useMemo(() => {

        const lista: FuncionarioItem[] = [];

        todosFuncionarios.forEach((item) => {

            const aso =
                item.aso ||
                item.socResumo ||
                item;

            if (!aso) return;

            /*
             * A conclusão agora é determinada diretamente
             * pelas regras dos exames:
             *
             * Clínico:
             *   dataExame
             *
             * Complementar comum:
             *   dataExame + temRelacao
             *
             * Exame com GED dispensado:
             *   dataExame
             */
            if (!asoEstaConcluido(item, prazosMap)) {
                return;
            }

            const cpf = obterCpfFuncionario(item);
            const identificador = obterIdentificadorFuncionario(item);

            lista.push({
                ...item,

                nome:
                    item.nomeFuncionario ||
                    item.nome ||
                    aso.nomeFuncionario ||
                    "Não informado",

                nomeFuncionario:
                    item.nomeFuncionario ||
                    item.nome ||
                    aso.nomeFuncionario ||
                    "Não informado",

                cpf,
                cpfFuncionario: cpf,
                identificador,

                empresa:
                    item.razaoSocial ||
                    item.empresa ||
                    aso.razaoSocial ||
                    "-",

                razaoSocial:
                    item.razaoSocial ||
                    item.empresa ||
                    aso.razaoSocial ||
                    "-",

                codigoEmpresa:
                    item.codigoEmpresa ||
                    aso.codigoEmpresa ||
                    "-",

                codigoFuncionario:
                    item.codigoFuncionario ||
                    aso.codigoFuncionario ||
                    "-",

                codigoGed:
                    aso.codigoGed ||
                    item.codigoGed ||
                    "-",

                dataCriacaoGed:
                    aso.dataCriacaoGed ||
                    item.dataCriacaoGed ||
                    "-",

                sequencial_ficha:
                    aso.sequencialFicha ||
                    item.sequencialFicha ||
                    "-",

                sequencialFicha:
                    aso.sequencialFicha ||
                    item.sequencialFicha ||
                    "-",

                dataAso:
                    aso.dataAso ||
                    item.dataAso ||
                    null,

                dataFicha:
                    aso.dataFicha ||
                    item.dataFicha ||
                    null,

                resultadoAsoSoc:
                    aso.resultadoAsoSoc ||
                    item.resultadoAsoSoc ||
                    "Concluído",

                medico:
                    aso.medico ||
                    item.medico ||
                    "Não informado",

                crmMedico:
                    aso.crmMedico ||
                    item.crmMedico ||
                    "-",

                observacao:
                    item.observacao || "",

                prestador:
                    item.prestador ||
                    aso.prestador ||
                    item.socResumo?.prestador ||
                    "Não informado",

                totalExames:
                    Number(
                        aso.totalExames || 0
                    ),

                examesPendentes: 0,

                examesConcluidos:
                    Number(
                        aso.examesConcluidos ||
                        aso.totalExames ||
                        0
                    ),

                tipoAso:
                    aso.tipoAso ||
                    item.tipoAso ||
                    "",

                listaExamesResumida:
                    aso.listaExamesResumida ||
                    item.listaExamesResumida ||
                    [],

                aso:
                    item.aso ||
                    aso,

                /*
                 * IMPORTANTE:
                 * documentosGed pode estar no item ou
                 * dentro do objeto ASO.
                 */
                documentosGed:
                    item.documentosGed ||
                    aso.documentosGed ||
                    [],
            });
        });

        return lista;

    }, [todosFuncionarios, prazosMap]);

    const listaMedicosConcluidos = useMemo(() => {
        const setM = new Set<string>();
        funcionariosConcluidos.forEach((f) => { if (f.medico) setM.add(f.medico); });
        return Array.from(setM).sort();
    }, [funcionariosConcluidos]);

    const listaExamesConcluidos = useMemo(() => {
        const setE = new Set<string>();
        funcionariosConcluidos.forEach((f) => {
            const lista = f.aso?.listaExamesResumida || f.listaExamesResumida || [];
            lista.forEach((e: any) => {
                const nomeEx = e?.descricaoExame || e?.nomeExame || e?.nome;
                if (nomeEx) setE.add(nomeEx);
            });
        });
        return Array.from(setE).sort();
    }, [funcionariosConcluidos]);

    const listaPrestadoresConcluidos = useMemo(() => {
        return Array.from(new Set(
            funcionariosConcluidos
                .map((item) => item.prestador)
                .filter((prestador): prestador is string => Boolean(prestador && prestador !== "Não informado"))
        )).sort((a, b) => a.localeCompare(b, "pt-BR"));
    }, [funcionariosConcluidos]);

    const funcionariosConcluidosFiltrados = useMemo(() => {
        return funcionariosConcluidos.filter((funcionario) => {
            const identificador = obterIdentificadorFuncionario(funcionario);
            if (cpfsAtendimentosConcluidos.has(identificador)) {
                return false;
            }

            if (filtroTipoExame !== "todos" && classificarTipoExame(funcionario, prazosMap) !== filtroTipoExame) {
                return false;
            }
            if (filtroMedico !== "todos" && funcionario.medico !== filtroMedico) {
                return false;
            }
            if (filtroPrestador !== "todos" && funcionario.prestador !== filtroPrestador) {
                return false;
            }

            const dataFicha = parseDateValue(funcionario.dataFicha);
            if (dataInicio && (!dataFicha || dataFicha < new Date(`${dataInicio}T00:00:00`))) return false;
            if (dataFim && (!dataFicha || dataFicha > new Date(`${dataFim}T23:59:59.999`))) return false;
            if (filtroExameEspecifico !== "todos") {
                const lista = funcionario.aso?.listaExamesResumida || funcionario.listaExamesResumida || [];
                const possui = lista.some((e: any) =>
                    normalizarNomeExame(e?.descricaoExame || e?.nomeExame || e?.nome || "") ===
                    normalizarNomeExame(filtroExameEspecifico)
                );
                if (!possui) return false;
            }
            const examesFuncionario = (funcionario.aso?.listaExamesResumida || funcionario.listaExamesResumida || [])
                .map((exame: any) => exame?.descricaoExame || exame?.nomeExame || exame?.nome || "")
                .filter(Boolean);
            if (!correspondeAoGrupoExames(examesFuncionario, grupoExames)) return false;
            return true;
        });
    }, [
        funcionariosConcluidos,
        filtroTipoExame,
        filtroMedico,
        filtroExameEspecifico,
        filtroPrestador,
        dataInicio,
        dataFim,
        prazosMap,
        cpfsAtendimentosConcluidos,
        grupoExames,
    ]);

    /* ============================================================
   PRAZO DO ASO
   Só existe para funcionários já concluídos.
   ============================================================ */
    const funcionariosComPrazo = useMemo<FuncionarioComPrazo[]>(() => {
        return funcionariosConcluidosFiltrados.map(
            (funcionario): FuncionarioComPrazo => {
                const prazoAso = obterPrazoAso(funcionario, prazosMap);

                const statusPrazo = calcularStatusVencimentoVisual(
                    prazoAso?.dataLimite || null
                );

                return {
                    ...funcionario,
                    prazoAso,
                    statusPrazo,
                };
            }
        );
    }, [funcionariosConcluidosFiltrados, prazosMap]);

    /* ============================================================
       INDICADORES DE VENCIMENTO DO ASO
    ============================================================ */
    const indicadoresVencimento = useMemo(() => {
        let vencidos = 0;
        let noPrazo = 0;
        let suspensos = 0;

        funcionariosComPrazo.forEach((item: any) => {
            if (!item.prazoAso) {
                suspensos++;
                return;
            }

            if (item.statusPrazo?.estaVencido) {
                vencidos++;
            } else {
                noPrazo++;
            }
        });

        return {
            vencidos,
            noPrazo,
            suspensos,
        };
    }, [funcionariosComPrazo]);

    const isFuncionarioMontado = (funcionario: any) => {
        if (!funcionario) return false;
        return (
            funcionariosSalvos.has(obterIdentificadorFuncionario(funcionario)) ||
            possuiAsoMontado(funcionario.observacao)
        );
    };

    /* ============================================================
       FILTRA POR BUSCA, ABA E ORDENAÇÃO
    ============================================================ */
    const funcionariosFiltrados = useMemo(() => {
        const termo = busca.trim().toLowerCase();

        const lista = funcionariosComPrazo.filter((f) => {
            const jaMontado = isFuncionarioMontado(f);

            const categoriaPrazo: Exclude<FiltroPrazoAso, "todos"> = !f.prazoAso
                ? "suspenso"
                : f.statusPrazo.estaVencido ? "vencido" : "no-prazo";
            if (filtroPrazoAso !== "todos" && categoriaPrazo !== filtroPrazoAso) return false;

            // Aba pendentes = somente quem ainda não foi montado
            if (abaAtiva === "pendentes" && jaMontado) {
                return false;
            }

            // Aba salvos = somente quem já foi montado
            if (abaAtiva === "salvos" && !jaMontado) {
                return false;
            }

            if (!termo) return true;

            return (
                String(f.nome || f.nomeFuncionario || "").toLowerCase().includes(termo) ||
                String(f.empresa || f.razaoSocial || "").toLowerCase().includes(termo) ||
                String(f.cpf || f.cpfFuncionario || "").includes(termo)
            );
        });

        lista.sort((a, b) => {
            let resultado: number;

            if (sortKey === "dataFicha") {
                const dataA = parseDateBR(a.dataFicha || null)?.getTime() ?? Date.parse(a.dataFicha || "");
                const dataB = parseDateBR(b.dataFicha || null)?.getTime() ?? Date.parse(b.dataFicha || "");
                const valorA = Number.isNaN(dataA) ? Number.POSITIVE_INFINITY : dataA;
                const valorB = Number.isNaN(dataB) ? Number.POSITIVE_INFINITY : dataB;
                resultado = valorA - valorB;
            } else if (sortKey === "prazoAso") {
                resultado = (a.prazoAso?.maiorPrazo ?? Number.POSITIVE_INFINITY) -
                    (b.prazoAso?.maiorPrazo ?? Number.POSITIVE_INFINITY);
            } else if (sortKey === "statusPrazo") {
                const rankStatus = (item: FuncionarioComPrazo) => {
                    if (!item.prazoAso) return 2;
                    return item.statusPrazo.estaVencido ? 0 : 1;
                };
                resultado = rankStatus(a) - rankStatus(b);

                if (resultado === 0) {
                    resultado = (a.prazoAso?.dataLimite.getTime() ?? Number.POSITIVE_INFINITY) -
                        (b.prazoAso?.dataLimite.getTime() ?? Number.POSITIVE_INFINITY);
                }
            } else {
                const av = a[sortKey] ?? "";
                const bv = b[sortKey] ?? "";
                resultado = typeof av === "number" && typeof bv === "number"
                    ? av - bv
                    : String(av).localeCompare(String(bv), "pt-BR", {
                        numeric: true,
                        sensitivity: "base",
                    });
            }

            return sortDirection === "asc" ? resultado : -resultado;
        });

        return lista;
    }, [
        funcionariosComPrazo,
        busca,
        sortKey,
        sortDirection,
        funcionariosSalvos,
        abaAtiva,
        filtroPrazoAso,
    ]);

    /* ============================================================
       PAGINAÇÃO
    ============================================================ */
    const totalPaginas = Math.ceil(
        funcionariosFiltrados.length / itensPorPagina
    );

    const indiceInicial = (paginaAtual - 1) * itensPorPagina;
    const indiceFinal = indiceInicial + itensPorPagina;
    const funcionariosPaginados = funcionariosFiltrados.slice(
        indiceInicial,
        indiceFinal
    );

    /* ============================================================
       RESET E VALIDAÇÃO DE PÁGINA
    ============================================================ */
    useEffect(() => {
        setPaginaAtual(1);
    }, [busca, filtroTipoExame, filtroMedico, filtroExameEspecifico, filtroPrestador, filtroPrazoAso, dataInicio, dataFim, sortKey, sortDirection, abaAtiva, prazosMap]);

    useEffect(() => {
        const ultimaPaginaValida = Math.max(1, totalPaginas);
        if (paginaAtual > ultimaPaginaValida) {
            setPaginaAtual(ultimaPaginaValida);
        }
    }, [totalPaginas, paginaAtual]);

    useEffect(() => {
        setSelectedCpfs(new Set());
    }, [todosFuncionarios]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    /* ============================================================
       SELEÇÃO
    ============================================================ */
    const cpfsSelecionaveis = funcionariosFiltrados
        .filter((f) => !isFuncionarioMontado(f) && !cpfsEnviadosDireto.has(obterIdentificadorFuncionario(f)))
        .map(obterIdentificadorFuncionario);

    const allChecked =
        cpfsSelecionaveis.length > 0 &&
        cpfsSelecionaveis.every((cpf) => selectedCpfs.has(cpf));

    const disponiveisNaAba = cpfsSelecionaveis.length;

    const quantidadeSalvos = funcionariosConcluidosFiltrados.filter(
        (f) =>
            funcionariosSalvos.has(obterIdentificadorFuncionario(f)) || possuiAsoMontado(f.observacao)
    ).length;

    const quantidadePendentes =
        funcionariosConcluidosFiltrados.length - quantidadeSalvos;

    const handleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedCpfs(new Set());
            return;
        }

        const disponiveis = funcionariosFiltrados
            .filter((f) => !isFuncionarioMontado(f) && !cpfsEnviadosDireto.has(obterIdentificadorFuncionario(f)))
            .map(obterIdentificadorFuncionario);

        setSelectedCpfs(new Set(disponiveis));
    };

    const handleSelectOne = (cpf: string, checked: boolean) => {
        const funcionario = funcionariosConcluidosFiltrados.find(
            (f) => obterIdentificadorFuncionario(f) === cpf
        );

        if (!funcionario || isFuncionarioMontado(funcionario) || cpfsEnviadosDireto.has(cpf)) {
            return;
        }

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
            const selecionados = funcionariosConcluidosFiltrados.filter(
                (f) => selectedCpfs.has(obterIdentificadorFuncionario(f)) && !isFuncionarioMontado(f)
            );

            if (selecionados.length === 0) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const pacientes = selecionados.map((f) => ({
                ...criarPacienteAssinatura(f, unidadeId),
                observacao: "ASO montado",
            }));

            const retorno = await solicitarResultadoAcaoAso(
                criarPayloadAcaoAso(pacientes, "LIBERAR", "ASO montado")
            );
            const resultado = interpretarRespostaAcaoAso(retorno, pacientes, "LIBERAR");
            const confirmados = resultado.confirmados;

            const persistencia = await persistirPacientesAssinatura(confirmados);
            const cpfsSalvos = persistencia.indicesPersistidos.map(indiceConfirmado => {
                const indiceOriginal = resultado.indicesConfirmados[indiceConfirmado];
                return obterIdentificadorFuncionario(selecionados[indiceOriginal]);
            });
            onFuncionariosSalvos(cpfsSalvos);

            setSelectedCpfs((prev) => {
                const novo = new Set(prev);
                resultado.indicesConfirmados.forEach(indice => {
                    novo.delete(obterIdentificadorFuncionario(selecionados[indice]));
                });
                return novo;
            });

            if (cpfsSalvos.length) toast.success(`${cpfsSalvos.length} funcionário(s) salvo(s) com sucesso!`);
            if (persistencia.indicesComErro.length) {
                const nomes = persistencia.indicesComErro.map(indice => confirmados[indice].nome_paciente);
                toast.error(`A ação foi executada, mas não foi possível salvar no sistema: ${nomes.join(", ")}. Não repita o envio.`);
            }
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
            const selecionados = funcionariosConcluidosFiltrados.filter((f) => selectedCpfs.has(obterIdentificadorFuncionario(f)));
            const pacientes = selecionados.map((f) => ({
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

            const persistencia = await persistirPacientesAssinatura(confirmados);
            const cpfsEnviados = persistencia.indicesPersistidos.map(indiceConfirmado => {
                const indiceOriginal = resultado.indicesConfirmados[indiceConfirmado];
                return obterIdentificadorFuncionario(selecionados[indiceOriginal]);
            }).filter(Boolean);
            onAsosEnviadosDireto(cpfsEnviados);

            if (cpfsEnviados.length) toast.success(`${cpfsEnviados.length} ASO(s) enviado(s) com sucesso!`);
            if (persistencia.indicesComErro.length) {
                const nomes = persistencia.indicesComErro.map(indice => confirmados[indice].nome_paciente);
                toast.error(`A ação foi executada, mas não foi possível salvar no sistema: ${nomes.join(", ")}. Não repita o envio.`);
            }
            if (resultado.nomesComErro.length) toast.error(mensagemErrosFuncionarios(resultado.nomesComErro));
            const indicesConfirmados = new Set(resultado.indicesConfirmados);
            setSelectedCpfs(new Set(
                selecionados.filter((_, indice) => !indicesConfirmados.has(indice))
                    .map(obterIdentificadorFuncionario).filter(Boolean)
            ));
        } catch (error) {
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
            const selecionados = funcionariosConcluidosFiltrados.filter((f) =>
                selectedCpfs.has(obterIdentificadorFuncionario(f))
            );

            if (!selecionados.length) {
                toast.warning("Nenhum funcionário válido foi selecionado.");
                return;
            }

            const pacientes = selecionados.map((funcionario) =>
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
                    .filter((cpf): cpf is string => Boolean(cpf))
            );
            if (selecionadosConfirmados.length) toast.success(`${selecionadosConfirmados.length} atendimento(s) enviado(s) como concluído(s)!`);
            if (resultado.nomesComErro.length) toast.error(mensagemErrosFuncionarios(resultado.nomesComErro));
            const indicesConfirmados = new Set(resultado.indicesConfirmados);
            setSelectedCpfs(new Set(
                selecionados.filter((_, indice) => !indicesConfirmados.has(indice))
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

    const handleRowClick = (f: any) => {
        setSelectedFuncionario(f);
        setModalOpen(true);
    };

    if (funcionariosConcluidos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Nenhum funcionário concluído
                </p>
                <p className="text-xs text-slate-400 mt-1 text-center">
                    Os funcionários com todos os exames concluídos aparecerão aqui.
                </p>
            </div>
        );
    }

    const renderSortHeader = ({
        label,
        sortKeyValue,
    }: {
        label: string;
        sortKeyValue: string;
    }) => (
        <TableHead
            className="font-black text-[10px] uppercase text-slate-500 cursor-pointer select-none whitespace-nowrap transition-colors hover:text-slate-800 dark:hover:text-slate-200"
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
            {/* HEADER */}
            <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-3">
                <div className="flex flex-col gap-2">

                    {/* FAIXA 1 — TÍTULO + ABAS */}
                    <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 shrink-0">
                                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                            </span>
                            <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                                ASO's Pendentes para Liberação
                            </CardTitle>
                        </div>

                        <FiltroPrazoCards
                            filtro={filtroPrazoAso}
                            vencidos={indicadoresVencimento.vencidos}
                            noPrazo={indicadoresVencimento.noPrazo}
                            suspensos={indicadoresVencimento.suspensos}
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
                                    ? "bg-white dark:bg-gray-900 text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                <Clock3 className="w-3.5 h-3.5" />
                                Pendentes
                                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10">
                                    {quantidadePendentes}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setAbaAtiva("salvos");
                                    setSelectedCpfs(new Set());
                                    setPaginaAtual(1);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${abaAtiva === "salvos"
                                    ? "bg-white dark:bg-gray-900 text-emerald-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Montados
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10">
                                    {quantidadeSalvos}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* FAIXA 3 — BUSCA + FILTROS + AÇÕES */}
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <PainelFiltrosExames
                            busca={busca}
                            onBuscaChange={setBusca}
                            quantidadeResultados={funcionariosFiltrados.length}
                            medico={filtroMedico}
                            onMedicoChange={setFiltroMedico}
                            medicos={listaMedicosConcluidos}
                            exame={filtroExameEspecifico}
                            onExameChange={setFiltroExameEspecifico}
                            exames={listaExamesConcluidos}
                            prestador={filtroPrestador}
                            onPrestadorChange={setFiltroPrestador}
                            prestadores={listaPrestadoresConcluidos}
                            dataInicio={dataInicio}
                            onDataInicioChange={setDataInicio}
                            dataFim={dataFim}
                            onDataFimChange={setDataFim}
                            possuiFiltroExtra={filtroPrazoAso !== "todos" || Boolean(grupoExames)}
                            onLimpar={limparFiltros}
                            filtroGrupo={<FiltroGrupoExames unidadeId={unidadeId} examesDisponiveis={listaExamesConcluidos} grupoSelecionado={grupoExames} onGrupoSelecionadoChange={setGrupoExames} />}
                        />

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
                                    onCheckedChange={(checked) =>
                                        handleSelectAll(!!checked)
                                    }
                                    disabled={disponiveisNaAba === 0}
                                />
                            </TableHead>

                            {renderSortHeader({ label: "Funcionário", sortKeyValue: "nome" })}
                            {renderSortHeader({ label: "Empresa / Unidade", sortKeyValue: "empresa" })}
                            {renderSortHeader({ label: "Médico Examinador", sortKeyValue: "medico" })}
                            {renderSortHeader({ label: "Seq. Ficha", sortKeyValue: "sequencialFicha" })}
                            {renderSortHeader({ label: "Data Ficha", sortKeyValue: "dataFicha" })}
                            {renderSortHeader({ label: "Prazo ASO", sortKeyValue: "prazoAso" })}
                            {renderSortHeader({ label: "Vencimento", sortKeyValue: "statusPrazo" })}
                            {renderSortHeader({ label: "Observação", sortKeyValue: "observacao" })}
                        </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {funcionariosPaginados.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={9}
                                    className="text-center py-8 text-xs text-slate-400"
                                >
                                    {dataInicio || dataFim || filtroMedico !== "todos" || filtroExameEspecifico !== "todos" || filtroPrestador !== "todos" || filtroPrazoAso !== "todos" || grupoExames || busca
                                        ? "Nenhum funcionário encontrado para os filtros informados."
                                        : abaAtiva === "pendentes"
                                            ? "Nenhum funcionário pendente para montagem."
                                            : "Nenhum funcionário salvo ou com ASO montado nesta lista."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            funcionariosPaginados.map((item) => {
                                const identificador = obterIdentificadorFuncionario(item);
                                const isSelected = selectedCpfs.has(identificador);
                                const jaMontado = isFuncionarioMontado(item);
                                const enviadoDireto = cpfsEnviadosDireto.has(identificador);

                                return (
                                    <TableRow
                                        key={identificador}
                                        className={`transition-colors ${enviadoDireto
                                            ? "bg-cyan-500/[0.08] hover:bg-cyan-500/[0.12]"
                                            : jaMontado
                                                ? "bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]"
                                                : isSelected
                                                    ? "bg-blue-500/[0.06] hover:bg-blue-500/[0.09]"
                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                            }`}
                                    >
                                        {/* CHECKBOX */}
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
                                                        handleSelectOne(
                                                            identificador,
                                                            !!checked
                                                        )
                                                    }
                                                />
                                            )}
                                        </TableCell>

                                        {/* FUNCIONÁRIO */}
                                        <TableCell>
                                            <button
                                                type="button"
                                                onClick={() => handleRowClick(item)}
                                                className="text-left group w-full"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {/* Avatar */}
                                                    <div
                                                        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black ${jaMontado
                                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-blue-500/10 text-blue-500"
                                                            }`}
                                                    >
                                                        {jaMontado ? (
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        ) : (
                                                            item.nome
                                                                ?.charAt(0)
                                                                ?.toUpperCase()
                                                        )}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div
                                                            className={`text-xs font-bold truncate ${jaMontado
                                                                ? "text-emerald-700 dark:text-emerald-400"
                                                                : "text-blue-600 dark:text-blue-400"
                                                                } group-hover:underline`}
                                                        >
                                                            {item.nome}
                                                        </div>
                                                        {enviadoDireto && (
                                                            <Badge className="mt-1 bg-cyan-600 text-white text-[9px]">Enviado direto</Badge>
                                                        )}
                                                        <div className="text-[9px] text-slate-400 mt-0.5">
                                                            Clique para visualizar detalhes
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        </TableCell>

                                        {/* EMPRESA */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div
                                                className="max-w-[220px] truncate"
                                                title={item.empresa}
                                            >
                                                {item.empresa}
                                            </div>
                                        </TableCell>

                                        {/* MÉDICO EXAMINADOR */}
                                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                                            <div
                                                className="max-w-[180px] truncate"
                                                title={item.medico || "Não informado"}
                                            >
                                                {item.medico || "Não informado"}
                                            </div>
                                        </TableCell>

                                        {/* SEQ. FICHA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.sequencialFicha || item.sequencial_ficha || "-"}
                                        </TableCell>

                                        {/* DATA */}
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {item.dataFicha || "-"}
                                        </TableCell>

                                        {/* PRAZO ASO */}
                                        <TableCell>
                                            {item.prazoAso ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {item.prazoAso.maiorPrazo === 0
                                                            ? "Dia da realização"
                                                            : `${item.prazoAso.maiorPrazo} ${item.prazoAso.maiorPrazo === 1
                                                                ? "dia útil"
                                                                : "dias úteis"}`}
                                                    </span>

                                                    <span className="text-[9px] text-slate-400">
                                                        Base:{" "}
                                                        {item.prazoAso.dataBase.toLocaleDateString(
                                                            "pt-BR"
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    Sem prazo
                                                </span>
                                            )}
                                        </TableCell>

                                        {/* VENCIMENTO */}
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge
                                                    variant="outline"
                                                    className={`w-fit text-[10px] font-bold gap-1 rounded-full ${item.statusPrazo.color}`}
                                                >
                                                    {item.statusPrazo.estaVencido ? (
                                                        <Clock3 className="w-3 h-3" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    )}
                                                    {item.statusPrazo.label}
                                                </Badge>

                                                {item.prazoAso && (
                                                    <span className="text-[9px] text-slate-400">
                                                        Limite: {item.prazoAso.dataLimite.toLocaleDateString("pt-BR")}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* OBSERVAÇÃO */}
                                        <TableCell className="text-xs">
                                            {item.observacao || ""}
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
                        {funcionariosFiltrados.length > 0
                            ? `Mostrando ${indiceInicial + 1}–${Math.min(
                                indiceFinal,
                                funcionariosFiltrados.length
                            )} de ${funcionariosFiltrados.length}`
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
                        onClick={() =>
                            setPaginaAtual((prev) => Math.max(1, prev - 1))
                        }
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Anterior</span>
                    </Button>

                    {/* PÁGINAS */}
                    {Array.from({ length: totalPaginas }, (_, index) => index + 1)
                        .filter((pagina) => {
                            if (totalPaginas <= 7) return true;
                            return (
                                pagina === 1 ||
                                pagina === totalPaginas ||
                                Math.abs(pagina - paginaAtual) <= 1
                            );
                        })
                        .map((pagina, index, array) => {
                            const paginaAnterior = array[index - 1];
                            const mostrarReticencias =
                                paginaAnterior && pagina - paginaAnterior > 1;

                            return (
                                <React.Fragment key={pagina}>
                                    {mostrarReticencias && (
                                        <span className="px-1 text-[10px] text-slate-400">
                                            ...
                                        </span>
                                    )}
                                    <Button
                                        type="button"
                                        variant={
                                            paginaAtual === pagina
                                                ? "default"
                                                : "outline"
                                        }
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
                        onClick={() =>
                            setPaginaAtual((prev) =>
                                Math.min(totalPaginas, prev + 1)
                            )
                        }
                        className="h-7 px-2 text-[10px] gap-1"
                    >
                        <span className="hidden sm:inline">Próxima</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* MODAL */}
            <FuncionarioModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                funcionario={selectedFuncionario}
            />
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
