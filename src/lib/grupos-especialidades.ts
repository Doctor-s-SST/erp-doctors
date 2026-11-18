/**
 * Regra única dos grupos de especialidades.
 *
 * Usada pela fila do especialista, pelo relatório geral e pelo dashboard,
 * para que o mesmo atendimento caia no mesmo grupo em todas as telas.
 * As especialidades do atendimento vêm de `atendimento_exames.sala`
 * (nome da especialidade), considerando todos os exames, em qualquer status.
 */

export type TipoFiltroGrupo =
    | "todos"
    | "algum"
    | "obrigatorio_mais_algum"
    | "apenas_do_grupo";

export interface ItemGrupoRegra {
    especialidade_id?: string;
    obrigatoria?: boolean | null;
    excludente?: boolean | null;
    especialidades?: { id?: string; nome: string } | null;
}

export interface GrupoRegra {
    id: string;
    nome: string;
    tipo_filtro: TipoFiltroGrupo | string | null;
    exibir_fila?: boolean | null;
    exibir_dashboard?: boolean | null;
    especialidade_fila_id?: string | null;
    grupo_especialidade_itens?: ItemGrupoRegra[] | null;
}

export function normalizarEspecialidade(texto: string | null | undefined): string {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();
}

/**
 * Indica se um atendimento pertence ao grupo.
 * `especialidadesAtendimento` deve vir normalizada com `normalizarEspecialidade`.
 */
export function atendimentoPertenceAoGrupo(
    grupo: GrupoRegra,
    especialidadesAtendimento: string[]
): boolean {
    const itensGrupo = (grupo.grupo_especialidade_itens || []).filter(
        (item) => item.especialidades?.nome
    );
    const nomeItem = (item: ItemGrupoRegra) => normalizarEspecialidade(item.especialidades?.nome);

    const especialidadesExcludentes = itensGrupo
        .filter((item) => item.excludente === true)
        .map(nomeItem);
    const especialidadesGrupo = itensGrupo
        .filter((item) => item.excludente !== true)
        .map(nomeItem);

    if (especialidadesExcludentes.some((esp) => especialidadesAtendimento.includes(esp))) {
        return false;
    }

    // TODAS as especialidades do grupo (comparação exata)
    if (grupo.tipo_filtro === "todos") {
        const grupoOrdenado = [...especialidadesGrupo].sort();
        const atendimentoOrdenado = [...especialidadesAtendimento].sort();

        return (
            grupoOrdenado.length === atendimentoOrdenado.length &&
            grupoOrdenado.every((esp, idx) => esp === atendimentoOrdenado[idx])
        );
    }

    // PELO MENOS UMA especialidade do grupo
    if (grupo.tipo_filtro === "algum") {
        return especialidadesGrupo.some((esp) => especialidadesAtendimento.includes(esp));
    }

    // APENAS especialidades do grupo (qualquer combinação entre elas, sem nada além)
    if (grupo.tipo_filtro === "apenas_do_grupo") {
        return (
            especialidadesAtendimento.length > 0 &&
            especialidadesAtendimento.every((esp) => especialidadesGrupo.includes(esp))
        );
    }

    // OBRIGATÓRIA(S) + PELO MENOS UMA ADICIONAL
    if (grupo.tipo_filtro === "obrigatorio_mais_algum") {
        const obrigatorias = itensGrupo
            .filter((i) => i.obrigatoria === true && i.excludente !== true)
            .map(nomeItem);

        const adicionais = itensGrupo
            .filter((i) => i.obrigatoria !== true && i.excludente !== true)
            .map(nomeItem);

        const permitidas = new Set([...obrigatorias, ...adicionais]);

        // Só entram na checagem de "fora do grupo" as especialidades que o
        // PRÓPRIO grupo referencia. Especialidades que o grupo nem menciona
        // não bloqueiam o match.
        const especialidadesRelevantes = especialidadesAtendimento.filter((esp) =>
            especialidadesGrupo.includes(esp)
        );

        const todasObrigatoriasPresentes = obrigatorias.every((o) =>
            especialidadesAtendimento.includes(o)
        );

        const possuiPeloMenosUmaAdicional = especialidadesAtendimento.some((esp) =>
            adicionais.includes(esp)
        );

        const nenhumaForaDoGrupo = especialidadesRelevantes.every((esp) => permitidas.has(esp));

        return todasObrigatoriasPresentes && possuiPeloMenosUmaAdicional && nenhumaForaDoGrupo;
    }

    return true;
}

/**
 * Grupos que aparecem no seletor da fila de uma especialidade:
 * - ativos e com `exibir_fila` diferente de false;
 * - com `especialidade_fila_id` preenchida: só na fila dessa especialidade;
 * - sem `especialidade_fila_id`: em toda fila de especialidade que o grupo contém.
 */
export function gruposVisiveisNaFila<T extends GrupoRegra>(grupos: T[], especialidadeId: string): T[] {
    return grupos.filter((grupo) => {
        if (grupo.exibir_fila === false) return false;

        if (grupo.especialidade_fila_id) {
            return grupo.especialidade_fila_id === especialidadeId;
        }

        return (grupo.grupo_especialidade_itens || []).some(
            (item) => item.especialidade_id === especialidadeId
        );
    });
}
