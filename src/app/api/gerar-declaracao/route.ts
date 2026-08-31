import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production" || !!process.env.NETLIFY;

export async function POST(req: Request) {
  try {
    const { item, unidade } = await req.json()

    const nomePaciente =
      item.cabecalho?.nome || "________________________________________";
    const dataAtendimento =
      item.cabecalho?.acionamento?.split(" ")[0] || "//________";
    const horarioEntrada =
      item.cabecalho?.acionamento?.split(" ")[1] || "______";
    const horarioSaida =
      item.cabecalho?.horario_saida?.split(" ")[1] || "______";
    const cpf = item.cabecalho?.cpf || "________________________";

    const cnpj = unidade.cnpj || "________________________";
    const razao_social = unidade.razao_social.toUpperCase() || "______________________________"
    const cidade = unidade.cidade || "______________________________"

    const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0;
            font-size: 12px;
            font-family: Calibri, sans-serif;
            -webkit-print-color-adjust: exact;
          }

          .container {
            width: 210mm;
            height: 297mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          header img {
            width: 100%;
            opacity: 0.7;
          }

          main {
            flex: 1;
            padding: 0 80px;
            padding-top: 40px;
            text-align: justify;
            color: #333;
          }

          h1 {
            text-align: center;
            margin-bottom: 60px;
            letter-spacing: 1px;
          }

          .content p {
            margin-bottom: 16px;
            font-size: 14px;
          }

          .assinatura {
            margin-top: 80px;
            text-align: center;
          }

          .linha {
            width: 300px;
            border-top: 1px solid #999;
            margin: 0 auto 8px auto;
          }

          footer {
            background: #007fc5;
            color: white;
            padding: 24px;
            font-size: 10px;
            font-weight: bold;
            border-top: 4px solid #ff7f00;
            opacity: 0.7;
          }

          .footer-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .footer-col {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .footer-right {
            border-left: 1px solid #555;
            padding-left: 12px;
          }

          .row {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          svg {
            width: 12px;
            height: 12px;
            fill: #ffd54f;
          }

          .social svg {
            fill: #007fc5;
            background: #ffd54f;
            border-radius: 50%;
            padding: 2px;
          }
        </style>
      </head>

      <body>
        <div class="container">
          
          <!-- HEADER -->
          <header>
            <img src="https://erp.doctorspraiagrande.com.br/images/timbrado/cropped-cropped-cropped-teste-timbrado-cabecalho.svg" />
          </header>

          <!-- MAIN -->
          <main>
              <br />
              <br />

            <h1>DECLARAÇÃO DE COMPARECIMENTO</h1>

            <div class="content">
              <p>
                A empresa <b>${razao_social}</b>, inscrita no CNPJ n° ${cnpj}, declara para os devidos fins que o(a)
                Sr.(a) <strong>${nomePaciente.toUpperCase()}</strong>, portador(a) do CPF n° ${cpf},
                compareceu a nossa unidade no dia <strong>${dataAtendimento}</strong>,
                no horário das <strong>${horarioEntrada}</strong> às <strong>${horarioSaida}</strong> para a realização de exames ocupacionais.
              </p>

              <p>
                Declara ainda que o(a) referido(a) paciente esteve em atendimento nesta unidade durante o período acima informado.
              </p>
              <br />
              <br />
              <p style="text-align: center;">Por ser verdade, firma a presente declaração.</p>
              
              <div style="margin-top: 60px; text-align: center; font-size: 11px;">
              <div style="margin-bottom: 60px; font-size: 14px;">
                ${cidade}, ${new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })}.
              </div>
              <br />
              <br />
              <br />

              Documento emitido eletronicamente<br />
              ${razao_social}<br />
              CNPJ: ${cnpj} | Cidade: ${cidade}<br />
              ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </div>
            </div>
          </main>

          <!-- FOOTER -->
          <footer>
            <div class="footer-grid">
              
              <div class="footer-col">
                <div class="row">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-telephone" viewBox="0 0 16 16"> <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.678.678 0 0 0 .178.643l2.457 2.457a.678.678 0 0 0 .644.178l2.189-.547a1.745 1.745 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.634 18.634 0 0 1-7.01-4.42 18.634 18.634 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877L1.885.511z"/> </svg> 13 <strong>3499.1010</strong>
                </div>
                <div class="row">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="104" r="32" fill="none" stroke="#ffd54f" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/><path d="M208,104c0,72-80,128-80,128S48,176,48,104a80,80,0,0,1,160,0Z" fill="none" stroke="#ffd54f" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/></svg> PRAIA GRANDE/SP: Av. São Paulo, 707 - Guilhermina
                </div>
                <div class="row">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="104" r="32" fill="none" stroke="#ffd54f" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/><path d="M208,104c0,72-80,128-80,128S48,176,48,104a80,80,0,0,1,160,0Z" fill="none" stroke="#ffd54f" stroke-linecap="round" stroke-linejoin="round" stroke-width="10"/></svg> ITANHAÉM/SP: Av. Condessa de Vimieiros, 587 - Centro
                </div>
              </div>

              <div class="footer-col footer-right">
                <div class="row social">
                  <!-- LinkedIn -->
                  <svg
                  className="fill-current"
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5.78381 4.16645C5.78351 4.84504 5.37181 5.45569 4.74286 5.71045C4.11391 5.96521 3.39331 5.81321 2.92083 5.32613C2.44836 4.83904 2.31837 4.11413 2.59216 3.49323C2.86596 2.87233 3.48886 2.47942 4.16715 2.49978C5.06804 2.52682 5.78422 3.26515 5.78381 4.16645ZM5.83381 7.06645H2.50048V17.4998H5.83381V7.06645ZM11.1005 7.06645H7.78381V17.4998H11.0672V12.0248C11.0672 8.97475 15.0422 8.69142 15.0422 12.0248V17.4998H18.3338V10.8914C18.3338 5.74978 12.4505 5.94145 11.0672 8.46642L11.1005 7.06645Z"
                    fill=""
                  />
                </svg>

                  <!-- Instagram -->
                 <svg
                  className="fill-current"
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10.8567 1.66699C11.7946 1.66854 12.2698 1.67351 12.6805 1.68573L12.8422 1.69102C13.0291 1.69766 13.2134 1.70599 13.4357 1.71641C14.3224 1.75738 14.9273 1.89766 15.4586 2.10391C16.0078 2.31572 16.4717 2.60183 16.9349 3.06503C17.3974 3.52822 17.6836 3.99349 17.8961 4.54141C18.1016 5.07197 18.2419 5.67753 18.2836 6.56433C18.2935 6.78655 18.3015 6.97088 18.3081 7.15775L18.3133 7.31949C18.3255 7.73011 18.3311 8.20543 18.3328 9.1433L18.3335 9.76463C18.3336 9.84055 18.3336 9.91888 18.3336 9.99972L18.3335 10.2348L18.333 10.8562C18.3314 11.794 18.3265 12.2694 18.3142 12.68L18.3089 12.8417C18.3023 13.0286 18.294 13.213 18.2836 13.4351C18.2426 14.322 18.1016 14.9268 17.8961 15.458C17.6842 16.0074 17.3974 16.4713 16.9349 16.9345C16.4717 17.397 16.0057 17.6831 15.4586 17.8955C14.9273 18.1011 14.3224 18.2414 13.4357 18.2831C13.2134 18.293 13.0291 18.3011 12.8422 18.3076L12.6805 18.3128C12.2698 18.3251 11.7946 18.3306 10.8567 18.3324L10.2353 18.333C10.1594 18.333 10.0811 18.333 10.0002 18.333H9.76516L9.14375 18.3325C8.20591 18.331 7.7306 18.326 7.31997 18.3137L7.15824 18.3085C6.97136 18.3018 6.78703 18.2935 6.56481 18.2831C5.67801 18.2421 5.07384 18.1011 4.5419 17.8955C3.99328 17.6838 3.5287 17.397 3.06551 16.9345C2.60231 16.4713 2.3169 16.0053 2.1044 15.458C1.89815 14.9268 1.75856 14.322 1.7169 13.4351C1.707 13.213 1.69892 13.0286 1.69238 12.8417L1.68714 12.68C1.67495 12.2694 1.66939 11.794 1.66759 10.8562L1.66748 9.1433C1.66903 8.20543 1.67399 7.73011 1.68621 7.31949L1.69151 7.15775C1.69815 6.97088 1.70648 6.78655 1.7169 6.56433C1.75786 5.67683 1.89815 5.07266 2.1044 4.54141C2.3162 3.9928 2.60231 3.52822 3.06551 3.06503C3.5287 2.60183 3.99398 2.31641 4.5419 2.10391C5.07315 1.89766 5.67731 1.75808 6.56481 1.71641C6.78703 1.70652 6.97136 1.69844 7.15824 1.6919L7.31997 1.68666C7.7306 1.67446 8.20591 1.6689 9.14375 1.6671L10.8567 1.66699ZM10.0002 5.83308C7.69781 5.83308 5.83356 7.69935 5.83356 9.99972C5.83356 12.3021 7.69984 14.1664 10.0002 14.1664C12.3027 14.1664 14.1669 12.3001 14.1669 9.99972C14.1669 7.69732 12.3006 5.83308 10.0002 5.83308ZM10.0002 7.49974C11.381 7.49974 12.5002 8.61863 12.5002 9.99972C12.5002 11.3805 11.3813 12.4997 10.0002 12.4997C8.6195 12.4997 7.50023 11.3809 7.50023 9.99972C7.50023 8.61897 8.61908 7.49974 10.0002 7.49974ZM14.3752 4.58308C13.8008 4.58308 13.3336 5.04967 13.3336 5.62403C13.3336 6.19841 13.8002 6.66572 14.3752 6.66572C14.9496 6.66572 15.4169 6.19913 15.4169 5.62403C15.4169 5.04967 14.9488 4.58236 14.3752 4.58308Z"
                    fill=""
                  />
                </svg>

                  <!-- Facebook -->
                   <svg
                  className="fill-current"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z" />
                </svg>

                  <span>/doctorspraiagrande</span>
                </div>

                <div class="row">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M352 256c0 22.2-1.2 43.6-3.3 64H163.3c-2.2-20.4-3.3-41.8-3.3-64s1.2-43.6 3.3-64H348.7c2.2 20.4 3.3 41.8 3.3 64zm28.8-64H503.9c5.3 20.5 8.1 41.9 8.1 64s-2.8 43.5-8.1 64H380.8c2.1-20.6 3.2-42 3.2-64s-1.1-43.4-3.2-64zm112.6-32H376.7c-10-63.9-29.8-117.4-55.3-151.6c78.3 20.7 142 77.5 171.9 151.6zm-149.1 0H167.7c6.1-36.4 15.5-68.6 27-94.7c10.5-23.6 22.2-40.7 33.5-51.5C239.4 3.2 248.7 0 256 0s16.6 3.2 27.8 13.8c11.3 10.8 23 27.9 33.5 51.5c11.6 26 20.9 58.2 27 94.7zm-209 0H18.6C48.6 85.9 112.2 29.1 190.6 8.4C165.1 42.6 145.3 96.1 135.3 160zM8.1 192H131.2c-2.1 20.6-3.2 42-3.2 64s1.1 43.4 3.2 64H8.1C2.8 299.5 0 278.1 0 256s2.8-43.5 8.1-64zM194.7 446.6c-11.6-26-20.9-58.2-27-94.6H344.3c-6.1 36.4-15.5 68.6-27 94.6c-10.5 23.6-22.2 40.7-33.5 51.5C272.6 508.8 263.3 512 256 512s-16.6-3.2-27.8-13.8c-11.3-10.8-23-27.9-33.5-51.5zM135.3 352c10 63.9 29.8 117.4 55.3 151.6C112.2 482.9 48.6 426.1 18.6 352H135.3zm358.1 0c-30 74.1-93.6 130.9-171.9 151.6c25.5-34.2 45.2-87.7 55.3-151.6H493.4z"/></svg> www.doctorspraiagrande.com.br
                </div>

                <div class="row">
                  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><title>ionicons-v5-o</title><path d="M441.6,171.61,266.87,85.37a24.57,24.57,0,0,0-21.74,0L70.4,171.61A40,40,0,0,0,48,207.39V392c0,22.09,18.14,40,40.52,40h335c22.38,0,40.52-17.91,40.52-40V207.39A40,40,0,0,0,441.6,171.61Z" style="fill:#007fc5;stroke:#ffd54f;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/><path d="M397.33,368,268.07,267.46a24,24,0,0,0-29.47,0L109.33,368" style="fill:#007fc5;stroke:#ffd54f;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/><line x1="309.33" y1="295" x2="445.33" y2="192" style="fill:#007fc5;stroke:#ffd54f;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/><line x1="61.33" y1="192" x2="200.33" y2="297" style="fill:#007fc5;stroke:#ffd54f;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/></svg> doctors@doctorspraiagrande.com.br
                </div>
              </div>

            </div>
          </footer>

        </div>
      </body>
    </html>
    `;

    let browser;

    if (isProd) {
      browser = await puppeteer.launch({
        args: chromium.args,
        // Carrega o binário de uma URL externa em vez de localmente no node_modules
        executablePath: await chromium.executablePath('https://github.com/sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'),
        headless: true,
      });
    } else {
      // Configuração para Desenvolvimento (Seu Windows)
      // Certifique-se de ter o Chrome ou Edge instalado
      browser = await puppeteer.launch({
        args: [],
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Caminho padrão do Chrome
        headless: true,
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    // aguarda imagens/renderização
    await new Promise(resolve => setTimeout(resolve, 1500));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="declaracao.pdf"`,
      },
    });

  } catch (err: any) {
    console.error("Erro detalhado:", err);
    return NextResponse.json(
      { error: "Erro ao gerar PDF", details: err.message },
      { status: 500 }
    );
  }
}