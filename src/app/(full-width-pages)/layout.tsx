import { Toaster } from "sonner";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Doctor's | Sistema de Gestão Integrada",
  description: "Sistema de Gestão Integrada para Doctor's Saúde e Segurança do Trabalho",
};


export default function FullWidthPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}
    <Toaster richColors position="top-right" /></div>;
}
