import { createClient } from "@/lib/server-supabase"
import { redirect } from "next/navigation"
import AdminLayoutClient from "./AdminLayoutClient"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/signin")
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}