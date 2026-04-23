"use client";

import React, { useState } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimirDeclaracao({ item }: { item: any }) {
  const [loading, setLoading] = useState(false);

  async function gerarPDF() {
    try {
      setLoading(true);

      const res = await fetch("/api/gerar-declaracao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      window.open(url);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      onClick={gerarPDF}
      disabled={loading}
      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 py-4 disabled:opacity-70"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}

      <div className="hidden sm:flex flex-col text-[12px] font-bold">
        <span>{loading ? "Gerando..." : "Declaração"}</span>
      </div>
    </Button>
  );
}