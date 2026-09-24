import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Permissões por rota
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/sistema-filas/kanban": ["admin"],
  "/painel-senhas": ["admin", "painel"],
  "/sistema-filas/senhas-recepcao": ["admin", "recepcao", "especialista", "painel"],
  "/sistema-filas/relatorios/": ["admin", "painel", "recepcao", "operador", "especialista"],
  "/aso/": ["admin", "operador", "especialista", "recepcao"],
  // "/aso/": ["admin", "painel", "recepcao", "operador",],
  "/sistema-filas/filas": ["admin", "especialista", "recepcao", "painel"],
  "/configuracoes/unidade": ["admin"],
  "/configuracoes/users": ["admin"],
  "/configuracoes/salas-profissionais": ["admin"],
  "/configuracoes/grupos-especialidades": ["admin", "operador"],
  "/dashboards/": ["admin",],
  "/sistema-filas/analise-dados": ["admin", "especialista", "recepcao", "operador"],
}

// Define pra onde cada role vai
function getRedirectByRole(role?: string, especialidade_id?: string) {
  if (role === "admin") return "/dashboards/atendimento"
  if (role === "recepcao") return "/sistema-filas/senhas-recepcao"
  if (role === "painel") return "/painel-senhas"
  if (role === "operador") return "/aso/aso-pendente"
  if (role === "especialista") {
    return especialidade_id
      ? `/sistema-filas/filas/${especialidade_id}`
      : "/sistema-filas/filas"
  }

  return "/"
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next()

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
        .select("role, especialidade_id, ativo")
        .eq("id", user.id)
        .maybeSingle()

      userRole = profile?.role
      userEspId = profile?.especialidade_id

      if (profile && profile.ativo === false) {
        const redirect = NextResponse.redirect(
          new URL("/signin?error=inactive", request.url)
        );

        redirect.cookies.delete("sb-access-token");
        redirect.cookies.delete("sb-refresh-token");

        return redirect;
      }
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
