import { NextResponse } from "next/server";
import net from "net";
import iconv from "iconv-lite";

export async function POST(req: Request) {
    try {
        const { senha, tipo, ip, porta } = await req.json();

        const printerIP = ip;
        const port = porta || 9100;

        await new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.setTimeout(5000);

            client.connect(port, printerIP, () => {
                const b_ESC = Buffer.from([0x1B]);
                const b_GS = Buffer.from([0x1D]);
                const selectCodePage850 = Buffer.from([0x1B, 0x74, 0x03]);

                // Formatação de Data e Hora
                const agora = new Date();
                const dataHora = agora.toLocaleDateString('pt-BR') + " - " + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // Buffers de Texto com Codificação
                const cabecalho = iconv.encode("Doctor's Saúde e Segurança no Trabalho\n\n\n", 'cp850');
                // const labelSenha = iconv.encode(`\nSENHA ${tipo}\n`, 'cp850');
                const codigoSenha = iconv.encode(`${senha}\n\n\n`, 'cp850');
                const footer = iconv.encode(`Data/Hora de Chegada:\n${dataHora}\n\n`, 'cp850');

                const commands = Buffer.concat([
                    b_ESC, Buffer.from("@"),
                    selectCodePage850,

                    // CENTRALIZAR
                    b_ESC, Buffer.from("a"), Buffer.from([0x01]),

                    // HEADER
                    b_ESC, Buffer.from("!"), Buffer.from([0x00]),
                    b_ESC, Buffer.from("E"), Buffer.from([0x00]),
                    cabecalho,

                    // NEGRITO + GRANDE
                    b_ESC, Buffer.from("E"), Buffer.from([0x01]),
                    b_GS, Buffer.from("!"), Buffer.from([0x77]),

                    codigoSenha,

                    // RESET
                    b_ESC, Buffer.from("!"), Buffer.from([0x00]),
                    b_ESC, Buffer.from("E"), Buffer.from([0x00]),

                    footer,

                    // CORTE
                    b_GS, Buffer.from("V"), Buffer.from([0x41]), Buffer.from([0x03])
                ]);

                client.write(commands, () => {
                    client.end();
                    resolve(true);
                });
            });

            client.on("error", (err) => { client.destroy(); reject(err); });
            client.on("timeout", () => { client.destroy(); reject(new Error("Timeout")); });
        });

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}