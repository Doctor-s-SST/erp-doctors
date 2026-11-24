/**
 * Exportação Excel da Gestão de Produtividade: aba "Resumo por profissional" e aba
 * "Atendimentos" com o tempo individual de cada atendimento e o farol em cor.
 */

import * as XLSX from "xlsx-js-style"
import { format } from "date-fns"

import { formatarDuracao, type AtendimentoTempo, type Farol, type ResumoProfissional } from "@/lib/gestao-tempo"

const COR_FAROL: Record<Farol, string> = {
    verde: "C6EFCE",
    amarelo: "FFEB9C",
    vermelho: "FFC7CE",
    sem_meta: "EDEDED",
}

const TEXTO_FAROL: Record<Farol, string> = {
    verde: "Dentro da meta",
    amarelo: "Na tolerância",
    vermelho: "Acima da meta",
    sem_meta: "Sem meta",
}

const ESTILO_TITULO = {
    font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "009688" } },
    alignment: { horizontal: "center", vertical: "center" },
}

const ESTILO_CABECALHO = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "37474F" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
}

function montarAba(titulo: string, cabecalho: string[], linhas: (string | number)[][], farois: Farol[], colunaFarol: number, larguras: number[]) {
    const ws = XLSX.utils.aoa_to_sheet([[titulo], cabecalho, ...linhas])
    const ultimaColuna = cabecalho.length - 1

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: ultimaColuna } }]
    ws["!rows"] = [{ hpt: 28 }, { hpt: 30 }]
    ws["!cols"] = larguras.map((wch) => ({ wch }))
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: 1 + linhas.length, c: ultimaColuna } }) }

    ws["A1"].s = ESTILO_TITULO
    for (let c = 0; c <= ultimaColuna; c++) {
        const celula = ws[XLSX.utils.encode_cell({ r: 1, c })]
        if (celula) celula.s = ESTILO_CABECALHO
    }

    farois.forEach((farol, i) => {
        const celula = ws[XLSX.utils.encode_cell({ r: i + 2, c: colunaFarol })]
        if (celula) {
            celula.s = { fill: { fgColor: { rgb: COR_FAROL[farol] } }, font: { bold: true } }
        }
    })

    return ws
}

export function exportarGestaoTempo(
    profissionais: ResumoProfissional[],
    atendimentos: AtendimentoTempo[],
    periodo: string,
    nomeArquivo: string
) {
    const resumoOrdenado = [...profissionais].sort(
        (a, b) => a.especialidade.localeCompare(b.especialidade, "pt-BR") || b.media - a.media
    )

    const abaResumo = montarAba(
        `GESTÃO DE PRODUTIVIDADE POR PROFISSIONAL - ${periodo}`,
        ["Especialidade", "Profissional", "Atendimentos", "Tempo médio (min)", "Tempo médio", "Mínimo (min)", "Máximo (min)", "Meta (min)", "Tolerância (%)", "Dentro da meta", "Na tolerância", "Acima da meta", "Farol"],
        resumoOrdenado.map((p) => [
            p.especialidade,
            p.profissional,
            p.quantidade,
            p.media,
            formatarDuracao(p.media),
            p.minimo,
            p.maximo,
            p.meta ?? "",
            p.meta ? p.tolerancia : "",
            p.verde,
            p.amarelo,
            p.vermelho,
            TEXTO_FAROL[p.farol],
        ]),
        resumoOrdenado.map((p) => p.farol),
        12,
        [22, 28, 13, 15, 14, 13, 13, 11, 13, 14, 14, 14, 16]
    )

    const atendimentosOrdenados = [...atendimentos].sort(
        (a, b) =>
            a.especialidade.localeCompare(b.especialidade, "pt-BR") ||
            a.profissionalNome.localeCompare(b.profissionalNome, "pt-BR") ||
            a.iniciado_em.localeCompare(b.iniciado_em)
    )

    const abaAtendimentos = montarAba(
        `TEMPOS INDIVIDUAIS DOS ATENDIMENTOS - ${periodo}`,
        ["Data", "Senha", "Paciente", "Especialidade", "Sala", "Profissional", "Início", "Fim", "Duração (min)", "Duração", "Meta (min)", "Situação"],
        atendimentosOrdenados.map((a) => [
            format(new Date(a.iniciado_em), "dd/MM/yyyy"),
            a.senha ?? "",
            a.paciente ?? "",
            a.especialidade,
            a.num_sala ?? "",
            a.profissionalNome,
            format(new Date(a.iniciado_em), "HH:mm:ss"),
            format(new Date(a.finalizado_em), "HH:mm:ss"),
            Math.round(a.minutos * 10) / 10,
            formatarDuracao(a.minutos),
            a.meta ?? "",
            TEXTO_FAROL[a.farol],
        ]),
        atendimentosOrdenados.map((a) => a.farol),
        11,
        [12, 10, 34, 20, 8, 26, 10, 10, 13, 12, 11, 16]
    )

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, abaResumo, "Resumo por profissional")
    XLSX.utils.book_append_sheet(wb, abaAtendimentos, "Atendimentos")
    XLSX.writeFile(wb, nomeArquivo)
}
