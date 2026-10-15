import type { SenhasProfile } from "./types";

export function validarAlteracaoSenha(senhas: SenhasProfile): string | null {
    if (!senhas.nova) return "Informe a nova senha";
    if (senhas.nova.length < 6) return "A senha deve possuir pelo menos 6 caracteres";
    if (senhas.nova !== senhas.confirmacao) return "As senhas não coincidem";
    return null;
}

export function mensagemErroProfile(error: unknown): string {
    return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
