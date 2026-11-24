"use client"

/**
 * Modelo e importação da planilha de prazos de ASO por exame.
 *
 * - "Modelo Excel" gera um .xlsx com a aba "Prazos_ASO" (já preenchida com os
 *   prazos cadastrados, como antes) e a aba "Instruções".
 * - "Importar Planilha" lê a primeira aba com a coluna "Nome do Exame", mostra a
 *   prévia linha a linha (Novo, Atualizar, Já existe, Erro) e só grava depois de
 *   confirmar, com upsert por (unidade_id, nome_exame).
 *
 * Regras de cada coluna iguais às de antes: nome normalizado por
 * normalizarNomeExame; prazo vazio = 0; Tipo Filtro clinico, complementar ou
 * vazio; Dispensar Documento GED Sim/Não (vazio = Não).
 */

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { PrazoExame } from "../types"
import { normalizarNomeExame, normalizarTipoFiltro } from "../utils"

type SituacaoLinha = "novo" | "atualizar" | "existente" | "erro"

interface LinhaPrevia {
    linha: number
    nome_exame: string
    prazo_dias: number | null
    tipo_filtro: string
    ignorar_exame: boolean
    situacao: SituacaoLinha
    motivo?: string
}

const COLUNAS_MODELO = ["Nome do Exame", "Prazo (Dias)", "Tipo Filtro", "Dispensar Documento GED"]
const TIPOS_PERMITIDOS = ["clinico", "complementar", ""]

const ROTULO_SITUACAO: Record<SituacaoLinha, string> = {
    novo: "Novo",
    atualizar: "Atualizar",
    existente: "Já existe",
    erro: "Erro",
}

const COR_SITUACAO: Record<SituacaoLinha, string> = {
    novo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    atualizar: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    existente: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
    erro: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
}

const ESTILO_CABECALHO = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "009688" } },
    alignment: { horizontal: "center", vertical: "center" },
}

function chaveColuna(texto: unknown): string {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
}

async function carregarXlsx() {
    return import("xlsx-js-style")
}

// ---------------------------------------------------------------- modelo

async function baixarModelo(prazos: PrazoExame[]) {
    const XLSX = await carregarXlsx()

    const linhas = prazos.map((p) => [
        p.nome_exame,
        p.prazo_dias,
        p.tipo_filtro === "clinico" || p.tipo_filtro === "complementar" ? p.tipo_filtro : "",
        p.ignorar_exame ? "Sim" : "Não",
    ])
    const abaPrazos = XLSX.utils.aoa_to_sheet([COLUNAS_MODELO, ...linhas])
    abaPrazos["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 30 }]
    COLUNAS_MODELO.forEach((_, c) => {
        const celula = abaPrazos[XLSX.utils.encode_cell({ r: 0, c })]
        if (celula) celula.s = ESTILO_CABECALHO
    })

    const abaInstrucoes = XLSX.utils.aoa_to_sheet([
        ["Como preencher"],
        ["1. Preencha a aba \"Prazos_ASO\", uma linha por exame, a partir da linha 2. Não mude os títulos da linha 1."],
        ["2. Nome do Exame: exatamente como no SOC. A primeira letra fica maiúscula e o resto minúsculo."],
        ["3. Prazo (Dias): número inteiro de dias para o ASO. Vazio = 0."],
        ["4. Tipo Filtro: clinico, complementar ou vazio."],
        ["5. Dispensar Documento GED: Sim ou Não. Vazio = Não."],
        ["6. Exame que já existe é atualizado com os valores da planilha; os prazos já cadastrados vêm preenchidos neste modelo."],
        [""],
        ["Exemplo"],
        COLUNAS_MODELO,
        ["Audiometria", 2, "complementar", "Não"],
        ["Exame clínico", 0, "clinico", "Sim"],
    ])
    abaInstrucoes["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 18 }, { wch: 30 }]
    if (abaInstrucoes["A1"]) abaInstrucoes["A1"].s = { font: { bold: true, sz: 13 } }
    if (abaInstrucoes["A9"]) abaInstrucoes["A9"].s = { font: { bold: true } }
    COLUNAS_MODELO.forEach((_, c) => {
        const celula = abaInstrucoes[XLSX.utils.encode_cell({ r: 9, c })]
        if (celula) celula.s = ESTILO_CABECALHO
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, abaPrazos, "Prazos_ASO")
    XLSX.utils.book_append_sheet(wb, abaInstrucoes, "Instruções")
    XLSX.writeFile(wb, "Modelo_Importacao_Prazos_ASO.xlsx")
}

// ---------------------------------------------------------------- leitura

async function lerPlanilha(arquivo: File, prazos: PrazoExame[]): Promise<LinhaPrevia[]> {
    const XLSX = await carregarXlsx()
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" })

    // Primeira aba com a coluna "Nome do Exame" (ou nome_exame).
    let linhas: unknown[][] | null = null
    let cab: string[] = []
    let linhaCabecalho = 0
    for (const nomeAba of wb.SheetNames) {
        const dados = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: "", blankrows: false })
        for (let r = 0; r < Math.min(dados.length, 10); r++) {
            const c = (dados[r] || []).map(chaveColuna)
            if (c.includes("nomedoexame") || c.includes("nomeexame")) {
                linhas = dados
                cab = c
                linhaCabecalho = r
                break
            }
        }
        if (linhas) break
    }
    if (!linhas) throw new Error("Não encontrei a coluna \"Nome do Exame\". Use o modelo.")

    const indice = (...nomes: string[]) => cab.findIndex((c) => nomes.includes(c))
    const idxNome = indice("nomedoexame", "nomeexame")
    const idxPrazo = indice("prazodias", "prazo")
    const idxTipo = indice("tipofiltro")
    const idxGed = indice("dispensardocumentoged", "ignorarexame")

    const porNome = new Map(prazos.map((p) => [p.nome_exame, p]))
    const vistos = new Set<string>()
    const previa: LinhaPrevia[] = []

    for (let r = linhaCabecalho + 1; r < linhas.length; r++) {
        const row = linhas[r] || []
        const celula = (i: number) => (i >= 0 ? row[i] : "")
        const nome_exame = normalizarNomeExame(celula(idxNome))
        if (!nome_exame) continue

        const prazoBruto = String(celula(idxPrazo) ?? "").trim()
        const prazo = prazoBruto === "" ? 0 : Number(prazoBruto.replace(",", "."))
        const tipo_filtro = normalizarTipoFiltro(celula(idxTipo))
        const gedBruto = chaveColuna(celula(idxGed))
        const ignorar_exame = ["sim", "s", "true", "1", "verdadeiro"].includes(gedBruto)

        const base = {
            linha: r + 1,
            nome_exame,
            prazo_dias: Number.isFinite(prazo) ? prazo : null,
            tipo_filtro,
            ignorar_exame,
        }

        if (!Number.isInteger(prazo) || prazo < 0) {
            previa.push({ ...base, situacao: "erro", motivo: "Prazo deve ser um número inteiro de dias" })
            continue
        }
        if (!TIPOS_PERMITIDOS.includes(tipo_filtro)) {
            previa.push({ ...base, situacao: "erro", motivo: "Tipo Filtro deve ser clinico, complementar ou vazio" })
            continue
        }
        if (gedBruto && !ignorar_exame && !["nao", "n", "false", "0", "falso"].includes(gedBruto)) {
            previa.push({ ...base, situacao: "erro", motivo: "Dispensar Documento GED deve ser Sim ou Não" })
            continue
        }
        if (vistos.has(nome_exame)) {
            previa.push({ ...base, situacao: "erro", motivo: "Repetido na planilha" })
            continue
        }
        vistos.add(nome_exame)

        const existente = porNome.get(nome_exame)
        if (!existente) {
            previa.push({ ...base, situacao: "novo" })
            continue
        }
        const mudancas: string[] = []
        if (Number(existente.prazo_dias) !== prazo) mudancas.push(`prazo ${existente.prazo_dias} → ${prazo}`)
        if ((existente.tipo_filtro || "") !== tipo_filtro) mudancas.push(`tipo ${existente.tipo_filtro || "vazio"} → ${tipo_filtro || "vazio"}`)
        if (!!existente.ignorar_exame !== ignorar_exame) mudancas.push(`GED ${existente.ignorar_exame ? "Sim" : "Não"} → ${ignorar_exame ? "Sim" : "Não"}`)

        previa.push({
            ...base,
            situacao: mudancas.length ? "atualizar" : "existente",
            motivo: mudancas.length ? mudancas.join(", ") : undefined,
        })
    }
    return previa
}

// ---------------------------------------------------------------- componente

export function ImportarPrazosExames({
    unidadeId,
    prazos,
    onImportado,
}: {
    unidadeId: string | null
    prazos: PrazoExame[]
    onImportado: () => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [previa, setPrevia] = useState<LinhaPrevia[] | null>(null)
    const [nomeArquivo, setNomeArquivo] = useState("")
    const [lendo, setLendo] = useState(false)
    const [gravando, setGravando] = useState(false)
    const [baixando, setBaixando] = useState(false)

    const gravar = previa?.filter((l) => l.situacao === "novo" || l.situacao === "atualizar") ?? []
    const contagem = (s: SituacaoLinha) => previa?.filter((l) => l.situacao === s).length ?? 0

    async function aoBaixarModelo() {
        setBaixando(true)
        try {
            await baixarModelo(prazos)
            toast.success(prazos.length ? "Modelo gerado com os prazos cadastrados!" : "Modelo vazio gerado com sucesso!")
        } catch (err) {
            console.error(err)
            toast.error("Erro ao gerar o modelo")
        } finally {
            setBaixando(false)
        }
    }

    async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
        const arquivo = e.target.files?.[0]
        e.target.value = ""
        if (!arquivo) return
        setLendo(true)
        try {
            const linhas = await lerPlanilha(arquivo, prazos)
            if (!linhas.length) {
                toast.warning("A planilha não tem exames preenchidos.")
                return
            }
            setNomeArquivo(arquivo.name)
            setPrevia(linhas)
        } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : "Erro ao processar arquivo Excel.")
        } finally {
            setLendo(false)
        }
    }

    async function importar() {
        if (!unidadeId) {
            toast.error("Unidade do usuário não identificada.")
            return
        }
        if (!gravar.length) return
        setGravando(true)
        try {
            const agora = new Date().toISOString()
            const payload = gravar.map((l) => ({
                unidade_id: unidadeId,
                nome_exame: l.nome_exame,
                prazo_dias: l.prazo_dias ?? 0,
                tipo_filtro: l.tipo_filtro,
                ignorar_exame: l.ignorar_exame,
                updated_at: agora,
            }))
            const { error } = await supabase
                .from("prazos_exames")
                .upsert(payload, { onConflict: "unidade_id,nome_exame" })
            if (error) throw error

            const novos = gravar.filter((l) => l.situacao === "novo").length
            const atualizados = gravar.length - novos
            toast.success(`${novos} prazo(s) cadastrado(s)${atualizados ? `, ${atualizados} atualizado(s)` : ""}`)
            setPrevia(null)
            onImportado()
        } catch (err) {
            console.error(err)
            toast.error("Erro ao salvar prazos no banco de dados.")
        } finally {
            setGravando(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={aoBaixarModelo}
                disabled={baixando}
                className="h-9 text-xs font-bold uppercase gap-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            >
                {baixando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Modelo Excel
            </Button>

            <input
                type="file"
                ref={inputRef}
                onChange={aoEscolherArquivo}
                accept=".xlsx,.xls,.csv"
                className="hidden"
            />
            <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={lendo || !unidadeId}
                className="h-9 text-xs font-bold uppercase gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
                {lendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importar Planilha
            </Button>

            <Dialog open={!!previa} onOpenChange={(aberto) => { if (!aberto && !gravando) setPrevia(null) }}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            Importar prazos de ASO
                        </DialogTitle>
                        <p className="text-xs text-slate-500">{nomeArquivo}</p>
                    </DialogHeader>

                    <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase">
                        {(["novo", "atualizar", "existente", "erro"] as const).map((s) => (
                            <span key={s} className={`rounded-full px-2.5 py-1 ${COR_SITUACAO[s]}`}>
                                {ROTULO_SITUACAO[s]}: {contagem(s)}
                            </span>
                        ))}
                    </div>

                    <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-100 text-left text-[10px] uppercase text-slate-500 dark:bg-slate-800">
                                <tr>
                                    <th className="px-2 py-1.5">Linha</th>
                                    <th className="px-2 py-1.5">Nome do exame</th>
                                    <th className="px-2 py-1.5 text-right">Prazo</th>
                                    <th className="px-2 py-1.5">Tipo</th>
                                    <th className="px-2 py-1.5">Dispensa GED</th>
                                    <th className="px-2 py-1.5">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previa?.map((l) => (
                                    <tr key={l.linha} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-2 py-1.5 text-slate-400">{l.linha}</td>
                                        <td className="px-2 py-1.5 font-medium">{l.nome_exame}</td>
                                        <td className="px-2 py-1.5 text-right">{l.prazo_dias ?? "—"}</td>
                                        <td className="px-2 py-1.5">{l.tipo_filtro || "—"}</td>
                                        <td className="px-2 py-1.5">{l.ignorar_exame ? "Sim" : "Não"}</td>
                                        <td className="px-2 py-1.5">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${COR_SITUACAO[l.situacao]}`}>
                                                {ROTULO_SITUACAO[l.situacao]}
                                            </span>
                                            {l.motivo && <span className="ml-2 text-[11px] text-slate-500">{l.motivo}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {contagem("erro") > 0 && (
                        <p className="text-xs text-red-600">As linhas com erro serão ignoradas. Corrija a planilha e importe de novo se precisar delas.</p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrevia(null)} disabled={gravando}>Cancelar</Button>
                        <Button
                            onClick={importar}
                            disabled={gravando || !gravar.length}
                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                            {gravando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Importar {gravar.length} prazo(s)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
