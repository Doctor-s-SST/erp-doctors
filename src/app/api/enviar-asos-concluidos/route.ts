import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";
import { createClient } from "@/lib/server-supabase";

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

    const supabase = await createClient();
    const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const logs = selecionados.map((item) => {
      const pacienteId = String(item.paciente?.id || "");

      return {
        paciente_assinatura_id: uuidValido.test(pacienteId) ? pacienteId : null,
        unidade_id: auth.unidadeId,
        nome_paciente: item.paciente?.nome_paciente || null,
        sequencial_ficha: item.paciente?.sequencial_ficha || null,
        acao: item.acao,
        observacao: item.observacao || null,
        usuario_id: auth.user.id,
        usuario_email: auth.user.email || null,
      };
    });

    const { error: logError } = await supabase
      .from("pacientes_assinatura_logs")
      .insert(logs);

    if (logError) {
      // O envio ao n8n já ocorreu; não devolva erro para evitar reenvio duplicado.
      console.error("Erro ao registrar auditoria de ASO:", logError);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro interno no backend:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
