import { NextResponse } from "next/server";
import net from "net";

const ESC = 0x1B;
const GS = 0x1D;

// Definição dos comandos baseados no manual
export const commands = {
  init: Buffer.from([ESC, 0x40]), // Inicializa a impressora [4]
  center: Buffer.from([ESC, 0x61, 0x01]), // Alinhamento centralizado [5, 6]
  // Seleciona Code Page 850 (Multilingual Latin-1) para suportar acentos e "ç" [7, 8]
  codePage850: Buffer.from([ESC, 0x74, 0x02]), 
  // Tamanhos de fonte (comando GS ! n) [3, 9]
  // n = 0x11 (2x largura, 2x altura) para fonte média
  sizeMedium: Buffer.from([GS, 0x21, 0x11]),
  // n = 0x77 (8x largura, 8x altura) para tamanho máximo "vetorial"
  sizeMax: Buffer.from([GS, 0x21, 0x77]),
  sizeNormal: Buffer.from([GS, 0x21, 0x00]),
  lineFeed: Buffer.from([0x0A]), // Salto de linha [10, 11]
  cut: Buffer.from([GS, 0x56, 0x42, 0x40]), // Avanço e corte de papel [12]
};

export async function POST(req: Request) {
  try {
    const { senha, ip } = await req.json();
    if (!ip) throw new Error("IP não informado");

    // Gerar data e hora formatada
    const agora = new Date();
    const dataStr = agora.toLocaleDateString("pt-BR");
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });

    // Construção do Buffer de impressão
    const printJob = Buffer.concat([
      commands.init,
      commands.codePage850,
      commands.center,
      
      // Cabeçalho (Fonte Média)
      commands.sizeMedium,
      Buffer.from("Doctor's Saúde e Segurança no Trabalho\n\n\n", "latin1"),
      
      // Senha (Tamanho Máximo)
      commands.sizeMax,
      Buffer.from(`${senha}\n\n\n`, "latin1"),
      
      // Rodapé (Fonte Média)
      commands.sizeMedium,
      Buffer.from("Data/Hora de Chegada:\n", "latin1"),
      Buffer.from(`${dataStr} - ${horaStr}\n\n`, "latin1"),
      
      commands.sizeNormal,
      commands.lineFeed,
      commands.cut,
    ]);

    // Conexão TCP via Socket (Porta 9100 padrão)
    await new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);
      socket.connect(9100, ip, () => {
        socket.write(printJob, () => {
          socket.end();
          resolve(true);
        });
      });
      socket.on("error", (err) => { socket.destroy(); reject(err); });
      socket.on("timeout", () => { socket.destroy(); reject(new Error("Timeout")); });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}