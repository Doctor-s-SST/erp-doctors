import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { selecionados } = body;

    if (!selecionados || !Array.isArray(selecionados) || selecionados.length === 0) {
      return NextResponse.json(
        { error: "Nenhum funcionário selecionado enviado." },
        { status: 400 }
      );
    }

    const payloadValido = selecionados.every(
      (item) => item?.paciente && typeof item?.acao === "string"
    );

    if (!payloadValido) {
      return NextResponse.json(
        { error: "Formato inválido. Cada item deve conter paciente e ação." },
        { status: 400 }
      );
    }

    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_ENVIAR_ASOS_CONCLUIDOS_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.N8N_API_KEY!,
      },
      body: JSON.stringify({ selecionados }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("Erro n8n:", errorText);
      return NextResponse.json(
        { error: "n8n recusou a requisição" },
        { status: n8nResponse.status }
      );
    }

    const data = await n8nResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro interno no backend:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
