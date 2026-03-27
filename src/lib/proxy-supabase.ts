import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Defina o mapa de permissões aqui
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/sistema-filas/kanban": ["admin"],
  "/sistema-filas/users": ["admin"],
  "/sistema-filas/senhas-recepcao": ["admin", "recepcao", "especialista"],
  "/sistema-filas/filas": ["admin", "especialista", "recepcao"],
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

  // Obtém o usuário do Auth
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith("/signin") || pathname.startsWith("/signup")

  // NÃO LOGADO → manda pro login
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  // LOGADO → verificações de Role e Redirecionamento
  if (user) {
    if (isAuthPage) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    // Buscar o role do banco de dados (tabela profiles)
    // Usamos .maybeSingle() para evitar erros se o profile não existir ainda
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, especialidade_id')
      .eq('id', user.id)
      .maybeSingle();

    const userRole = profile?.role || "user";
    const userEspId = profile?.especialidade_id;

    // Verificar se a rota atual está protegida
    for (const route in ROUTE_PERMISSIONS) {
      if (pathname.startsWith(route)) {
        const allowedRoles = ROUTE_PERMISSIONS[route];

        // Bloqueia se o role não estiver na lista
        if (!allowedRoles.includes(userRole)) {
          return NextResponse.redirect(new URL("/signin?error=unauthorized", request.url));
        }

        // LÓGICA EXTRA: Se for especialista tentando acessar outra fila que não a dele
        // Descomente abaixo se quiser travar o especialista APENAS na fila dele:
        /*
        if (userRole === 'especialista' && pathname.startsWith("/sistema-filas/filas/")) {
           const requestedQueueId = pathname.split("/").pop();
           if (userEspId && requestedQueueId !== userEspId) {
             return NextResponse.redirect(new URL(`/sistema-filas/filas/${userEspId}`, request.url));
           }
        }
        */
      }
    }
  }

  return response
}