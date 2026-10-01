export const FILA_SESSION_TTL_MS = 60 * 60 * 1000;

export interface FilaSession {
  sala: string;
  profissional: string;
  especialidade_id?: string;
  expiresAt: number;
}

function chaveSessaoFila(userId: string): string {
  return `fila_session_${userId}`;
}

export function salvarSessaoFila(
  userId: string,
  dados: Omit<FilaSession, "expiresAt">
): FilaSession {
  const sessao: FilaSession = {
    ...dados,
    expiresAt: Date.now() + FILA_SESSION_TTL_MS,
  };

  localStorage.setItem(chaveSessaoFila(userId), JSON.stringify(sessao));
  return sessao;
}

export function carregarSessaoFila(userId: string): FilaSession | null {
  const chave = chaveSessaoFila(userId);
  const salva = localStorage.getItem(chave);
  if (!salva) return null;

  try {
    const sessao = JSON.parse(salva) as Partial<FilaSession>;
    const valida =
      Boolean(sessao.sala) &&
      Boolean(sessao.profissional) &&
      typeof sessao.expiresAt === "number" &&
      sessao.expiresAt > Date.now();

    if (!valida) {
      localStorage.removeItem(chave);
      return null;
    }

    return sessao as FilaSession;
  } catch {
    localStorage.removeItem(chave);
    return null;
  }
}

export function limparSessaoFila(userId: string): void {
  localStorage.removeItem(chaveSessaoFila(userId));
}
