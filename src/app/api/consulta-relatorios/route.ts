import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
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
            body: JSON.stringify({
                jobId: id
            })
        }
    );

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro n8n consulta-relatorios:", errorText);
        return NextResponse.json(
            { error: "n8n recusou a requisição" },
            { status: res.status }
        );
    }

    return NextResponse.json(
        await res.json()
    );
}