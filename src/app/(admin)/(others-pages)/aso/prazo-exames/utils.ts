export const normalizarNomeExame = (valor: unknown): string => {
    if (valor === null || valor === undefined) {
        return "";
    }

    const texto = String(valor)
        // Remove caracteres invisíveis / espaços especiais
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\u00A0/g, " ")
        .trim()
        // Remove aspas externas
        .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
        // Remove pontuação no final
        .replace(/[.,;:!?]+$/g, "")
        .trim()
        // Normaliza múltiplos espaços
        .replace(/\s+/g, " ")
        .trim();

    if (!texto) {
        return "";
    }

    // Primeira letra maiúscula + restante minúsculo
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
};
