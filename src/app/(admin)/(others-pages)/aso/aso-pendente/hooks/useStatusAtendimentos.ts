"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { InfoStatusAtendimento, TipoStatusAtendimento, ExameAtendimentoResumo } from "../types";

export interface ItemFuncionarioStatus {
    sequencialFicha?: string | null;
    cpf?: string | null;
    nome?: string | null;
    dataFicha?: string | null;
}

export type EntradaStatusAtendimento = string | ItemFuncionarioStatus;

const TAMANHO_LOTE_CONSULTA = 30;
const MAX_LOTES_SIMULTANEOS = 4;

function dividirEmLotes<T>(itens: T[], tamanho = TAMANHO_LOTE_CONSULTA): T[][] {
    const lotes: T[][] = [];
    for (let indice = 0; indice < itens.length; indice += tamanho) {
        lotes.push(itens.slice(indice, indice + tamanho));
    }
    return lotes;
}

async function consultarEmLotes<T>(
    valores: string[],
    consultar: (
        lote: string[]
    ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
    contexto: string
): Promise<T[]> {
    if (valores.length === 0) return [];

    const lotes = dividirEmLotes(valores);
    const resultados: T[][] = [];

    for (let indice = 0; indice < lotes.length; indice += MAX_LOTES_SIMULTANEOS) {
        const grupo = lotes.slice(indice, indice + MAX_LOTES_SIMULTANEOS);
        const resultadosGrupo = await Promise.all(
            grupo.map(async (lote) => {
                const { data, error } = await consultar(lote);
                if (error) {
                    throw new Error(`${contexto}: ${error.message || "erro desconhecido"}`);
                }
                return data || [];
            })
        );
        resultados.push(...resultadosGrupo);
    }

    return resultados.flat();
}

function normalizarTexto(texto?: string | null): string {
    if (!texto) return "";
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function apenasDigitos(texto?: string | null): string {
    if (!texto) return "";
    return texto.replace(/\D/g, "").trim();
}

function formatarCpf(cpfLimpo: string): string {
    if (cpfLimpo.length !== 11) return cpfLimpo;
    return `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9, 11)}`;
}

function mesmaData(dataA?: string | null, dataB?: string | null): boolean {
    if (!dataA || !dataB) return false;
    try {
        // Tenta normalizar no formato YYYY-MM-DD
        const extrairYMD = (str: string) => {
            const limpo = str.trim();
            if (limpo.includes("/")) {
                const partes = limpo.split("/");
                if (partes.length === 3) {
                    const dia = partes[0].padStart(2, "0");
                    const mes = partes[1].padStart(2, "0");
                    const ano = partes[2].slice(0, 4);
                    return `${ano}-${mes}-${dia}`;
                }
            }
            if (limpo.includes("-")) {
                return limpo.slice(0, 10);
            }
            return null;
        };

        const ymdA = extrairYMD(dataA);
        const ymdB = extrairYMD(dataB);
        return !!ymdA && !!ymdB && ymdA === ymdB;
    } catch {
        return false;
    }
}

export function useStatusAtendimentos(
    unidadeId?: string,
    itensOuFichas: (EntradaStatusAtendimento | undefined | null)[] = []
) {
    const [statusMap, setStatusMap] = useState<Record<string, InfoStatusAtendimento>>({});
    const [loading, setLoading] = useState(false);
    const requisicaoAtualRef = useRef(0);

    // Normaliza os itens de entrada
    const itensProcessados = useMemo(() => {
        return itensOuFichas
            .map((item) => {
                if (!item) return null;
                if (typeof item === "string") {
                    const limpo = item.trim();
                    if (!limpo || limpo === "-") return null;
                    return {
                        sequencialFicha: limpo,
                        cpf: null,
                        nome: null,
                        dataFicha: null,
                    };
                }
                const seq = item.sequencialFicha ? String(item.sequencialFicha).trim() : null;
                const cpf = item.cpf ? String(item.cpf).trim() : null;
                const nome = item.nome ? String(item.nome).trim() : null;
                const dataFicha = item.dataFicha ? String(item.dataFicha).trim() : null;

                if (!seq && !cpf && !nome) return null;
                return {
                    sequencialFicha: seq && seq !== "-" ? seq : null,
                    cpf,
                    nome,
                    dataFicha,
                };
            })
            .filter(Boolean) as {
            sequencialFicha: string | null;
            cpf: string | null;
            nome: string | null;
            dataFicha: string | null;
        }[];
    }, [itensOuFichas]);

    const carregarStatus = useCallback(async () => {
        const requisicaoId = ++requisicaoAtualRef.current;

        if (!unidadeId || itensProcessados.length === 0) {
            setStatusMap({});
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // 1. Coleta listas para consulta otimizada
            const fichasValidas = Array.from(
                new Set(itensProcessados.map((i) => i.sequencialFicha).filter(Boolean) as string[])
            );

            const cpfsLimpos = Array.from(
                new Set(
                    itensProcessados
                        .map((i) => apenasDigitos(i.cpf))
                        .filter((c) => c && c.length >= 8)
                )
            );

            const cpfsParaQuery = Array.from(
                new Set([...cpfsLimpos, ...cpfsLimpos.map(formatarCpf)])
            );

            const nomesValidos = Array.from(
                new Set(
                    itensProcessados
                        .map((i) => i.nome?.trim())
                        .filter((n) => n && n.length > 2) as string[]
                )
            );

            // 2. Busca pacientes por CPF e por Nome para recuperar paciente_id
            const promessasPacientes: Promise<any[]>[] = [];

            if (cpfsParaQuery.length > 0) {
                promessasPacientes.push(
                    consultarEmLotes(
                        cpfsParaQuery,
                        (lote) => supabase
                            .from("pacientes")
                            .select("id, nome, cpf, unidade_id")
                            .eq("unidade_id", unidadeId)
                            .in("cpf", lote),
                        "Erro ao buscar pacientes por CPF"
                    )
                );
            }

            if (nomesValidos.length > 0) {
                promessasPacientes.push(
                    consultarEmLotes(
                        nomesValidos,
                        (lote) => supabase
                            .from("pacientes")
                            .select("id, nome, cpf, unidade_id")
                            .eq("unidade_id", unidadeId)
                            .in("nome", lote),
                        "Erro ao buscar pacientes por nome"
                    )
                );
            }

            const resultadosPacientes = await Promise.all(promessasPacientes);
            const todosPacientes: any[] = resultadosPacientes.flat();

            const pacienteIdsPorCpf: Record<string, string[]> = {};
            const pacienteIdsPorNomeNorm: Record<string, string[]> = {};
            const pacienteIdsEncontrados = new Set<string>();

            todosPacientes.forEach((p) => {
                if (!p?.id) return;
                pacienteIdsEncontrados.add(p.id);

                const c = apenasDigitos(p.cpf);
                if (c) {
                    if (!pacienteIdsPorCpf[c]) pacienteIdsPorCpf[c] = [];
                    if (!pacienteIdsPorCpf[c].includes(p.id)) pacienteIdsPorCpf[c].push(p.id);
                }

                const n = normalizarTexto(p.nome);
                if (n) {
                    if (!pacienteIdsPorNomeNorm[n]) pacienteIdsPorNomeNorm[n] = [];
                    if (!pacienteIdsPorNomeNorm[n].includes(p.id)) {
                        pacienteIdsPorNomeNorm[n].push(p.id);
                    }
                }
            });

            // 3. Busca atendimentos por ficha_sequencial E por paciente_id
            const promessasAtendimentos: Promise<any[]>[] = [];

            if (fichasValidas.length > 0) {
                promessasAtendimentos.push(
                    consultarEmLotes(
                        fichasValidas,
                        (lote) => supabase
                            .from("atendimentos")
                            .select("id, ficha_sequencial, paciente_id, status, finalizado_em, created_at, observacao, exames_list")
                            .eq("unidade_id", unidadeId)
                            .in("ficha_sequencial", lote),
                        "Erro ao buscar atendimentos por ficha"
                    )
                );
            }

            if (pacienteIdsEncontrados.size > 0) {
                promessasAtendimentos.push(
                    consultarEmLotes(
                        Array.from(pacienteIdsEncontrados),
                        (lote) => supabase
                            .from("atendimentos")
                            .select("id, ficha_sequencial, paciente_id, status, finalizado_em, created_at, observacao, exames_list")
                            .eq("unidade_id", unidadeId)
                            .in("paciente_id", lote),
                        "Erro ao buscar atendimentos por paciente"
                    )
                );
            }

            const resultadosAtendimentos = await Promise.all(promessasAtendimentos);
            const todosAtendimentosRaw: any[] = resultadosAtendimentos.flat();

            // Desduplica atendimentos por id
            const atendimentosMapPorId: Record<string, any> = {};
            todosAtendimentosRaw.forEach((a) => {
                if (a?.id) atendimentosMapPorId[a.id] = a;
            });
            const atendimentos = Object.values(atendimentosMapPorId);

            // 4. Busca os exames vinculados aos atendimentos encontrados
            const atendimentoIds = atendimentos.map((a) => a.id).filter(Boolean);
            const examesMapPorAtendimento: Record<string, ExameAtendimentoResumo[]> = {};

            if (atendimentoIds.length > 0) {
                const examesData = await consultarEmLotes<any>(
                    atendimentoIds,
                    (lote) => supabase
                        .from("atendimento_exames")
                        .select("id, atendimento_id, status, sala, finalizado_em")
                        .in("atendimento_id", lote),
                    "Erro ao buscar exames dos atendimentos"
                );

                examesData.forEach((ex: any) => {
                    if (!ex.atendimento_id) return;
                    if (!examesMapPorAtendimento[ex.atendimento_id]) {
                        examesMapPorAtendimento[ex.atendimento_id] = [];
                    }
                    examesMapPorAtendimento[ex.atendimento_id].push({
                        id: ex.id,
                        sala: ex.sala,
                        status: ex.status,
                        finalizado_em: ex.finalizado_em,
                    });
                });
            }

            // 5. Indexa atendimentos para cruzamento rápido
            const atendimentosPorFicha: Record<string, any[]> = {};
            const atendimentosPorPacienteId: Record<string, any[]> = {};

            atendimentos.forEach((a) => {
                const f = String(a.ficha_sequencial || "").trim();
                if (f) {
                    if (!atendimentosPorFicha[f]) atendimentosPorFicha[f] = [];
                    atendimentosPorFicha[f].push(a);
                }

                if (a.paciente_id) {
                    if (!atendimentosPorPacienteId[a.paciente_id]) {
                        atendimentosPorPacienteId[a.paciente_id] = [];
                    }
                    atendimentosPorPacienteId[a.paciente_id].push(a);
                }
            });

            // Função auxiliar para selecionar o melhor atendimento dentre os disponíveis para o paciente.
            // Como a sequencial pode mudar entre visitas, priorizamos:
            // 1. Correspondência pela DATA da ficha (mais confiável quando sequencial muda)
            // 2. Correspondência pelo sequencial exato (como confirmação)
            // 3. Sequencial mencionado na observação
            // 4. Atendimento mais recente como fallback
            const selecionarMelhorAtendimento = (candidatos: any[], item: typeof itensProcessados[0]) => {
                if (!candidatos || candidatos.length === 0) return null;
                if (candidatos.length === 1) return candidatos[0];

                // 1. Prioridade: data da ficha bate com created_at do atendimento
                if (item.dataFicha) {
                    const matchData = candidatos.find((c) =>
                        mesmaData(c.created_at, item.dataFicha)
                    );
                    if (matchData) return matchData;
                }

                // 2. Fallback: sequencial exato
                if (item.sequencialFicha) {
                    const matchFicha = candidatos.find(
                        (c) => String(c.ficha_sequencial || "").trim() === item.sequencialFicha
                    );
                    if (matchFicha) return matchFicha;

                    // 3. Sequencial mencionado na observação
                    const matchObs = candidatos.find((c) =>
                        String(c.observacao || "").includes(item.sequencialFicha!)
                    );
                    if (matchObs) return matchObs;
                }

                // 4. Atendimento mais recente como último recurso
                return [...candidatos].sort((a, b) => {
                    const tA = new Date(a.created_at || 0).getTime();
                    const tB = new Date(b.created_at || 0).getTime();
                    return tB - tA;
                })[0];
            };

            const obterAtendimentosDosPacientes = (pacienteIds: string[]): any[] => {
                const candidatosPorId: Record<string, any> = {};
                pacienteIds.forEach((pacienteId) => {
                    (atendimentosPorPacienteId[pacienteId] || []).forEach((atendimento) => {
                        if (atendimento?.id) candidatosPorId[atendimento.id] = atendimento;
                    });
                });
                return Object.values(candidatosPorId);
            };

            // 6. Monta o resultado para cada item processado
            const novoMapa: Record<string, InfoStatusAtendimento> = {};

            itensProcessados.forEach((item) => {
                let atendimentoEscolhido: any = null;

                // Tentativa 1: Busca pelo CPF do paciente (mais confiável — não muda)
                // Usa selecionarMelhorAtendimento para escolher pela data quando há múltiplos
                const cpfDig = apenasDigitos(item.cpf);
                if (!atendimentoEscolhido && cpfDig) {
                    const pacienteIds = pacienteIdsPorCpf[cpfDig] || [];
                    const lista = obterAtendimentosDosPacientes(pacienteIds);
                    atendimentoEscolhido = selecionarMelhorAtendimento(lista, item);
                }

                // Tentativa 2: Busca pelo Nome do paciente (quando sem CPF)
                const nomeNorm = normalizarTexto(item.nome);
                if (!atendimentoEscolhido && nomeNorm) {
                    const pacienteIds = pacienteIdsPorNomeNorm[nomeNorm] || [];
                    const lista = obterAtendimentosDosPacientes(pacienteIds);
                    atendimentoEscolhido = selecionarMelhorAtendimento(lista, item);
                }

                // Tentativa 3: Busca direta por ficha_sequencial exata (quando sem CPF/nome no banco)
                if (!atendimentoEscolhido && item.sequencialFicha && atendimentosPorFicha[item.sequencialFicha]?.length) {
                    atendimentoEscolhido = selecionarMelhorAtendimento(
                        atendimentosPorFicha[item.sequencialFicha],
                        item
                    );
                }

                // Tentativa 4: Ficha mencionada na observação de outro atendimento
                if (!atendimentoEscolhido && item.sequencialFicha) {
                    atendimentoEscolhido = atendimentos.find((a) =>
                        String(a.observacao || "").includes(item.sequencialFicha!)
                    );
                }

                let info: InfoStatusAtendimento;

                if (!atendimentoEscolhido) {
                    info = {
                        ficha: item.sequencialFicha || item.cpf || item.nome || "",
                        statusGeral: "SEM_ATENDIMENTO",
                        label: "Sem atendimento",
                        corBadge: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
                        totalExames: 0,
                        examesFinalizados: 0,
                        exames: [],
                        todosFinalizados: false,
                        detalhesTexto: "Nenhum atendimento encontrado para este funcionário na recepção.",
                    };
                } else {
                    const exames = examesMapPorAtendimento[atendimentoEscolhido.id] || [];
                    const statusAtend = (atendimentoEscolhido.status || "").toUpperCase();
                    const isAtendFinalizado =
                        statusAtend === "FINALIZADO" || !!atendimentoEscolhido.finalizado_em;

                    const totalExames = exames.length;
                    const examesFinalizados = exames.filter((e) => {
                        const st = (e.status || "").toUpperCase();
                        return st === "FINALIZADO" || !!e.finalizado_em;
                    }).length;

                    const temExameEmAtendimento = exames.some(
                        (e) => (e.status || "").toUpperCase() === "EM_ATENDIMENTO"
                    );

                    let statusGeral: TipoStatusAtendimento = "AGUARDANDO";
                    let label = "";
                    let corBadge = "";
                    let todosFinalizados = false;

                    if (totalExames > 0) {
                        if (examesFinalizados === totalExames && isAtendFinalizado) {
                            statusGeral = "FINALIZADO";
                            label = `Finalizado (${examesFinalizados}/${totalExames})`;
                            corBadge =
                                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
                            todosFinalizados = true;
                        } else if (temExameEmAtendimento || statusAtend === "EM_ATENDIMENTO") {
                            statusGeral = "EM_ATENDIMENTO";
                            label = `Em atendimento (${examesFinalizados}/${totalExames})`;
                            corBadge =
                                "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
                            todosFinalizados = false;
                        } else {
                            statusGeral = "AGUARDANDO";
                            label = `Aguardando (${examesFinalizados}/${totalExames})`;
                            corBadge =
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
                            todosFinalizados = false;
                        }
                    } else {
                        // Sem linhas na tabela atendimento_exames, avalia o status do atendimento
                        if (isAtendFinalizado) {
                            statusGeral = "FINALIZADO";
                            label = "Finalizado";
                            corBadge =
                                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
                            todosFinalizados = true;
                        } else if (statusAtend === "EM_ATENDIMENTO") {
                            statusGeral = "EM_ATENDIMENTO";
                            label = "Em atendimento";
                            corBadge =
                                "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
                            todosFinalizados = false;
                        } else {
                            statusGeral = "AGUARDANDO";
                            label = atendimentoEscolhido.status || "Aguardando";
                            corBadge =
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
                            todosFinalizados = false;
                        }
                    }

                    const detalhesExames =
                        totalExames > 0
                            ? exames
                                  .map((e) => `${e.sala || "Exame"}: ${e.status || "Aguardando"}`)
                                  .join(" | ")
                            : `Atendimento: ${todosFinalizados ? "Finalizado" : "Em andamento"}${
                                  atendimentoEscolhido.ficha_sequencial
                                      ? ` (Ficha: ${atendimentoEscolhido.ficha_sequencial})`
                                      : ""
                              }`;

                    info = {
                        ficha:
                            item.sequencialFicha ||
                            atendimentoEscolhido.ficha_sequencial ||
                            item.cpf ||
                            "",
                        atendimentoId: atendimentoEscolhido.id,
                        statusGeral,
                        label,
                        corBadge,
                        totalExames,
                        examesFinalizados,
                        exames,
                        todosFinalizados,
                        detalhesTexto: detalhesExames,
                    };
                }

                // Mapeia todas as possíveis chaves que a UI pode usar para buscar o registro
                const chavesParaMapear = [
                    item.sequencialFicha,
                    item.cpf,
                    apenasDigitos(item.cpf),
                    item.nome,
                    normalizarTexto(item.nome),
                    atendimentoEscolhido?.ficha_sequencial,
                ].filter(Boolean) as string[];

                chavesParaMapear.forEach((k) => {
                    novoMapa[k] = info;
                });
            });

            if (requisicaoId === requisicaoAtualRef.current) {
                setStatusMap(novoMapa);
            }
        } catch (err) {
            console.error("Erro inesperado ao calcular status de atendimentos:", err);
        } finally {
            if (requisicaoId === requisicaoAtualRef.current) {
                setLoading(false);
            }
        }
    }, [unidadeId, itensProcessados]);

    useEffect(() => {
        carregarStatus();
    }, [carregarStatus]);

    // Atualização em tempo real via canais do Supabase
    useEffect(() => {
        if (!unidadeId) return;

        const channel = supabase
            .channel(`realtime-status-atendimentos-${unidadeId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "atendimentos", filter: `unidade_id=eq.${unidadeId}` },
                () => {
                    carregarStatus();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "atendimento_exames", filter: `unidade_id=eq.${unidadeId}` },
                () => {
                    carregarStatus();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [unidadeId, carregarStatus]);

    return { statusMap, loading, refetch: carregarStatus };
}
