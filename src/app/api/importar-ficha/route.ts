import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const dataFromForm = await req.formData();
    const file = dataFromForm.get("file") as File;

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const n8nFormData = new FormData();
    n8nFormData.append("file", file, file.name);

    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      body: n8nFormData,
      headers: {
        "x-api-key": process.env.N8N_API_KEY!,
      },
    });

    if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error("Erro n8n:", errorText);
        return NextResponse.json({ error: "n8n recusou a requisição" }, { status: n8nResponse.status });
    }

    const data = await n8nResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro na API Route:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
