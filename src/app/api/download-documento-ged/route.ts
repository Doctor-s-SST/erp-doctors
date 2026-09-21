import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const auth = await getAuthSession();

        if (!auth.authorized) {
            return auth.response;
        }

        const body = await req.json();

        const {
            codigoGed,
            codigoEmpresa,
            codigoFuncionario,
        } = body;

        if (!codigoGed || !codigoEmpresa || !codigoFuncionario) {
            return NextResponse.json(
                {
                    error:
                        "Parâmetros incompletos (codigoGed, codigoEmpresa, codigoFuncionario são obrigatórios).",
                },
                { status: 400 }
            );
        }

        const webhookUrl =
            process.env.N8N_WEBHOOK_DOWNLOAD_GED_URL;

        if (!webhookUrl) {
            return NextResponse.json(
                {
                    error:
                        "URL do webhook n8n para download não configurada no ambiente.",
                },
                { status: 500 }
            );
        }

        // ==========================================
        // CHAMA N8N
        // ==========================================

        const n8nResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.N8N_API_KEY || "",
            },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();

            console.error(
                "Erro n8n download-documento-ged:",
                errorText
            );

            return NextResponse.json(
                {
                    error:
                        "O servidor n8n recusou a requisição de visualização.",
                },
                { status: n8nResponse.status }
            );
        }

        // ==========================================
        // N8N RETORNA JSON COM BASE64
        // ==========================================

        const contentType =
            n8nResponse.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            const data = await n8nResponse.json();

            const base64 = Array.isArray(data)
                ? data[0]?.data
                : data?.data;

            if (!base64) {
                console.error(
                    "Resposta do n8n sem conteúdo:",
                    data
                );

                return NextResponse.json(
                    {
                        error:
                            "O n8n não retornou o conteúdo do documento.",
                    },
                    { status: 500 }
                );
            }

            // ==========================================
            // CONVERTE BASE64 → PDF
            // ==========================================

            const pdfBuffer = Buffer.from(base64, "base64");

            if (!pdfBuffer.length) {
                return NextResponse.json(
                    {
                        error:
                            "O documento retornado pelo n8n está vazio.",
                    },
                    { status: 500 }
                );
            }

            // ==========================================
            // NOME DO ARQUIVO
            // ==========================================

            const nomeArquivo =
                body.nomeArquivo ||
                `documento_${codigoGed}.pdf`;

            // ==========================================
            // RETORNA PDF PARA O NAVEGADOR
            // ==========================================

            return new NextResponse(pdfBuffer, {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",

                    "Content-Disposition":
                        `inline; filename="${nomeArquivo}"`,

                    "Cache-Control": "no-store",
                },
            });
        }

        // ==========================================
        // FALLBACK:
        // CASO N8N RETORNE BINÁRIO DIRETAMENTE
        // ==========================================

        const arrayBuffer =
            await n8nResponse.arrayBuffer();

        return new NextResponse(
            Buffer.from(arrayBuffer),
            {
                status: 200,
                headers: {
                    "Content-Type":
                        contentType ||
                        "application/pdf",

                    "Content-Disposition":
                        `inline; filename="documento_${codigoGed}.pdf"`,

                    "Cache-Control": "no-store",
                },
            }
        );

    } catch (error: any) {
        console.error(
            "Erro em download-documento-ged:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error.message ||
                    "Erro interno ao processar o documento GED.",
            },
            { status: 500 }
        );
    }
}