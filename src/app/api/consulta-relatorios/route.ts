import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
    try {
        const auth = await getAuthSession();
        if (!auth.authorized) {
            return auth.response;
        }

        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "ID de consulta não informado." }, { status: 400 });
        }

        const res = await fetch(
            process.env.N8N_WEBHOOK_CONSULTA_RELAT_URL!,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.N8N_API_KEY!
                },
                body: JSON.stringify({ jobId: id }),
                cache: "no-store",
            }
        );

        const respostaTexto = await res.text();
        let retorno: unknown;
        try {
            retorno = JSON.parse(respostaTexto);
        } catch {
            console.error("Resposta não JSON do n8n em consulta-relatorios:", respostaTexto);
            return NextResponse.json(
                { error: "O n8n não retornou um JSON válido." },
                { status: 502 }
            );
        }

        // Preserve integralmente o contrato do n8n, inclusive quando um proxy
        // atribuir 502/504 a uma resposta que já contenha o resultado do job.
        // A validação fail-safe de status, jobId e problematicos ocorre no front.
        return NextResponse.json(retorno, { status: res.status });
    } catch (error) {
        console.error("Erro ao consultar processamento no n8n:", error);
        return NextResponse.json(
            { error: "Não foi possível consultar o processamento." },
            { status: 502 }
        );
    }
}
