import type { ProfissionalConfiguracao, UsuarioConfiguracao } from "./types";

export const ROLE_COLORS: Record<string, { bg: string; light: string; text: string; border?: string }> = {
    admin: { bg: "bg-blue-500", light: "bg-blue-500/10", text: "text-blue-500", border: "hover:border-blue-500/30" },
    recepcao: { bg: "bg-orange-500", light: "bg-orange-500/10", text: "text-orange-500", border: "hover:border-orange-500/30" },
    especialista: { bg: "bg-emerald-500", light: "bg-emerald-500/10", text: "text-emerald-500", border: "hover:border-emerald-500/30" },
    painel: { bg: "bg-yellow-500", light: "bg-yellow-500/10", text: "text-yellow-500", border: "hover:border-yellow-500/30" },
    operador: { bg: "bg-red-500", light: "bg-red-500/10", text: "text-red-500", border: "hover:border-red-500/30" },
    all: { bg: "bg-gray-900", light: "bg-slate-100", text: "text-slate-600" },
};

const ROLE_ORDER: Record<string, number> = {
    admin: 1,
    recepcao: 2,
    especialista: 3,
    operador: 4,
    painel: 5,
};

export function ordenarUsuarios(usuarios: UsuarioConfiguracao[]): UsuarioConfiguracao[] {
    return [...usuarios].sort((a, b) => {
        const pesoA = ROLE_ORDER[a.role || ""] || 4;
        const pesoB = ROLE_ORDER[b.role || ""] || 4;
        return pesoA !== pesoB ? pesoA - pesoB : a.full_name.localeCompare(b.full_name);
    });
}

export function filtrarUsuarios(
    usuarios: UsuarioConfiguracao[],
    busca: string,
    role: string,
    status: string,
): UsuarioConfiguracao[] {
    const termo = busca.toLowerCase();
    return usuarios.filter(usuario => {
        const atendeBusca = usuario.full_name.toLowerCase().includes(termo)
            || (usuario.email || "").toLowerCase().includes(termo);
        const atendeRole = role === "all" || usuario.role === role;
        const atendeStatus = status === "todos" || (status === "ativos" ? usuario.ativo : !usuario.ativo);
        return atendeBusca && atendeRole && atendeStatus;
    });
}

export function filtrarProfissionais(
    profissionais: ProfissionalConfiguracao[],
    filtros: { status: "ativos" | "todos"; busca: string; especialidade: string; jornada: string },
): ProfissionalConfiguracao[] {
    const termo = filtros.busca.toLowerCase();
    return profissionais.filter(profissional => {
        if (filtros.status === "ativos" && !profissional.ativo) return false;
        if (termo && !profissional.nome.toLowerCase().includes(termo)) return false;
        if (filtros.especialidade !== "todas"
            && !profissional.profissional_especialidades?.some(item => item.especialidade_id === filtros.especialidade)) return false;
        if (filtros.jornada === "sem-jornada" && profissional.hora_inicio && profissional.hora_fim) return false;
        if (filtros.jornada === "com-jornada" && (!profissional.hora_inicio || !profissional.hora_fim)) return false;
        return true;
    });
}

export function mensagemErroConfiguracao(error: unknown): string {
    return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
