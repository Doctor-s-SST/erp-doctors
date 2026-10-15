const TAMANHO_MAXIMO_LOGO = 2 * 1024 * 1024;
const TIPOS_LOGO_PERMITIDOS = ["image/png", "image/jpeg", "image/svg+xml"];

export function validarArquivoLogo(file: File): void {
    if (file.size > TAMANHO_MAXIMO_LOGO) throw new Error("Arquivo muito grande. Máximo permitido: 2MB.");
    if (!TIPOS_LOGO_PERMITIDOS.includes(file.type)) throw new Error("Formato inválido. Utilize PNG, JPG ou SVG.");
}

export function somenteNumeros(valor: string): string {
    return valor.replace(/\D/g, "");
}

export function formatarCNPJ(value: string): string {
    return somenteNumeros(value)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2")
        .slice(0, 18);
}

export function formatarCEP(value: string): string {
    return somenteNumeros(value).replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
}
