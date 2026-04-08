// import { NextResponse } from "next/server";
// import net from "net";
// import iconv from "iconv-lite";
// import { buildPrint } from "@/lib/impressora/print-engine";
// import { senhaTemplate } from "@/lib/impressora/templates/senha-recep";


// export async function POST(req: Request) {
//     try {
//         const { senha, tipo, ip, porta } = await req.json();

//         const printerIP = ip;
//         const port = porta || 9100;

//         await new Promise((resolve, reject) => {
//             const client = new net.Socket();
//             client.setTimeout(5000);

//             client.connect(port, printerIP, () => {
//                 const b_ESC = Buffer.from([0x1B]);
//                 const b_GS = Buffer.from([0x1D]);
//                 const selectCodePage850 = Buffer.from([0x1B, 0x74, 0x03]);

//                 // Formatação de Data e Hora
//                 const agora = new Date();
//                 const dataHora = agora.toLocaleDateString('pt-BR') + " - " + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

//                 // Buffers de Texto com Codificação
//                 const cabecalho = iconv.encode("Doctor's Saúde e Segurança no Trabalho\n\n\n", 'cp850');
//                 // const labelSenha = iconv.encode(`\nSENHA ${tipo}\n`, 'cp850');
//                 const codigoSenha = iconv.encode(`${senha}\n\n\n`, 'cp850');
//                 const footer = iconv.encode(`Data/Hora de Chegada:\n${dataHora}\n\n`, 'cp850');

//                 const commands = Buffer.concat([
//                     b_ESC, Buffer.from("@"),
//                     selectCodePage850,

//                     // CENTRALIZAR
//                     b_ESC, Buffer.from("a"), Buffer.from([0x01]),

//                     // HEADER
//                     b_ESC, Buffer.from("!"), Buffer.from([0x00]),
//                     b_ESC, Buffer.from("E"), Buffer.from([0x00]),
//                     cabecalho,

//                     // NEGRITO + GRANDE
//                     b_ESC, Buffer.from("E"), Buffer.from([0x01]),
//                     b_GS, Buffer.from("!"), Buffer.from([0x77]),

//                     codigoSenha,

//                     // RESET
//                     b_ESC, Buffer.from("!"), Buffer.from([0x00]),
//                     b_ESC, Buffer.from("E"), Buffer.from([0x00]),

//                     footer,

//                     // CORTE
//                     b_GS, Buffer.from("V"), Buffer.from([0x41]), Buffer.from([0x03])
//                 ]);

//                 client.write(commands, () => {
//                     client.end();
//                     resolve(true);
//                 });
//             });

//             client.on("error", (err) => { client.destroy(); reject(err); });
//             client.on("timeout", () => { client.destroy(); reject(new Error("Timeout")); });
//         });

//         return NextResponse.json({ ok: true });
//     } catch (err: any) {
//         return NextResponse.json({ error: err.message }, { status: 500 });
//     }
// }

import { NextResponse } from "next/server";
import {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} from "node-thermal-printer";

export async function POST(req: Request) {
  try {
    const { senha, ip, porta } = await req.json();

    if (!senha || !ip) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON, // Bematech funciona como Epson
      interface: `tcp://${ip}:${porta || 9100}`,
      characterSet: CharacterSet.PC850_MULTILINGUAL,
      breakLine: BreakLine.WORD,
      options: {
        timeout: 5000,
      },
    });

    const isConnected = await printer.isPrinterConnected();

    if (!isConnected) {
      throw new Error("Impressora não conectada");
    }

    // 🔥 RESET
    printer.clear();

    // ========================
    // CABEÇALHO
    // ========================
    printer.alignCenter();
    printer.setTextNormal();
    printer.bold(true);
    printer.println("DOCTOR'S SAÚDE E SEGURANÇA");

    printer.newLine();

    // ========================
    // TIPO SENHA
    // // ========================
    // printer.setTextDoubleHeight();
    // printer.bold(true);
    // printer.println(`SENHA ${tipo}`);

    printer.newLine();

    // ========================
    // 🔥 SENHA GIGANTE (AQUI É O SEGREDO)
    // ========================
    printer.setTextQuadArea(); 
    // 👆 MUITO melhor que double

    // alternativa ainda maior:
    // printer.setTextSize(7, 7);

    printer.bold(true);
    printer.println(senha);

    printer.newLine();

    // ========================
    // INFO
    // ========================
    printer.setTextNormal();
    printer.bold(false);

    // printer.println(`Guichê: ${guiche}`);

    const agora = new Date();
    const dataHora =
      agora.toLocaleDateString("pt-BR") +
      " " +
      agora.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

    printer.println(dataHora);

    printer.newLine();

    // ========================
    // LINHA + CORTE
    // ========================
    printer.drawLine();

    printer.newLine();

    printer.cut();

    // 🔥 EXECUTA
    await printer.execute();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}