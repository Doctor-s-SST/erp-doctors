import { createClient } from "@/lib/server-supabase"
import { redirect } from "next/navigation"
import AdminLayoutClient from "./AdminLayoutClient"
import { Metadata } from "next";
import Providers from "@/components/providers";

export const metadata: Metadata = {
  title:
    "Doctor's | Sistema de Gestão Integrada",
  description: "Sistema de Gestão Integrada para Doctor's Saúde e Segurança do Trabalho",
};


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

  return <AdminLayoutClient>
    <Providers>
      {children}
    </Providers>
  </AdminLayoutClient>
}