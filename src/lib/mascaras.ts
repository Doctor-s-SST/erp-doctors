/**
 * Máscaras de campos de formulário (ficha da recepção).
 * Todas aceitam valores já formatados ou só com dígitos e devolvem o formato final.
 */

export function somenteDigitos(valor: string | null | undefined): string {
    return (valor || "").replace(/\D/g, "")
}

/** 000.000.000-00 */
export function mascararCPF(valor: string | null | undefined): string {
    return somenteDigitos(valor)
        .slice(0, 11)
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

/** 00.000.000/0000-00 */
export function mascararCNPJ(valor: string | null | undefined): string {
    return somenteDigitos(valor)
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
}

/**
 * RG: o formato muda de estado para estado. Mantém só dígitos e X (dígito
 * verificador), em maiúsculas, até 14 caracteres; com 9 caracteres usa o padrão
 * 00.000.000-0.
 */
export function mascararRG(valor: string | null | undefined): string {
    const limpo = (valor || "").toUpperCase().replace(/[^0-9X]/g, "").slice(0, 14)
    if (limpo.length === 9) return limpo.replace(/^(\d{2})(\d{3})(\d{3})([0-9X])$/, "$1.$2.$3-$4")
    return limpo
}

/** dd/mm/aaaa. Aceita também a data do banco (aaaa-mm-dd). */
export function mascararData(valor: string | null | undefined): string {
    const texto = (valor || "").trim()
    const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`

    return somenteDigitos(texto)
        .slice(0, 8)
        .replace(/^(\d{2})(\d)/, "$1/$2")
        .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3")
}

/** Data dd/mm/aaaa válida (dia existente no mês). */
export function dataValida(valor: string): boolean {
    const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) return false
    const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const data = new Date(ano, mes - 1, dia)
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia
}
