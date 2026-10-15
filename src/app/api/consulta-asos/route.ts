import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";

export async function GET() {
  try {
    const auth = await getAuthSession();

    if (!auth.authorized) {
      return auth.response;
    }

    const n8nResponse = await fetch(
      process.env.N8N_WEBHOOK_CONSULTA_ASOS_URL!,
      {
        method: "GET",
        headers: {
          "x-api-key": process.env.N8N_API_KEY!,
        },
        cache: "no-store",
      }
    );

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();

      console.error("Erro n8n:", errorText);

      return NextResponse.json(
        {
          error: "Não foi possível consultar os dados da importação."
        },
        { status: n8nResponse.status }
      );
    }

    const data = await n8nResponse.json();

    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro interno:", error);

    return NextResponse.json(
      {
        error: "Erro interno no servidor."
      },
      { status: 500 }
    );
  }
}
