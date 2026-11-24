"use client"

/**
 * Importação de exames por planilha no Kanban de especialidades.
 *
 * - "Baixar modelo" gera um .xlsx com a aba "Exames" (Especialidade, Exame,
 *   Obrigatório), a aba "Especialidades" com os nomes exatos da unidade e a aba
 *   "Instruções".
 * - "Importar planilha" lê a primeira aba que tiver as colunas Especialidade e
 *   Exame, mostra a prévia linha a linha e só grava depois de confirmar.
 *
 * Regras: a especialidade precisa existir na unidade (não é criada aqui); o nome
 * do exame é gravado em maiúsculas, como no diálogo; exame já existente na mesma
 * especialidade não é duplicado, só tem o "Obrigatório" atualizado quando a
 * coluna vier preenchida com valor diferente; exames novos entram no fim da coluna.
 */

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface EspecialidadeImportacao {
    id: string
    nome: string
    exames: { id: string; nome: string; ordem?: number | null; obrigatorio_checkbox?: boolean | null }[]
}

type SituacaoLinha = "novo" | "atualizar" | "existente" | "erro"

interface LinhaPrevia {
    linha: number
    especialidade: string
    exame: string
    obrigatorio: boolean | null
    situacao: SituacaoLinha
    motivo?: string
    especialidadeId?: string
    exameId?: string
}

const COLUNAS_MODELO = ["Especialidade", "Exame", "Obrigatório"]

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

function normalizar(texto: unknown): string {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase()
}

/** Sim/Não da coluna Obrigatório; null quando vazia ou não reconhecida. */
function lerObrigatorio(valor: unknown): boolean | null | "invalido" {
    if (typeof valor === "boolean") return valor
    const v = normalizar(valor)
    if (!v) return null
    if (["SIM", "S", "X", "1", "TRUE", "VERDADEIRO"].includes(v)) return true
    if (["NAO", "N", "0", "FALSE", "FALSO"].includes(v)) return false
    return "invalido"
}

async function carregarXlsx() {
    return import("xlsx-js-style")
}

// ---------------------------------------------------------------- modelo

async function baixarModelo(especialidades: EspecialidadeImportacao[]) {
    const XLSX = await carregarXlsx()
    const estiloCabecalho = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "009688" } },
        alignment: { horizontal: "center", vertical: "center" },
    }

    const abaExames = XLSX.utils.aoa_to_sheet([COLUNAS_MODELO])
    abaExames["!cols"] = [{ wch: 32 }, { wch: 40 }, { wch: 14 }]
    COLUNAS_MODELO.forEach((_, c) => {
        const celula = abaExames[XLSX.utils.encode_cell({ r: 0, c })]
        if (celula) celula.s = estiloCabecalho
    })

    const nomes = [...especialidades].map((e) => e.nome).sort((a, b) => a.localeCompare(b, "pt-BR"))
    const abaEspecialidades = XLSX.utils.aoa_to_sheet([["Especialidades cadastradas na unidade"], ...nomes.map((n) => [n])])
    abaEspecialidades["!cols"] = [{ wch: 40 }]
    if (abaEspecialidades["A1"]) abaEspecialidades["A1"].s = estiloCabecalho

    const abaInstrucoes = XLSX.utils.aoa_to_sheet([
        ["Como preencher"],
        ["1. Preencha a aba \"Exames\", uma linha por exame, a partir da linha 2. Não mude os títulos da linha 1."],
        ["2. Especialidade: use o nome exato de uma especialidade da aba \"Especialidades\" (acentos e maiúsculas não importam). Especialidades novas devem ser criadas antes no Kanban."],
        ["3. Exame: nome do exame. Ele é gravado em maiúsculas."],
        ["4. Obrigatório: Sim ou Não (exige marcar o exame para finalizar a especialidade). Vazio = Não para exame novo e sem alteração para exame que já existe."],
        ["5. Exame que já existe na mesma especialidade não é duplicado."],
        [""],
        ["Exemplo"],
        COLUNAS_MODELO,
        ["CLÍNICO", "EXAME CLÍNICO", "Sim"],
        ["LABORATÓRIO", "HEMOGRAMA COMPLETO", "Não"],
    ])
    abaInstrucoes["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 14 }]
    if (abaInstrucoes["A1"]) abaInstrucoes["A1"].s = { font: { bold: true, sz: 13 } }
    if (abaInstrucoes["A8"]) abaInstrucoes["A8"].s = { font: { bold: true } }
    COLUNAS_MODELO.forEach((_, c) => {
        const celula = abaInstrucoes[XLSX.utils.encode_cell({ r: 8, c })]
        if (celula) celula.s = estiloCabecalho
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, abaExames, "Exames")
    XLSX.utils.book_append_sheet(wb, abaEspecialidades, "Especialidades")
    XLSX.utils.book_append_sheet(wb, abaInstrucoes, "Instruções")
    XLSX.writeFile(wb, "modelo_importacao_exames.xlsx")
}

// ---------------------------------------------------------------- leitura

async function lerPlanilha(arquivo: File, especialidades: EspecialidadeImportacao[]): Promise<LinhaPrevia[]> {
    const XLSX = await carregarXlsx()
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" })

    // Primeira aba com as colunas Especialidade e Exame.
    let linhas: unknown[][] | null = null
    let idxEsp = -1, idxExame = -1, idxObrig = -1, linhaCabecalho = 0
    for (const nomeAba of wb.SheetNames) {
        const dados = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomeAba], { header: 1, defval: "", blankrows: false })
        for (let r = 0; r < Math.min(dados.length, 10); r++) {
            const cab = (dados[r] || []).map(normalizar)
            const e = cab.indexOf("ESPECIALIDADE")
            const x = cab.indexOf("EXAME")
            if (e >= 0 && x >= 0) {
                linhas = dados
                idxEsp = e
                idxExame = x
                idxObrig = cab.findIndex((c) => c.startsWith("OBRIGATORIO"))
                linhaCabecalho = r
                break
            }
        }
        if (linhas) break
    }
    if (!linhas) throw new Error("Não encontrei as colunas \"Especialidade\" e \"Exame\". Use o modelo.")

    const porNome = new Map(especialidades.map((e) => [normalizar(e.nome), e]))
    const vistos = new Set<string>()
    const previa: LinhaPrevia[] = []

    for (let r = linhaCabecalho + 1; r < linhas.length; r++) {
        const row = linhas[r] || []
        const especialidade = String(row[idxEsp] ?? "").trim()
        const exame = String(row[idxExame] ?? "").replace(/\s+/g, " ").trim().toUpperCase()
        const obrigLido = idxObrig >= 0 ? lerObrigatorio(row[idxObrig]) : null
        if (!especialidade && !exame) continue

        const base = { linha: r + 1, especialidade, exame, obrigatorio: obrigLido === "invalido" ? null : obrigLido }
        if (!especialidade || !exame) {
            previa.push({ ...base, situacao: "erro", motivo: !especialidade ? "Especialidade vazia" : "Exame vazio" })
            continue
        }
        if (obrigLido === "invalido") {
            previa.push({ ...base, situacao: "erro", motivo: "Obrigatório deve ser Sim ou Não" })
            continue
        }
        const esp = porNome.get(normalizar(especialidade))
        if (!esp) {
            previa.push({ ...base, situacao: "erro", motivo: "Especialidade não cadastrada na unidade" })
            continue
        }
        const chave = `${esp.id}|${normalizar(exame)}`
        if (vistos.has(chave)) {
            previa.push({ ...base, situacao: "erro", motivo: "Repetido na planilha" })
            continue
        }
        vistos.add(chave)

        const existente = esp.exames.find((x) => normalizar(x.nome) === normalizar(exame))
        if (!existente) {
            previa.push({ ...base, especialidade: esp.nome, situacao: "novo", especialidadeId: esp.id })
        } else if (obrigLido !== null && !!existente.obrigatorio_checkbox !== obrigLido) {
            previa.push({ ...base, especialidade: esp.nome, situacao: "atualizar", especialidadeId: esp.id, exameId: existente.id, motivo: obrigLido ? "Passa a ser obrigatório" : "Deixa de ser obrigatório" })
        } else {
            previa.push({ ...base, especialidade: esp.nome, situacao: "existente", especialidadeId: esp.id, exameId: existente.id })
        }
    }
    return previa
}

// ---------------------------------------------------------------- componente

export default function ImportarExames({
    especialidades,
    onImportado,
}: {
    especialidades: EspecialidadeImportacao[]
    onImportado: () => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [previa, setPrevia] = useState<LinhaPrevia[] | null>(null)
    const [nomeArquivo, setNomeArquivo] = useState("")
    const [lendo, setLendo] = useState(false)
    const [gravando, setGravando] = useState(false)
    const [baixando, setBaixando] = useState(false)

    const novos = previa?.filter((l) => l.situacao === "novo") ?? []
    const atualizar = previa?.filter((l) => l.situacao === "atualizar") ?? []
    const contagem = (s: SituacaoLinha) => previa?.filter((l) => l.situacao === s).length ?? 0

    async function aoBaixarModelo() {
        setBaixando(true)
        try {
            await baixarModelo(especialidades)
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
            const linhas = await lerPlanilha(arquivo, especialidades)
            if (!linhas.length) {
                toast.error("A planilha não tem exames preenchidos")
                return
            }
            setNomeArquivo(arquivo.name)
            setPrevia(linhas)
        } catch (err) {
            console.error(err)
            toast.error(err instanceof Error ? err.message : "Não foi possível ler a planilha")
        } finally {
            setLendo(false)
        }
    }

    async function importar() {
        if (!novos.length && !atualizar.length) return
        setGravando(true)
        try {
            // Novos: entram no fim da coluna de cada especialidade.
            const proximaOrdem = new Map(
                especialidades.map((e) => [e.id, e.exames.reduce((max, x) => Math.max(max, (x.ordem ?? -1) + 1), e.exames.length)])
            )
            const inserir = novos.map((l) => {
                const ordem = proximaOrdem.get(l.especialidadeId!) ?? 0
                proximaOrdem.set(l.especialidadeId!, ordem + 1)
                return {
                    nome: l.exame,
                    especialidade_id: l.especialidadeId!,
                    obrigatorio_checkbox: l.obrigatorio ?? false,
                    ordem,
                }
            })
            if (inserir.length) {
                const { error } = await supabase.from("exames").insert(inserir)
                if (error) throw error
            }

            const resultados = await Promise.all(
                atualizar.map((l) =>
                    supabase.from("exames").update({ obrigatorio_checkbox: l.obrigatorio }).eq("id", l.exameId!)
                )
            )
            const erroAtualizacao = resultados.find((r) => r.error)?.error
            if (erroAtualizacao) throw erroAtualizacao

            toast.success(`${inserir.length} exame(s) importado(s)${atualizar.length ? `, ${atualizar.length} atualizado(s)` : ""}`)
            setPrevia(null)
            onImportado()
        } catch (err) {
            console.error(err)
            toast.error("Erro ao importar os exames")
        } finally {
            setGravando(false)
        }
    }

    return (
        <>
            <div className="flex h-9 items-center rounded-lg border border-gray-700 bg-gray-800 p-0.5">
                <button
                    type="button"
                    onClick={aoBaixarModelo}
                    disabled={baixando}
                    title="Baixar o modelo de planilha de exames"
                    className="flex h-full items-center gap-1.5 rounded-md px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                    {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Modelo
                </button>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={lendo}
                    title="Importar exames de uma planilha"
                    className="flex h-full items-center gap-1.5 rounded-md px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                    {lendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Importar
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={aoEscolherArquivo}
                />
            </div>

            <Dialog open={!!previa} onOpenChange={(aberto) => { if (!aberto && !gravando) setPrevia(null) }}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            Importar exames
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
                                    <th className="px-2 py-1.5">Especialidade</th>
                                    <th className="px-2 py-1.5">Exame</th>
                                    <th className="px-2 py-1.5">Obrigatório</th>
                                    <th className="px-2 py-1.5">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previa?.map((l) => (
                                    <tr key={l.linha} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="px-2 py-1.5 text-slate-400">{l.linha}</td>
                                        <td className="px-2 py-1.5">{l.especialidade || "—"}</td>
                                        <td className="px-2 py-1.5 font-medium">{l.exame || "—"}</td>
                                        <td className="px-2 py-1.5">{l.obrigatorio === null ? "—" : l.obrigatorio ? "Sim" : "Não"}</td>
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
                            disabled={gravando || (!novos.length && !atualizar.length)}
                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                            {gravando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Importar {novos.length + atualizar.length} exame(s)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
