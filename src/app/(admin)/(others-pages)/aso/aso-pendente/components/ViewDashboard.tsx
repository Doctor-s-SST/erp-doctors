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
    obterMaiorPrazo,
    obterStatusVencimento,
    formatPercent,
} from "../utils";

export function ViewDashboard({
    analytics,
    todosFuncionarios,
    filtroTipoExame,
    prazosMap,
}: ViewDashboardProps) {
    if (!analytics) {
        return (
            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-mono uppercase text-slate-400 dark:border-gray-700 dark:bg-gray-900">
                Importe uma planilha Excel para visualizar o Dashboard.
            </div>
        );
    }

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
            const funcionario = item.socResumo || item;
            return classificarTipoExame(funcionario) === filtroTipoExame;
        });
    }, [todosFuncionarios, filtroTipoExame]);

    /* ============================================================
       INDICADORES PRINCIPAIS
    ============================================================ */
    const total = funcionarios.length;

    const concluidos = funcionarios.filter((item) => {
        const res = item.socResumo || item;
        const pendentes = Array.isArray(res.examesPendentes)
            ? res.examesPendentes.length
            : Number(res.examesPendentes ?? 0);

        return pendentes === 0;
    }).length;

    const pendentes = total - concluidos;

    /* ============================================================
       TIPO DE EXAME
    ============================================================ */
    const quantidadeClinicos = funcionarios.filter((item) => {
        const res = item.socResumo || item;
        return classificarTipoExame(res) === "clinico";
    }).length;

    const quantidadeComplementares = funcionarios.filter((item) => {
        const res = item.socResumo || item;
        return classificarTipoExame(res) === "complementar";
    }).length;

    const comparacaoTipoData = [
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
       MAPA DOS EXAMES
    ============================================================ */
    const examesClinicosMap: Record<string, number> = {};
    const examesComplementaresMap: Record<string, number> = {};

    funcionarios.forEach((item) => {
        const res = item.socResumo || item;
        const exames = Array.isArray(res.listaExamesResumida)
            ? res.listaExamesResumida
            : [];

        exames.forEach((exame: any) => {
            const nome = String(
                exame?.descricaoExame ||
                exame?.nomeExame ||
                exame?.nome ||
                exame ||
                ""
            ).trim();

            if (!nome) return;

            const tipo = classificarTipoExame({
                listaExamesResumida: [exame],
            });

            if (tipo === "clinico") {
                examesClinicosMap[nome] = (examesClinicosMap[nome] || 0) + 1;
            } else {
                examesComplementaresMap[nome] = (examesComplementaresMap[nome] || 0) + 1;
            }
        });
    });

    const examesClinicosData = Object.entries(examesClinicosMap)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    const examesComplementaresData = Object.entries(examesComplementaresMap)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    const topClinicos = examesClinicosData.slice(0, 10);
    const topComplementares = examesComplementaresData.slice(0, 10);

    /* ============================================================
       VENCIMENTO DOS ASOS PENDENTES
    ============================================================ */
    const pendenciasList = analytics?.funcionariosComExamesPendentes || [];

    let vencidos = 0;
    let noPrazo = 0;
    let semPrazo = 0;

    const funcionariosMap = new Map<string, any>();

    funcionarios.forEach((item) => {
        const res = item.socResumo || item;
        if (!res) return;
        const cpf = res.cpfFuncionario || res.cpf;
        if (!cpf) return;
        funcionariosMap.set(cpf, res);
    });

    pendenciasList.forEach((item: any) => {
        const cpf = item.cpfFuncionario || item.cpf;
        const funcionario = funcionariosMap.get(cpf);

        const dataFicha = funcionario?.dataFicha || item.dataFicha || null;

        const examesList: string[] = Array.isArray(item.examesPendentes)
            ? item.examesPendentes
            : [item.examesPendentes || ""];

        const maiorPrazo = obterMaiorPrazo(examesList, prazosMap);
        const status = obterStatusVencimento(dataFicha, maiorPrazo);

        if (status === "vencido") {
            vencidos++;
        } else if (status === "no_prazo") {
            noPrazo++;
        } else {
            semPrazo++;
        }
    });

    const totalComStatus = vencidos + noPrazo + semPrazo;
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
        {
            nome: "Sem prazo",
            total: semPrazo,
            percentual: totalComStatus > 0 ? (semPrazo / totalComStatus) * 100 : 0,
        },
    ];

    /* ============================================================
       TIPO DE ASO
    ============================================================ */
    const tipoAsoMap: Record<string, number> = {};

    funcionarios.forEach((item) => {
        const funcionario = item.socResumo || item;
        const tipoAso = String(
            funcionario?.tipoAso || "Não informado"
        ).trim();

        const nomeTipo = tipoAso || "Não informado";
        tipoAsoMap[nomeTipo] = (tipoAsoMap[nomeTipo] || 0) + 1;
    });

    const tipoAsoData = Object.entries(tipoAsoMap)
        .map(([name, total]) => ({
            name,
            total,
            percentual: total > 0 ? (total / (funcionarios.length || 1)) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    /* ============================================================
       CÁLCULOS AUXILIARES
    ============================================================ */
    const totalExames =
        examesClinicosData.reduce((acc, item) => acc + item.total, 0) +
        examesComplementaresData.reduce((acc, item) => acc + item.total, 0);

    const mediaExamesPorFuncionario = total > 0 ? totalExames / total : 0;

    const maxClinico =
        topClinicos.length > 0
            ? Math.max(...topClinicos.map((d) => d.total))
            : 10;

    const maxComplementar =
        topComplementares.length > 0
            ? Math.max(...topComplementares.map((d) => d.total))
            : 10;

    return (
        <div className="space-y-5">
            {/* =====================================================
                RESUMO PRINCIPAL
            ===================================================== */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ASOS VENCIDOS */}
                <Card className="border-red-200 bg-white shadow-sm dark:border-red-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    ASOs vencidos
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight text-red-500">
                                    {vencidos}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-red-500">
                                    {percentualVencidos.toFixed(1)}% dos pendentes
                                </p>
                            </div>
                            <div className="rounded-xl bg-red-500/10 p-2.5">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

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
                                    {totalComStatus > 0
                                        ? ((noPrazo / totalComStatus) * 100).toFixed(1)
                                        : "0.0"}
                                    % dos pendentes
                                </p>
                            </div>
                            <div className="rounded-xl bg-emerald-500/10 p-2.5">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* MÉDIA DE EXAMES */}
                <Card className="border-violet-200 bg-white shadow-sm dark:border-violet-900/40 dark:bg-gray-900">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Média de exames por pessoa
                                </p>
                                <p className="mt-1 text-3xl font-black tracking-tight">
                                    {Math.round(mediaExamesPorFuncionario)}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-400">
                                    Exames por funcionário
                                </p>
                            </div>
                            <div className="rounded-xl bg-violet-500/10 p-2.5">
                                <Activity className="h-5 w-5 text-violet-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* =====================================================
                SEGUNDA LINHA — VENCIMENTO + DISTRIBUIÇÃO
            ===================================================== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                                Nenhum ASO pendente encontrado.
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
                                                        : entry.nome === "No prazo"
                                                            ? THEME_COLORS.success
                                                            : THEME_COLORS.slate
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
                                            COM PENDÊNCIA
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
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
                                            FUNCIONÁRIOS
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
                </Card>
            </div>

            {/* =====================================================
                PRINCIPAIS EXAMES
            ===================================================== */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* CLÍNICOS */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Stethoscope className="h-4 w-4 text-blue-500" />
                            Principais exames clínicos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[390px] pt-4">
                        {topClinicos.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                Nenhum exame clínico encontrado.
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

                {/* COMPLEMENTARES */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <CardHeader className="border-b border-slate-200 px-5 py-3 dark:border-gray-700">
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
                            <Microscope className="h-4 w-4 text-orange-500" />
                            Principais exames complementares
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[390px] pt-4">
                        {topComplementares.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs font-mono uppercase text-slate-400">
                                Nenhum exame complementar encontrado.
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
                                        domain={[0, Math.ceil(maxComplementar * 1.25)]}
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
            </div>
        </div>
    );
}
