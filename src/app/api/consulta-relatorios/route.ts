import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

    const id =
        req.nextUrl.searchParams.get("id");

    const res = await fetch(
        process.env.N8N_WEBHOOK_CONSULTA_RELAT_URL!,
        {
            method:"POST",
            headers:{
                "Content-Type":"application/json",
                "x-api-key":process.env.N8N_API_KEY!
            },
            body:JSON.stringify({
                jobId:id
            })
        }
    );

    return NextResponse.json(
        await res.json()
    );

}