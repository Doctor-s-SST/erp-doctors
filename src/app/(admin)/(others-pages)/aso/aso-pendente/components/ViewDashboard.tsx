"use client"

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertTriangle,
    CheckCircle2,
    Activity,
    Clock,
    Layers,
    Stethoscope,
    Microscope,
    PauseCircle,
} from "lucide-react";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    LabelList,
} from "recharts";
import { ViewDashboardProps } from "../types";
import {
    THEME_COLORS,
    CORES_TIPO_ASO,
    classificarTipoExame,
    calcularStatusVencimentoVisual,
    asoEstaConcluido,
    obterPrazoAso,
    obterStatusPrazoPendente,
    possuiAso,
    formatPercent,
    exameEstaConcluido,
    normalizarNomeExame,
} from "../utils";

export function ViewDashboard({
    analytics,
    todosFuncionarios,
    filtroTipoExame,
    prazosMap,
}: ViewDashboardProps) {
    /* ============================================================
       FUNCIONÁRIOS FILTRADOS
    ============================================================ */
    const funcionarios = useMemo(() => {
        if (!Array.isArray(todosFuncionarios)) {
            return [];
        }

        if (filtroTipoExame === "todos") {
            return todosFuncionarios;
        }

        return todosFuncionarios.filter((item) => {
            return (
                classificarTipoExame(item, prazosMap) === filtroTipoExame
            );
        });
    }, [todosFuncionarios, filtroTipoExame, prazosMap]);

    if (!analytics) {
        return (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-mono uppercase text-slate-400 dark:border-gray-700 dark:bg-gray-900">
                Importe uma planilha Excel para visualizar o Dashboard.
            </div>
        );
    }

    const total = funcionarios.length;
    /* ============================================================
       TIPO DE EXAME
    ============================================================ */
    const quantidadeClinicos = funcionarios.filter((item) => {
        return classificarTipoExame(item, prazosMap) === "clinico";
    }).length;

    const quantidadeComplementares = funcionarios.filter((item) => {
        return classificarTipoExame(item, prazosMap) === "complementar";
    }).length;

    const comparacaoTipoData =
        filtroTipoExame === "clinico"
            ? [
                {
                    tipo: "Clínicos",
                    total: quantidadeClinicos,
                },
            ]
            : filtroTipoExame === "complementar"
                ? [
                    {
                        tipo: "Complementares",
                        total: quantidadeComplementares,
                    },
                ]
                : [
                    {
                        tipo: "Clínicos",
                        total: quantidadeClinicos,
                    },
                    {
                        tipo: "Complementares",
                        total: quantidadeComplementares,
                    },
                ];

    /* ============================================================
        MAPA DOS EXAMES — GERAL (usado só pra média por funcionário)
     ============================================================ */
    const examesClinicosMap: Record<string, number> = {};
    const examesComplementaresMap: Record<string, number> = {};

    /* ============================================================
       MAPA DOS EXAMES — SOMENTE PENDENTES (usado nos gráficos)
    ============================================================ */
    const examesClinicosPendentesMap: Record<string, number> = {};
    const examesComplementaresPendentesMap: Record<string, number> = {};

    funcionarios.forEach((item) => {
        const aso = item.aso || item.socResumo || item;

        const exames = Array.isArray(aso.listaExamesResumida)
            ? aso.listaExamesResumida
            : Array.isArray(item.listaExamesResumida)
                ? item.listaExamesResumida
                : [];

        exames.forEach((exame: any) => {
            const nomeExibicao = String(
                exame?.descricaoExame ||
                exame?.nomeExame ||
                exame?.nome ||
                exame ||
                ""
            ).trim();

            const nomeNormalizado = normalizarNomeExame(nomeExibicao);

            if (!nomeNormalizado) return;

            const prazo = prazosMap[nomeNormalizado];

            if (!prazo) return;

            // contagem geral (todos os exames, usada só na média)
            if (prazo.tipo_filtro === "clinico") {
                examesClinicosMap[nomeExibicao] =
                    (examesClinicosMap[nomeExibicao] || 0) + 1;
            }
            if (prazo.tipo_filtro === "complementar") {
                examesComplementaresMap[nomeExibicao] =
                    (examesComplementaresMap[nomeExibicao] || 0) + 1;
            }

            // contagem só de exames pendentes (usada nos gráficos)
            const exameEstaPendente = !exameEstaConcluido(exame, prazosMap);

            if (!exameEstaPendente) return;

            if (prazo.tipo_filtro === "clinico") {
                examesClinicosPendentesMap[nomeExibicao] =
                    (examesClinicosPendentesMap[nomeExibicao] || 0) + 1;
            }
            if (prazo.tipo_filtro === "complementar") {
                examesComplementaresPendentesMap[nomeExibicao] =
                    (examesComplementaresPendentesMap[nomeExibicao] || 0) + 1;
            }
        });
    });

    // ============================================================
    // AGORA OS TOTAIS SÃO CALCULADOS APÓS O LOOP PREENCHER OS MAPAS
    // ============================================================
    const totalExamesClinicosPendentes = Object.values(examesClinicosPendentesMap)
        .reduce((acc, v) => acc + v, 0);

    const totalExamesComplementaresPendentes = Object.values(examesComplementaresPendentesMap)
        .reduce((acc, v) => acc + v, 0);

    const quantidadeExamesPendentesData =
        filtroTipoExame === "clinico"
            ? [{ tipo: "Clínicos", total: totalExamesClinicosPendentes }]
            : filtroTipoExame === "complementar"
                ? [{ tipo: "Complementares", total: totalExamesComplementaresPendentes }]
                : [
                    { tipo: "Clínicos", total: totalExamesClinicosPendentes },
                    { tipo: "Complementares", total: totalExamesComplementaresPendentes },
                ];
    const examesClinicosData = Object.entries(examesClinicosPendentesMap)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    const examesComplementaresData = Object.entries(examesComplementaresPendentesMap)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    const topClinicos = examesClinicosData.slice(0, 10);
    const topComplementares = examesComplementaresData.slice(0, 10);

    /* ============================================================
       MAPA DE PENDÊNCIAS POR CPF
       Constrói a partir de analytics.funcionariosComExamesPendentes
       para que o dashboard avalie prazo somente sobre exames
       realmente pendentes — consistente com ViewExamesPendentes.
    ============================================================ */
    const pendenciasMap = useMemo(() => {
        const map = new Map<string, string[]>();
        const lista = analytics?.funcionariosComExamesPendentes || [];

        lista.forEach((item: any) => {
            const cpf = String(
                item.cpfFuncionario || item.cpf || ""
            ).trim();
            if (!cpf) return;

            const examesPendentes: string[] = Array.isArray(item.examesPendentes)
                ? item.examesPendentes
                : [item.examesPendentes || ""].filter(Boolean);

            if (examesPendentes.length > 0) {
                map.set(cpf, examesPendentes);
            }
        });

        return map;
    }, [analytics?.funcionariosComExamesPendentes]);

    /* ============================================================
       VENCIMENTO DOS ASOS
       Considera TODOS os funcionários (concluídos e pendentes),
       contando por ASO/funcionário, não por exame:

       - Concluído -> usa obterPrazoAso (dataExame + dias úteis),
         igual à tela de Exames Concluídos.

       - Pendente -> usa obterStatusPrazoPendente que avalia
         SOMENTE os exames que ainda estão pendentes, igual à
         tela de Exames Pendentes.
    ============================================================ */
    let vencidos = 0;
    let noPrazo = 0;
    const funcionariosVencidos: any[] = [];

    funcionarios.forEach((item) => {
        if (asoEstaConcluido(item, prazosMap)) {
            const prazoAso = obterPrazoAso(item, prazosMap);

            if (!prazoAso) {
                return;
            }

            const status = calcularStatusVencimentoVisual(prazoAso.dataLimite);

            if (status.estaVencido) {
                vencidos++;
                funcionariosVencidos.push(item); // <- novo
            } else {
                noPrazo++;
            }

            return;
        }

        if (!possuiAso(item)) {
            return;
        }

        const cpf = String(
            item.cpfFuncionario || item.cpf || item.aso?.cpfFuncionario || ""
        ).trim();

        const examesPendentesNomes = pendenciasMap.get(cpf);
        const statusPendente = obterStatusPrazoPendente(item, prazosMap, examesPendentesNomes);

        if (!statusPendente.temStatus) {
            return;
        } else if (statusPendente.estaVencido) {
            vencidos++;
            funcionariosVencidos.push(item); // <- novo
        } else {
            noPrazo++;
        }
    });

    const totalComStatus = vencidos + noPrazo;
    const totalAsos = funcionarios.filter(possuiAso).length;
    const suspensos = Math.max(0, totalAsos - totalComStatus);
    const percentualVencidos =
        totalComStatus > 0 ? (vencidos / totalComStatus) * 100 : 0;

    const vencimentoData = [
        {
            nome: "Vencidos",
            total: vencidos,
            percentual: percentualVencidos,
        },
        {
            nome: "No prazo",
            total: noPrazo,
            percentual: totalComStatus > 0 ? (noPrazo / totalComStatus) * 100 : 0,
        },
    ];

    const tipoAsoVencidosMap: Record<string, number> = {};

    funcionariosVencidos.forEach((item) => {
        const tipoAso = String(
            item.aso?.tipoAso || item.tipoAso || "Não informado"
        ).trim();

        const nomeTipo = tipoAso || "Não informado";
        tipoAsoVencidosMap[nomeTipo] = (tipoAsoVencidosMap[nomeTipo] || 0) + 1;
    });

    const tipoAsoVencidosData = Object.entries(tipoAsoVencidosMap)
        .map(([name, total]) => ({
            name,
            total,
            percentual: total > 0 ? (total / (funcionariosVencidos.length || 1)) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    /* ============================================================
       CÁLCULOS AUXILIARES
    ============================================================ */
    const maxClinico =
        topClinicos.length > 0
            ? Math.max(...topClinicos.map((d) => d.total))
            : 10;

    const maxComplementar =
        topComplementares.length > 0
            ? Math.max(...topComplementares.map((d) => d.total))
            : 10;

    let totalDiasAtraso = 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    funcionariosVencidos.forEach((item) => {
        // Lógica simplificada pegando o limite já calculado ou estimado
        const prazoAso = obterPrazoAso(item, prazosMap);
        if (prazoAso && prazoAso.dataLimite) {
            const limite = new Date(prazoAso.dataLimite);
            limite.setHours(0, 0, 0, 0);
            const diffTime = hoje.getTime() - limite.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 0) {
                totalDiasAtraso += diffDays;
            }
        }
    });

    const mediaDiasVencidos = vencidos > 0 ? Math.round(totalDiasAtraso / vencidos) : 0;

    return (
        <div className="space-y-5">
            {/* =====================================================
                RESUMO PRINCIPAL
            ===================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

                {/* ASOS NO PRAZO */}
                <Card className="border-emerald-200 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    ASOs no prazo
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-emerald-500">
                                    {noPrazo}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-emerald-500">
                                    {totalAsos > 0
                                        ? ((noPrazo / totalAsos) * 100).toFixed(1)
                                        : "0.0"}
                                    % do total
                                </p>
                            </div>
                            <div className="rounded-xl bg-emerald-500/10 p-2.5">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ASOS VENCIDOS */}
                <Card className="border-red-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    ASO's vencidos
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-red-500">
                                    {vencidos}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-red-500">
                                    {totalAsos > 0 ? ((vencidos / totalAsos) * 100).toFixed(1) : "0.0"}% do total
                                </p>
                            </div>
                            <div className="rounded-xl bg-red-500/10 p-2.5">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* MÉDIA DE DIAS DOS ASOS VENCIDOS */}
                <Card className="border-amber-200 bg-white shadow-sm dark:border-amber-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    ASO suspenso
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-amber-500">
                                    {suspensos}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-amber-500">
                                    {totalAsos > 0 ? ((suspensos / totalAsos) * 100).toFixed(1) : "0.0"}% do total
                                </p>
                            </div>
                            <div className="rounded-xl bg-amber-500/10 p-2.5">
                                <PauseCircle className="h-5 w-5 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-violet-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Média de atraso (vencidos)
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-red-500">
                                    {mediaDiasVencidos} <span className="text-sm font-bold">dias</span>
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    Tempo médio de vencimento
                                </p>
                            </div>
                            <div className="rounded-xl bg-red-500/10 p-2.5">
                                <Activity className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* =====================================================
                SEGUNDA LINHA — VENCIMENTO + DISTRIBUIÇÃO
            ===================================================== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

                {/* TIPO DE ASOS VENCIDOS  */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            Distribuição por tipo de ASO (vencidos)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[390px] pt-4">
                        {tipoAsoVencidosData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                Nenhum ASO vencido encontrado.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tipoAsoVencidosData}
                                        dataKey="total"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={62}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        label={({ name, total: t, percent }: any) =>
                                            `${name}: ${t} (${(percent * 100).toFixed(1)}%)`
                                        }
                                        labelLine
                                    >
                                        {tipoAsoVencidosData.map((entry, index) => (
                                            <Cell
                                                key={`${entry.name}-${index}`}
                                                fill={CORES_TIPO_ASO[index % CORES_TIPO_ASO.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <text
                                        x="50%"
                                        y="43%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="fill-slate-800 dark:fill-slate-100"
                                    >
                                        <tspan x="50%" dy="-2" fontSize="24" fontWeight="900">
                                            {vencidos}
                                        </tspan>
                                        <tspan x="50%" dy="20" fontSize="9" fontWeight="700">
                                            VENCIDOS
                                        </tspan>
                                    </text>
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME_COLORS.legendBackground,
                                            border: "none",
                                            color: "#fff",
                                            borderRadius: 8,
                                        }}
                                    />
                                    <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "10px" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* CLÍNICO X COMPLEMENTAR */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Layers className="h-4 w-4 text-orange-500" />
                            Distribuição por tipo de exame
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[330px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparacaoTipoData}
                                margin={{
                                    top: 35,
                                    right: 25,
                                    left: 10,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                                <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                <Bar
                                    dataKey="total"
                                    name="Quantidade"
                                    radius={[6, 6, 0, 0]}
                                    barSize={60}
                                >
                                    <Cell fill={THEME_COLORS.primary} />
                                    <Cell fill={THEME_COLORS.secondary} />
                                    <LabelList
                                        dataKey="total"
                                        position="top"
                                        offset={8}
                                        style={{
                                            fontSize: 12,
                                            fontWeight: "800",
                                            fill: "currentColor",
                                        }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* =====================================================
                TIPO ASO
            ===================================================== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Activity className="h-4 w-4 text-violet-500" />
                            Distribuição por tipo de ASO
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[390px] pt-4">
                        {tipoAsoData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                Nenhum tipo de ASO encontrado.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tipoAsoData}
                                        dataKey="total"
                                        nameKey="name"
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={62}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        label={({ name, total: t, percent }: any) =>
                                            `${name}: ${t} (${(percent * 100).toFixed(1)}%)`
                                        }
                                        labelLine
                                    >
                                        {tipoAsoData.map((entry, index) => (
                                            <Cell
                                                key={`${entry.name}-${index}`}
                                                fill={
                                                    CORES_TIPO_ASO[
                                                    index % CORES_TIPO_ASO.length
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <text
                                        x="50%"
                                        y="43%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="fill-slate-800 dark:fill-slate-100"
                                    >
                                        <tspan
                                            x="50%"
                                            dy="-2"
                                            fontSize="24"
                                            fontWeight="900"
                                        >
                                            {total}
                                        </tspan>
                                        <tspan
                                            x="50%"
                                            dy="20"
                                            fontSize="9"
                                            fontWeight="700"
                                        >
                                            ASO'S
                                        </tspan>
                                    </text>
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME_COLORS.legendBackground,
                                            border: "none",
                                            color: "#fff",
                                            borderRadius: 8,
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        wrapperStyle={{ fontSize: "10px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card> */}
                {/* VENCIMENTO */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Clock className="h-4 w-4 text-red-500" />
                            Situação do prazo dos ASO&apos;s
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[330px] pt-4">
                        {totalComStatus === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                Nenhum ASO encontrado.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={vencimentoData}
                                        dataKey="total"
                                        nameKey="nome"
                                        cx="50%"
                                        cy="48%"
                                        innerRadius={62}
                                        outerRadius={95}
                                        paddingAngle={4}
                                        label={({ nome, total: t }: any) =>
                                            `${nome}: ${t} (${formatPercent(t, totalComStatus)})`
                                        }
                                        labelLine
                                    >
                                        {vencimentoData.map((entry) => (
                                            <Cell
                                                key={entry.nome}
                                                fill={
                                                    entry.nome === "Vencidos"
                                                        ? THEME_COLORS.danger
                                                        : THEME_COLORS.success
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <text
                                        x="50%"
                                        y="45%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="fill-slate-800 dark:fill-slate-100"
                                    >
                                        <tspan
                                            x="50%"
                                            dy="-2"
                                            fontSize="24"
                                            fontWeight="900"
                                        >
                                            {totalComStatus}
                                        </tspan>
                                        <tspan
                                            x="50%"
                                            dy="20"
                                            fontSize="9"
                                            fontWeight="700"
                                        >
                                            ASO'S
                                        </tspan>
                                    </text>
                                    <Tooltip
                                        contentStyle={{
                                            background: THEME_COLORS.legendBackground,
                                            border: "none",
                                            color: "#fff",
                                            borderRadius: 8,
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        wrapperStyle={{ fontSize: "11px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Qt exames pendentes */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Clock className="h-4 w-4 text-amber-500" />
                            Quantidade de exames pendentes por tipo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[330px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={quantidadeExamesPendentesData}
                                margin={{ top: 35, right: 25, left: 10, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                                <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                <Bar dataKey="total" name="Quantidade" radius={[6, 6, 0, 0]} barSize={60}>
                                    <Cell fill={THEME_COLORS.secondary} />
                                    <Cell fill={THEME_COLORS.primary} />
                                    <LabelList
                                        dataKey="total"
                                        position="top"
                                        offset={8}
                                        style={{ fontSize: 12, fontWeight: "800", fill: "currentColor" }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* =====================================================
                PRINCIPAIS EXAMES PENDENTES
            ===================================================== */}
            <div
                className={
                    filtroTipoExame === "todos"
                        ? "grid grid-cols-1 xl:grid-cols-2 gap-4"
                        : "grid grid-cols-1 gap-4"
                }
            >
                {/* CLÍNICOS */}
                {(filtroTipoExame === "todos" || filtroTipoExame === "clinico") && (
                    <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                            <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                                <Stethoscope className="h-4 w-4 text-blue-500" />
                                Principais exames clínicos pendentes
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="h-[390px] pt-4">
                            {topClinicos.length === 0 ? (
                                <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                    Nenhum exame clínico pendente encontrado.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={topClinicos}
                                        layout="vertical"
                                        margin={{
                                            top: 5,
                                            right: 90,
                                            left: 10,
                                            bottom: 5,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            horizontal={false}
                                            opacity={0.12}
                                        />

                                        <XAxis
                                            type="number"
                                            allowDecimals={false}
                                            domain={[0, Math.ceil(maxClinico * 1.25)]}
                                            tick={{ fontSize: 10 }}
                                        />

                                        <YAxis
                                            dataKey="nome"
                                            type="category"
                                            width={190}
                                            tick={{ fontSize: 9 }}
                                        />

                                        <Tooltip
                                            contentStyle={{
                                                background: THEME_COLORS.legendBackground,
                                                border: "none",
                                                color: "#fff",
                                                borderRadius: 8,
                                            }}
                                        />

                                        <Bar
                                            dataKey="total"
                                            name="Quantidade"
                                            fill={THEME_COLORS.primary}
                                            radius={[0, 5, 5, 0]}
                                            barSize={17}
                                        >
                                            <LabelList
                                                dataKey="total"
                                                position="right"
                                                offset={8}
                                                formatter={(value: any) =>
                                                    `${value} (${formatPercent(
                                                        Number(value),
                                                        total
                                                    )})`
                                                }
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: "800",
                                                }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* COMPLEMENTARES */}
                {(filtroTipoExame === "todos" ||
                    filtroTipoExame === "complementar") && (
                        <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                            <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                                <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                                    <Microscope className="h-4 w-4 text-orange-500" />
                                    Principais exames complementares pendentes
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="h-[390px] pt-4">
                                {topComplementares.length === 0 ? (
                                    <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                        Nenhum exame complementar pendente encontrado.
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={topComplementares}
                                            layout="vertical"
                                            margin={{
                                                top: 5,
                                                right: 90,
                                                left: 10,
                                                bottom: 5,
                                            }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                horizontal={false}
                                                opacity={0.12}
                                            />

                                            <XAxis
                                                type="number"
                                                allowDecimals={false}
                                                domain={[
                                                    0,
                                                    Math.ceil(maxComplementar * 1.25),
                                                ]}
                                                tick={{ fontSize: 10 }}
                                            />

                                            <YAxis
                                                dataKey="nome"
                                                type="category"
                                                width={190}
                                                tick={{ fontSize: 9 }}
                                            />

                                            <Tooltip
                                                contentStyle={{
                                                    background: THEME_COLORS.legendBackground,
                                                    border: "none",
                                                    color: "#fff",
                                                    borderRadius: 8,
                                                }}
                                            />

                                            <Bar
                                                dataKey="total"
                                                name="Quantidade"
                                                fill={THEME_COLORS.secondary}
                                                radius={[0, 5, 5, 0]}
                                                barSize={17}
                                            >
                                                <LabelList
                                                    dataKey="total"
                                                    position="right"
                                                    offset={8}
                                                    formatter={(value: any) =>
                                                        `${value} (${formatPercent(
                                                            Number(value),
                                                            total
                                                        )})`
                                                    }
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: "800",
                                                    }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    )}
            </div>
        </div>
    );
}
