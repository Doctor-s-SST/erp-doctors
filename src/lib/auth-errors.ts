export function mapAuthError(error: any): string {
  const msg = error?.message?.toLowerCase() || ""

  // LOGIN
  if (msg.includes("invalid login credentials")) {
    return "Email ou senha inválidos"
  }

  if (msg.includes("email not confirmed")) {
    return "Confirme seu email antes de entrar"
  }

  // CADASTRO
  if (msg.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres"
  }

  if (msg.includes("user already registered")) {
    return "Este email já está cadastrado"
  }

  if (msg.includes("invalid email")) {
    return "Email inválido"
  }

  if (msg.includes("signup is disabled")) {
    return "Cadastro desabilitado"
  }

  // RATE LIMIT
  if (msg.includes("rate limit")) {
    return "Muitas tentativas. Tente novamente em instantes"
  }

  // fallback
  return "Erro inesperado. Tente novamente"
}