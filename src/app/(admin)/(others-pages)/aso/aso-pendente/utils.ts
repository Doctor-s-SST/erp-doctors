import { PrazosMap, StatusVencimentoVisual } from "./types";

export const THEME_COLORS = {
    primary: "#317bbd",
    secondary: "#ec801a",
    success: "#10b981",
    danger: "#ef4444",
    violet: "#6366f1",
    warning: "#f59e0b",
    slate: "#64748b",
    legendBackground: "#0A2647",
};

export const CORES_TIPO_ASO = [
    THEME_COLORS.primary,
    THEME_COLORS.secondary,
    THEME_COLORS.violet,
    THEME_COLORS.success,
    THEME_COLORS.warning,
    THEME_COLORS.danger,
    THEME_COLORS.slate,
];

export function possuiAsoMontado(observacao?: string): boolean {
    if (!observacao) return false;

    const texto = observacao.toLowerCase();

    return (
        texto.includes("aso montado") ||
        texto.includes("aso emitido") ||
        texto.includes("montado")
    );
}

export function classificarTipoExame(
    funcionario: any,
    prazosMap: PrazosMap = {}
): "clinico" | "complementar" {
    const exames =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    if (!Array.isArray(exames) || exames.length === 0) {
        return "clinico";
    }

    const possuiComplementar = exames.some((exame: any) => {
        const nomeExame = normalizarNomeExame(
            exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
        );
        if (!nomeExame) return false;

        const prazo = prazosMap[nomeExame];
        return prazo?.tipo_filtro === "complementar" && !prazo?.ignorar_exame;
    });

    return possuiComplementar ? "complementar" : "clinico";
}

export const compararValores = (
    a: any,
    b: any,
    key: string
): number => {

    let valA = a[key];
    let valB = b[key];

    if (key === "statusVencimento") {
        valA = a.statusVencimento?.label || "";
        valB = b.statusVencimento?.label || "";
    } else if (key === "examesList") {
        valA = Array.isArray(a.examesList)
            ? a.examesList.join(", ")
            : "";

        valB = Array.isArray(b.examesList)
            ? b.examesList.join(", ")
            : "";
    }

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === "string") {
        return valA.localeCompare(String(valB));
    }

    return valA > valB ? 1 : valA < valB ? -1 : 0;
};

export function parseDateBR(
    dateStr: string | null
): Date | null {

    if (!dateStr) return null;

    const parts = dateStr.split("/");

    if (parts.length !== 3) {
        return null;
    }

    const dia = Number(parts[0]);
    const mes = Number(parts[1]);
    const ano = Number(parts[2]);

    if (
        !Number.isFinite(dia) ||
        !Number.isFinite(mes) ||
        !Number.isFinite(ano)
    ) {
        return null;
    }

    const data = new Date(
        ano,
        mes - 1,
        dia
    );

    if (Number.isNaN(data.getTime())) {
        return null;
    }

    data.setHours(0, 0, 0, 0);

    return data;
}

export function normalizarNomeExame(
    nome: string
): string {
    return String(nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, "")
        .replace(/[-_]/g, " ")   // trata hífen/underscore como espaço
        .replace(/\s+/g, " ")    // colapsa espaços múltiplos em um só
        .trim()
        .toLowerCase();
}

export function exameEstaConcluido(
    exame: any
): boolean {

    const nome = normalizarNomeExame(
        exame?.descricaoExame ||
        exame?.nomeExame ||
        exame?.nome ||
        ""
    );

    const temDataExame =
        String(exame?.dataExame || "").trim() !== "";

    /*
     * Exame clínico:
     * concluído somente pela existência da data do exame.
     */
    if (nome === "exame clinico") {
        return temDataExame;
    }

    /*
     * Exames complementares:
     * precisam de data + relação com GED.
     */
    return (
        temDataExame &&
        exame?.temRelacao === true
    );
}

export function asoEstaConcluido(
    funcionario: any,
    prazosMap: PrazosMap = {}
): boolean {
    const exames =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    if (!Array.isArray(exames) || exames.length === 0) {
        return false;
    }

    const examesConsiderados = exames.filter(
        (exame: any) => !exameIsIgnorado(exame, prazosMap)
    );

    // Se todos os exames do ASO foram marcados para ignorar,
    // não sobra nada pendente — considera concluído.
    if (examesConsiderados.length === 0) {
        return true;
    }

    return examesConsiderados.every((exame: any) => exameEstaConcluido(exame));
}


export function possuiAso(
    funcionario: any
): boolean {
    const exames =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    return Array.isArray(exames) && exames.length > 0;
}

export function asoEstaPendente(
    funcionario: any,
    prazosMap: PrazosMap = {}
): boolean {
    const exames =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    if (!Array.isArray(exames) || exames.length === 0) {
        return false;
    }

    return !asoEstaConcluido(funcionario, prazosMap);
}


/**
 * Retorna o status de prazo para um funcionário com exames pendentes.
 *
 * Avalia SOMENTE os exames que estão pendentes (não concluídos).
 * Se ao menos um exame pendente já realizado estiver com o prazo estourado,
 * o ASO do funcionário é considerado VENCIDO.
 * Se nenhum exame pendente estiver vencido e houver ao menos um com prazo calculado,
 * é considerado NO PRAZO.
 * Caso contrário, é considerado SEM PRAZO.
 */
export function obterStatusPrazoPendente(
    funcionario: any,
    prazosMap: PrazosMap,
    nomesExamesPendentes?: string[]
): { temStatus: boolean; estaVencido: boolean; noPrazo: boolean } {
    const examesOriginais =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    if (!Array.isArray(examesOriginais) || examesOriginais.length === 0) {
        return { temStatus: false, estaVencido: false, noPrazo: false };
    }

    // Exames marcados para ignorar nunca entram no cálculo de prazo.
    const exames = examesOriginais.filter(
        (exame: any) => !exameIsIgnorado(exame, prazosMap)
    );

    if (exames.length === 0) {
        return { temStatus: false, estaVencido: false, noPrazo: false };
    }

    const examesPendentes = nomesExamesPendentes && nomesExamesPendentes.length > 0
        ? exames.filter((e: any) => {
            const nomeNorm = normalizarNomeExame(e?.descricaoExame || e?.nomeExame || e?.nome || "");
            return nomesExamesPendentes.some((p) => normalizarNomeExame(p) === nomeNorm);
        })
        : exames.filter((e: any) => e?.isPendente === true || !exameEstaConcluido(e));

    if (examesPendentes.length === 0) {
        return { temStatus: false, estaVencido: false, noPrazo: false };
    }

    let algumVencido = false;
    let possuiStatus = false;

    examesPendentes.forEach((exame: any) => {
        const dataExameStr = String(exame?.dataExame || "").trim();
        if (!dataExameStr) return;

        const nomeExame = normalizarNomeExame(
            exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
        );

        const prazoConfig = prazosMap[nomeExame];
        if (!prazoConfig?.prazo_dias || prazoConfig.ignorar_exame) return; // <- adiciona check

        const dataBase = parseDateBR(dataExameStr);
        if (!dataBase) return;

        const dataLimite = adicionarDiasUteis(dataBase, Number(prazoConfig.prazo_dias));
        const status = calcularStatusVencimentoVisual(dataLimite);
        possuiStatus = true;

        if (status.estaVencido) algumVencido = true;
    });

    if (!possuiStatus) {
        return { temStatus: false, estaVencido: false, noPrazo: false };
    }

    return { temStatus: true, estaVencido: algumVencido, noPrazo: !algumVencido };
}


export function adicionarDiasUteis(
    dataInicial: Date,
    quantidadeDias: number
): Date {

    const data = new Date(dataInicial);

    data.setHours(0, 0, 0, 0);

    let adicionados = 0;

    while (adicionados < quantidadeDias) {

        data.setDate(data.getDate() + 1);

        const diaSemana = data.getDay();

        if (
            diaSemana !== 0 &&
            diaSemana !== 6
        ) {
            adicionados++;
        }
    }

    return data;
}

/**
 * Obtém a data de upload do GED relacionado
 * a determinado exame.
 *
 * Se o exame aparecer em mais de um arquivo,
 * considera o upload mais recente.
 */
export function obterDataUploadExame(
    funcionario: any,
    descricaoExame: string
): Date | null {
    const nomeExame = normalizarNomeExame(descricaoExame);

    if (nomeExame === "exame clinico") {
        return null;
    }

    const documentosGed = Array.isArray(funcionario?.documentosGed)
        ? funcionario.documentosGed
        : [];

    const datas: Date[] = [];

    for (const ged of documentosGed) {
        const relacoesGed = Array.isArray(ged?.exameRelacao)
            ? ged.exameRelacao
            : [];

        const possuiExameNoGed = relacoesGed.some(
            (relacao: string) =>
                normalizarNomeExame(relacao) === nomeExame
        );

        if (!possuiExameNoGed) {
            continue;
        }

        const arquivos = Array.isArray(ged?.arquivos)
            ? ged.arquivos
            : [];

        for (const arquivo of arquivos) {
            const nomeArquivo = String(
                arquivo?.nomeArquivo || ""
            ).toLowerCase();

            // Não considerar documentos de encaminhamento
            if (nomeArquivo.includes("encaminhamento")) {
                continue;
            }

            // Não considerar arquivos já revisados
            if (nomeArquivo.includes("rev_")) {
                continue;
            }

            const dataUpload = parseDateBR(
                String(arquivo?.dataUpload || "")
            );

            if (dataUpload) {
                datas.push(dataUpload);
            }
        }
    }

    if (datas.length === 0) {
        return null;
    }

    return new Date(
        Math.max(
            ...datas.map(data => data.getTime())
        )
    );
}

/**
 * Retorna o maior prazo configurado
 * entre os exames informados.
 */
export function obterMaiorPrazo(
    exames: any[],
    prazosMap: PrazosMap
): number | null {
    let maiorPrazo: number | null = null;

    if (!Array.isArray(exames)) {
        return null;
    }

    exames.forEach((exame: any) => {
        const nomeExame = normalizarNomeExame(
            exame?.descricaoExame || exame?.nomeExame || exame?.nome || exame || ""
        );

        if (!nomeExame || nomeExame === "exame clinico") {
            return;
        }

        const prazo = prazosMap[nomeExame];

        if (!prazo || prazo.ignorar_exame) {
            return;
        }

        const prazoDias = Number(prazo.prazo_dias);

        if (
            Number.isFinite(prazoDias) &&
            (maiorPrazo === null || prazoDias > maiorPrazo)
        ) {
            maiorPrazo = prazoDias;
        }
    });

    return maiorPrazo;
}


/**
 * Calcula o prazo final de entrega do ASO.
 *
 * O ASO só chega nesta função quando todos
 * os exames já estão concluídos.
 *
 * A data-base vem da dataExame do exame
 * que possui o maior prazo.
 */
export function obterPrazoAso(
    funcionario: any,
    prazosMap: PrazosMap
): { maiorPrazo: number; dataBase: Date; dataLimite: Date } | null {
    const exames =
        funcionario?.aso?.listaExamesResumida ||
        funcionario?.listaExamesResumida ||
        [];

    if (!Array.isArray(exames) || exames.length === 0) {
        return null;
    }

    if (!asoEstaConcluido(funcionario, prazosMap)) {
        return null;
    }

    const examesComPrazo = exames.filter((exame: any) => {
        const nomeExame = normalizarNomeExame(
            exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
        );

        if (!nomeExame || nomeExame === "exame clinico") {
            return false;
        }

        const prazo = prazosMap[nomeExame];
        return Boolean(prazo) && !prazo.ignorar_exame;
    });

    if (examesComPrazo.length === 0) {
        return null;
    }

    const maiorPrazo = obterMaiorPrazo(examesComPrazo, prazosMap);

    if (maiorPrazo === null) {
        return null;
    }

    const exameControlador = examesComPrazo.find((exame: any) => {
        const nomeExame = normalizarNomeExame(
            exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
        );
        const prazo = Number(prazosMap[nomeExame]?.prazo_dias);
        return prazo === maiorPrazo;
    });

    if (!exameControlador) {
        return null;
    }

    const dataBase = parseDateBR(exameControlador?.dataExame || null);

    if (!dataBase) {
        return null;
    }

    const dataLimite = adicionarDiasUteis(dataBase, maiorPrazo);

    return { maiorPrazo, dataBase, dataLimite };
}

/**
 * Diferença em dias úteis entre duas datas.
 *
 * Resultado positivo:
 * dataFinal está à frente.
 *
 * Resultado negativo:
 * dataFinal já passou.
 */
export function contarDiasUteisEntre(
    dataInicial: Date,
    dataFinal: Date
): number {

    const inicio = new Date(dataInicial);
    const fim = new Date(dataFinal);

    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    if (
        inicio.getTime() ===
        fim.getTime()
    ) {
        return 0;
    }

    const passo =
        inicio < fim
            ? 1
            : -1;

    let atual = new Date(inicio);
    let count = 0;

    while (
        atual.getTime() !==
        fim.getTime()
    ) {

        atual.setDate(
            atual.getDate() + passo
        );

        const diaSemana =
            atual.getDay();

        if (
            diaSemana !== 0 &&
            diaSemana !== 6
        ) {
            count += passo;
        }
    }

    return count;
}

/**
 * Status visual baseado na data limite
 * já calculada do ASO.
 */
export function calcularStatusVencimentoVisual(
    dataLimite: Date | null
): StatusVencimentoVisual {

    if (!dataLimite) {
        return {
            label: "Sem Prazo",
            color:
                "bg-slate-500/10 text-slate-400 border-slate-500/20",
            estaVencido: false,
        };
    }

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    const limite = new Date(dataLimite);

    limite.setHours(0, 0, 0, 0);

    const diffDias =
        contarDiasUteisEntre(
            hoje,
            limite
        );

    if (diffDias < 0) {
        return {
            label:
                `Vencido há ${Math.abs(diffDias)}d`,
            color:
                "bg-red-500/20 text-red-500 border-red-500/30",
            estaVencido: true,
        };
    }

    if (diffDias === 0) {
        return {
            label: "Vence hoje",
            color:
                "bg-amber-500/20 text-amber-500 border-amber-500/30",
            estaVencido: false,
        };
    }

    if (diffDias <= 3) {
        return {
            label:
                `Vence em ${diffDias}d`,
            color:
                "bg-amber-500/20 text-amber-500 border-amber-500/30",
            estaVencido: false,
        };
    }

    return {
        label:
            `No prazo (${diffDias}d)`,
        color:
            "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
        estaVencido: false,
    };
}

/**
 * Mantida para compatibilidade com outros pontos
 * do sistema que ainda possam utilizar a função antiga.
 *
 * ATENÇÃO: esta função utiliza dias corridos.
 * Na ViewExamesConcluidos, utilize
 * calcularStatusVencimentoVisual(dataLimite).
 */
export function obterStatusVencimento(
    dataFicha: string | null,
    prazoDias: number | null
): "vencido" | "no_prazo" | "sem_prazo" {

    if (
        !dataFicha ||
        prazoDias === null
    ) {
        return "sem_prazo";
    }

    const dataBase =
        parseDateBR(dataFicha);

    if (!dataBase) {
        return "sem_prazo";
    }

    const dataLimite =
        adicionarDiasUteis(
            dataBase,
            prazoDias
        );

    const hoje = new Date();

    hoje.setHours(0, 0, 0, 0);

    return dataLimite < hoje
        ? "vencido"
        : "no_prazo";
}

export function formatPercent(
    valor: number,
    total: number
): string {

    if (!total) {
        return "0%";
    }

    return `${(
        (valor / total) *
        100
    ).toFixed(1)}%`;
}

export function exameIsIgnorado(
    exame: any,
    prazosMap: PrazosMap = {}
): boolean {
    const nome = normalizarNomeExame(
        exame?.descricaoExame || exame?.nomeExame || exame?.nome || ""
    );
    if (!nome) return false;
    console.log("[DEBUG ignorar]", nome, "→", prazosMap[nome]); // temporário
    return Boolean(prazosMap[nome]?.ignorar_exame);
}

export function getCorStatus(
    nome: string
): string {

    const texto = nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (
        texto.includes("conclu") ||
        texto.includes("pronto") ||
        texto.includes("apto")
    ) {
        return THEME_COLORS.success;
    }

    if (
        texto.includes("pend") ||
        texto.includes("inapto")
    ) {
        return THEME_COLORS.danger;
    }

    return THEME_COLORS.warning;
}