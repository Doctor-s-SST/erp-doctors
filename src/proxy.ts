import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/proxy-supabase"

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}