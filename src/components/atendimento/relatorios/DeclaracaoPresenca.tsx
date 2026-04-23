import React from 'react';
import { Mail, Globe, MapPin, Phone } from 'lucide-react';
import Image from 'next/image';

export const DeclaracaoPresenca = React.forwardRef<HTMLDivElement, { item: any }>(({ item }, ref) => {
  if (!item) return null;

  // Extração de dados baseada no Relatório de Atendimento
  const nomePaciente = item.cabecalho?.nome || "________________________________________";
  const dataAtendimento = item.cabecalho?.acionamento?.split(' ')[0] || "//________";
  const horarioEntrada = item.cabecalho?.acionamento?.split(' ')[1] || "______";
  const horarioSaida = item.tempo_total_dispensado?.split('~')[1]?.split(' ')[0] || "______";

  return (
    <div
      ref={ref}
      className="text-[12px] flex flex-col"
      style={{
        pageBreakAfter: 'always',

      }}
    >
      {/* CABEÇALHO TIMBRADO (CSS) */}
      <header className="w-full overflow-hidden shrink-0">
        <Image src="/images/timbrado/timb-cabecalho.svg" alt="Logo" className="w-full h-auto opacity-50" width={100} height={100} />
      </header>

      {/* CONTEÚDO DA DECLARAÇÃO */}
      <main className="flex-grow px-20 pt-10 text-justify leading-relaxed text-gray-800">
        <h1 className="text-xl font-black text-center mb-16 underline tracking-widest">
          DECLARAÇÃO DE COMPARECIMENTO
        </h1>

        <div className="space-y-6 text-base">
          <p>
            A empresa <strong>DOCTOR'S SAÚDE E SEGURANÇA NO TRABALHO</strong>, declara para os devidos fins que o(a)
            Sr.(a) <strong className="uppercase">{nomePaciente}</strong>,
            compareceu a nossa unidade no dia <strong>{dataAtendimento}</strong>,
            no horário das <strong>{horarioEntrada}</strong> às <strong>{horarioSaida}</strong> para a realização de exames ocupacionais.
          </p>

          <p>
            Declara ainda que o(a) referido(a) paciente esteve em atendimento nesta unidade durante o período acima informado.
          </p>

          <p>Por ser verdade, firma a presente declaração.</p>
        </div>

        <div className="mt-24 space-y-20">
          <div className="text-right">
            <p>Praia Grande, {new Date().toLocaleDateString('pt-BR')}.</p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-80 border-t border-gray-400 mb-2"></div>
            <p className="font-bold uppercase text-xs text-gray-600">Assinatura da empresa</p>
          </div>
        </div>
      </main>

      {/* RODAPÉ TIMBRADO (CSS) */}
      <footer className="w-full bg-[#007fc5ff] opacity-50 text-white font-bold p-6 shrink-0 border-t-4 border-[#ff7f00ff]">
        <div className="grid grid-cols-2 gap-4 text-[10px]">
          {/* Contatos */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-yellow-300" /> <span>13 <strong>3499.1010</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-yellow-300" /> <span>PRAIA GRANDE/SP: Av. São Paulo, 707 - Guilhermina</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-yellow-300" /> <span>ITANHAÉM/SP: Av. Condessa de Vimieiros, 587 - Centro</span>
            </div>
          </div>

          {/* Social / Web */}
          <div className="space-y-2 border-l border-gray-700 pl-4">
            <div className="flex items-center gap-1">
              <a href="https://www.linkedin.com/company/doctorspraiagrande" target="_blank"
                rel="noreferrer" className="text-[#007fc5ff] flex h-5 w-5 items-center justify-center gap-2 rounded-full bg-yellow-300 text-sm font-medium">
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
              </a>
              <a href='https://instagram.com/doctorspraiagrande' target="_blank"
                rel="noreferrer" className="text-[#007fc5ff] flex h-5 w-5 items-center justify-center gap-2 rounded-full bg-yellow-300 text-sm font-medium">
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
              </a>
              <a href='https://facebook.com/doctorspraiagrande' target="_blank"
                rel="noreferrer" className="text-[#007fc5ff] flex h-5 w-5 items-center justify-center gap-2 rounded-full bg-yellow-300 text-sm font-medium">
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
              </a>
              <span>/doctorspraiagrande</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-3 h-3 text-yellow-300" /> <span>www.doctorspraiagrande.com.br</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3 text-yellow-300" /> <span>doctors@doctorspraiagrande.com.br</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

DeclaracaoPresenca.displayName = "DeclaracaoPresenca";