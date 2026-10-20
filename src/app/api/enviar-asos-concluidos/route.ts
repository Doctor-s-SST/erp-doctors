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
    const jobIdSolicitado = typeof body.jobId === "string" ? body.jobId.trim() : "";

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
      body: JSON.stringify({ selecionados, jobId: jobIdSolicitado || undefined }),
    });

    const respostaTexto = await n8nResponse.text();
    let data: unknown;
    try {
      data = JSON.parse(respostaTexto);
    } catch {
      console.error("Resposta não JSON do n8n ao iniciar ação de ASO:", respostaTexto);
      if (jobIdSolicitado && [408, 502, 503, 504].includes(n8nResponse.status)) {
        return NextResponse.json(
          { status: "processing", jobId: jobIdSolicitado },
          { status: 202 }
        );
      }
      return NextResponse.json(
        { error: "O n8n não retornou um JSON válido." },
        { status: 502 }
      );
    }

    // O client ainda poderá validar um processing/done completo neste body.
    // Para respostas HTTP não exitosas, não registre auditoria como se o início
    // tivesse sido confirmado apenas pelo código de transporte.
    if (!n8nResponse.ok) {
      return NextResponse.json(data, { status: n8nResponse.status });
    }

    try {
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
    } catch (logError) {
      // O n8n já respondeu. A auditoria é uma etapa secundária e não pode
      // transformar o resultado confirmado em erro, incentivando um reenvio.
      console.error("Erro ao registrar auditoria de ASO:", logError);
    }

    return NextResponse.json(data, { status: n8nResponse.status });

  } catch (error) {
    console.error("Erro interno no backend:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
