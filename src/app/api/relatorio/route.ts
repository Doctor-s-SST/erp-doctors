import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const dataFromForm = await req.formData();
    
    // Extraímos os filtros do formulário
    const dataInicio = dataFromForm.get("dataInicio") as string;
    const dataFim = dataFromForm.get("dataFim") as string;
    const unidadeId = dataFromForm.get("unidadeId") as string;

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: "Datas não fornecidas" }, { status: 400 });
    }

    // Criamos o FormData no padrão que você usa para a API Externa
    const n8nFormData = new FormData();
    n8nFormData.append("dataInicio", dataInicio);
    n8nFormData.append("dataFim", dataFim);
    n8nFormData.append("unidadeId", unidadeId || "");

    // Chamada para o Webhook do n8n
    const n8nResponse = await fetch(process.env.N8N_WEBHOOK_RELATORIO_ATENDIMENTOS_URL!, {
      method: "POST",
      body: n8nFormData,
      headers: {
        // O FormData define o Content-Type automaticamente com o boundary
        "x-api-key": process.env.N8N_API_KEY!,
      },
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("Erro n8n:", errorText);
      return NextResponse.json({ error: "n8n recusou a requisição" }, { status: n8nResponse.status });
    }

    // Retorna a resposta do n8n (pode ser o JSON dos dados ou link do PDF)
    const data = await n8nResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro na API Route:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}