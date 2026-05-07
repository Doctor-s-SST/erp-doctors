import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Permissões por rota
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/sistema-filas/kanban": ["admin", "painel"],
  "/painel-senhas": ["admin", "painel"],
  "/sistema-filas/senhas-recepcao": ["admin", "recepcao", "especialista", "painel"],
  "/sistema-filas/relatorios": ["admin", "painel", "recepcao"],
  "/sistema-filas/filas": ["admin", "especialista", "recepcao", "painel"],
  "/configuracoes/salas-profissionais": ["admin", "painel"],
  "/configuracoes/users": ["admin", "painel"],
  "/dashboards/atendimento": ["admin",]
}

// Define pra onde cada role vai
function getRedirectByRole(role?: string, especialidade_id?: string) {
  if (role === "admin") return "/sistema-filas/kanban"
  if (role === "recepcao") return "/sistema-filas/senhas-recepcao"
  if (role === "painel") return "/painel-senhas"
  if (role === "especialista") {
    return especialidade_id
      ? `/sistema-filas/filas/${especialidade_id}`
      : "/sistema-filas/filas"
  }

  return "/" // fallback seguro
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage =
    pathname.startsWith("/signin")

  // NÃO LOGADO → manda pro login
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  // LOGADO
  if (user) {
    let userRole: string | undefined
    let userEspId: string | undefined

    // Só busca profile quando realmente precisa
    const precisaProfile =
      isAuthPage ||
      pathname === "/" ||
      Object.keys(ROUTE_PERMISSIONS).some((route) =>
        pathname.startsWith(route)
      )

    if (precisaProfile) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, especialidade_id")
        .eq("id", user.id)
        .maybeSingle()

      userRole = profile?.role
      userEspId = profile?.especialidade_id
    }

    const redirectPath = getRedirectByRole(userRole, userEspId)

    // Se tentar acessar login → manda pro sistema
    if (isAuthPage) {
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    // Se entrar na raiz → manda pro lugar certo
    if (pathname === "/" && redirectPath !== "/") {
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    // Validação de permissões
    for (const route in ROUTE_PERMISSIONS) {
      if (pathname.startsWith(route)) {
        const allowedRoles = ROUTE_PERMISSIONS[route]

        if (!userRole || !allowedRoles.includes(userRole)) {
          return NextResponse.redirect(
            new URL("/signin?error=unauthorized", request.url)
          )
        }
      }
    }
  }

  return response
}