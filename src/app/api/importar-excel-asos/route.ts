import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Extrai o FormData vindo do frontend
    const incomingFormData = await req.formData();
    const file = incomingFormData.get("file") as File | null;
    const unidadeId = incomingFormData.get("unidadeId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // 2. Cria um novo FormData para enviar ao n8n
    const n8nFormData = new FormData();
    n8nFormData.append("file", file, file.name);
    n8nFormData.append("unidadeId", unidadeId || "");

    // 3. Envia para o Webhook do n8n
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_IMPORTAR_EXCEL_ASOS_URL!, {
      method: "POST",
      headers: {
        "x-api-key": process.env.N8N_API_KEY!,
        // IMPORTANTE: Não defina Content-Type aqui! O fetch fará isso automaticamente com o boundary correto.
      },
      body: n8nFormData,
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
    console.error("Erro interno:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}