/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface Chamada {
  id: string;
  senha_codigo: string;
  nome_paciente?: string;
  guiche: string;
  origem: 'RECEPCAO' | 'EXAME';
  updated_at: string;
}

interface Sala {
  numero: string | number;
  andar: number;
}

export default function PainelTV() {
  const [ultimaChamada, setUltimaChamada] = useState<Chamada | null>(null);
  const [historico, setHistorico] = useState<Chamada[]>([]);
  const [fila, setFila] = useState<Chamada[]>([]);
  const [processando, setProcessando] = useState(false);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [ativado, setAtivado] = useState(false);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [unidadeLogo, setUnidadeLogo] = useState<string>("");
  const [falaAndar, setFalaAndar] = useState(false);
  const [falaTerreo, setFalaTerreo] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Formatação de data seguindo seu design
  const data = new Date();
  const dataAtual = {
    weekday: data.toLocaleDateString('pt-BR', { weekday: 'long' }),
    day: data.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: data.toLocaleDateString('pt-BR', { month: 'long' }),
    year: data.getFullYear()
  };

  // 1. VOZ COM GRAMÁTICA CORRIGIDA
  const executarChamadaSonora = (chamada: Chamada) => {
    return new Promise<void>(async (resolve) => {
      const falar = (texto: string) => {
        return new Promise<void>((res) => {
          // Cancela qualquer fala anterior para evitar fila infinita
          window.speechSynthesis.cancel();

          const msg = new SpeechSynthesisUtterance(texto);
          msg.lang = 'pt-BR';
          msg.rate = 0.9;

          // Tenta encontrar uma voz em português explicitamente
          const voices = window.speechSynthesis.getVoices();
          const voiceBR = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
          if (voiceBR) msg.voice = voiceBR;

          msg.onend = () => res();
          msg.onerror = (e) => {
            console.error("Erro na síntese de voz:", e);
            res();
          };

          // Pequeno delay para garantir que o 'cancel' anterior foi processado
          setTimeout(() => {
            window.speechSynthesis.speak(msg);
          }, 100);
        });
      };

      const tocarSino = () => {
        return new Promise<void>((res) => {
          if (!audioRef.current) return res();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => res());
          audioRef.current.onended = () => res();
          setTimeout(res, 3000); // safety timeout
        });
      };

      const senhaSoletreada = (chamada.senha_codigo || "").split('').join(' ');
      const identificador = chamada.nome_paciente ? `${chamada.nome_paciente}` : `Senha, ${senhaSoletreada}`;
      const andar = falaAndar
        ? obterAndarSala(chamada.guiche, falaTerreo)
        : "";

      const destino = chamada.origem === 'RECEPCAO'
        ? `comparecer ao guichê ${chamada.guiche}, recepção`
        : `comparecer à sala ${chamada.guiche}${andar ? `, ${andar}` : ""}`;
      const textoFinal = `${identificador}, ${destino}`;

      try {
        await tocarSino();
        await falar(textoFinal);
        await new Promise(r => setTimeout(r, 1500));
        await tocarSino();
        await falar(textoFinal);
      } finally {
        resolve();
      }
    });
  };

  // 2. PROCESSADOR DE FILA
  useEffect(() => {
    async function processar() {
      if (fila.length > 0 && !processando && unidadeId && ativado) {
        setProcessando(true);
        const atual = fila[0];

        setUltimaChamada(atual);
        setHistorico(prev => [atual, ...prev.filter(h => h.id !== atual.id)].slice(0, 6));

        const tab = atual.origem === 'RECEPCAO' ? 'atendimentos' : 'atendimento_exames';
        const st = atual.origem === 'RECEPCAO' ? 'EM_RECEPCAO' : 'EM_ATENDIMENTO';
        supabase.from(tab).update({ status: st }).eq('id', atual.id).then();

        await executarChamadaSonora(atual);
        await new Promise(r => setTimeout(r, 5000));

        setFila(prev => prev.slice(1));
        setProcessando(false);
      }
    }
    processar();
  }, [fila, processando, unidadeId, ativado]);

  // 3. BUSCA COM INTERCALAÇÃO (Zip-Merge)
  useEffect(() => {
    if (!unidadeId) return;

    async function carregarSalas() {
      const { data } = await supabase
        .from("salas")
        .select("numero, andar")
        .eq("unidade_id", unidadeId);

      if (data) {
        setSalas(data);
      }
    }

    carregarSalas();

  }, [unidadeId]);

  useEffect(() => {
    const carregarDados = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("unidade_id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      setUnidadeId(profile.unidade_id);

      const { data: unidade, error } = await supabase
        .from("unidades")
        .select("logo_url")
        .eq("id", profile.unidade_id)
        .single();

      if (!error && unidade) {
        setUnidadeLogo(unidade.logo_url || "");
      }

      const { data: config } = await supabase
        .from("painel_config")
        .select("fala_andar, fala_terreo")
        .eq("unidade_id", profile.unidade_id)
        .single();

      setFalaAndar(config?.fala_andar ?? false);
      setFalaTerreo(config?.fala_terreo ?? false);
    };

    carregarDados();
  }, []);

  useEffect(() => {

    if (!unidadeId) return;

    const eventSource = new EventSource(
      `https://doctors-distribuidor-sse.cgalnz.easypanel.host/stream-fila` +
      `?tipo=painel_tv` +
      `&unidadeId=${unidadeId}`
    );

    eventSource.onmessage = (event) => {

      try {

        const payload =
          JSON.parse(event.data);

        if (
          payload.tipo !== 'painel_tv'
        ) return;

        const novas =
          payload.dados || [];

        setFila(prev => {

          const ids =
            new Set(
              prev.map(
                x => x.id
              )
            );

          return [
            ...prev,
            ...novas.filter(
              (x: { id: string; }) => !ids.has(x.id)
            )
          ];

        });

      } catch (err) {

        console.error(err);

      }

    };

    return () =>
      eventSource.close();

  }, [unidadeId]);

  function obterAndarSala(numeroSala: string | number, incluirTerreo = true) {
    if (!falaAndar) return "";

    const sala = salas.find(
      s => String(s.numero) === String(numeroSala)
    );

    if (!sala) return "";

    if (Number(sala.andar) === 0) {
      return incluirTerreo ? "térreo" : "";
    }

    return `${sala.andar}º andar`;
  }

  // TELA DE ATIVAÇÃO
  if (!ativado) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#3498db] p-5 text-center text-white sm:p-10">
        {unidadeLogo && (
          <img
            src={unidadeLogo}
            alt="Logo"
            className="mb-6 h-16 max-w-full object-contain sm:mb-10 sm:h-24"
          />
        )}
        <h1 className="mb-4 text-2xl font-bold sm:text-4xl">Painel de Chamada Doctor&apos;s</h1>
        <button
          onClick={() => setAtivado(true)}
          className="mb-6 w-full max-w-md rounded-full bg-white px-6 py-4 text-xl font-black text-[#3498db] shadow-2xl transition-all hover:scale-105 active:scale-95 sm:px-12 sm:py-6 sm:text-3xl"
        >
          ATIVAR ÁUDIO E INICIAR
        </button>
        <p className="max-w-md text-base opacity-70 sm:text-xl">O navegador exige um clique para permitir que o sistema fale os nomes dos pacientes automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-white font-sans">
      <audio ref={audioRef} src="/sounds/call-bell.wav" preload="auto" />

      {/* HEADER DESIGN EXATO */}
      <header className="z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 bg-white px-3 py-2 shadow-[0px_2px_5px_0px_rgba(0,0,0,0.2)] sm:h-20 sm:px-5">
        <div className="flex items-center gap-2">
          {unidadeLogo && (
            <img src={unidadeLogo} alt="Logo" className="h-9 max-w-32 object-contain sm:h-12 sm:max-w-none" />
          )}
        </div>
        <p className="text-right text-xs font-medium capitalize text-black sm:text-lg">
          {dataAtual.weekday}, {dataAtual.day} <span className="lowercase">de {dataAtual.month} de</span> {dataAtual.year}
        </p>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">

        {/* LADO ESQUERDO: DESTAQUE AZUL */}
        <div className="flex min-h-0 flex-[3.1] p-2 sm:p-4 lg:p-5">
          <AnimatePresence mode="wait">
            <motion.main
              key={ultimaChamada?.id || 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full shadow-[0px_4px_15px_0px_rgba(0,0,0,0.2)] bg-[#3498db] p-5 flex flex-col items-center justify-center overflow-hidden text-white rounded-lg"
            >
              {ultimaChamada && (
                <>
                  <div className="absolute top-3 flex flex-col items-center text-center text-base font-bold uppercase text-white sm:top-6 sm:text-2xl lg:top-10 lg:text-[2.2em]">
                    <h3 className="tracking-widest opacity-90">Senha Atual</h3>
                    <p className="mt-1 text-2xl sm:mt-2 sm:text-4xl lg:text-5xl">{ultimaChamada.senha_codigo}</p>
                  </div>

                  <div className="flex flex-col items-center w-full mt-0">
                    {ultimaChamada.nome_paciente ? (
                      <h2 className="break-words px-2 text-center text-[clamp(2rem,6vw,7rem)] font-black uppercase leading-[1.1] drop-shadow-md sm:px-10">
                        {ultimaChamada.nome_paciente}
                      </h2>
                    ) : (
                      <h2 className="text-[clamp(5rem,20vw,19rem)] font-black leading-none tracking-tighter drop-shadow-lg">
                        {ultimaChamada.senha_codigo}
                      </h2>
                    )}
                  </div>

                  <div className="absolute bottom-3 flex flex-col items-center text-2xl font-bold uppercase tracking-tight sm:bottom-6 sm:text-5xl lg:bottom-12 lg:text-7xl">
                    <div className="flex gap-3 sm:gap-8">
                      <span>
                        {ultimaChamada.origem === 'RECEPCAO' ? 'Guichê' : 'Sala'}
                      </span>
                      <span>
                        {ultimaChamada.guiche}
                      </span>
                    </div>

                    <div className="flex flex-col items-center mt-2">
                      <span className="text-xl tracking-tight sm:text-3xl lg:text-5xl">
                        {ultimaChamada.origem === 'RECEPCAO'
                          ? "Recepção"
                          : falaAndar
                            ? obterAndarSala(ultimaChamada.guiche)
                            : ""}
                      </span>
                    </div>

                  </div>
                </>
              )}
            </motion.main>
          </AnimatePresence>
        </div>

        {/* LADO DIREITO: HISTÓRICO DESIGN EXATO */}
        <aside className="flex max-h-[38%] min-h-0 flex-1 flex-col overflow-hidden bg-white shadow-[0px_4px_15px_0px_rgba(0,0,0,0.2)] lg:max-h-none">
          <div className="p-3 border-b-2 border-[#3498db] mx-4">
            <h3 className="text-center text-sm font-bold text-black sm:text-lg lg:text-2xl">Últimas Senhas Chamadas</h3>
          </div>
          <div className="flex-1 flex flex-col">
            {historico.slice(1, 6).map((item, idx) => (
              <div key={item.id + idx} className="flex-1 border-b border-gray-400 flex flex-col items-center justify-center p-2 last:border-0">
                <p className="text-xl font-black leading-tight text-gray-800 sm:text-2xl lg:text-[3.5vw]">{item.senha_codigo}</p>
                <p className="text-sm font-bold uppercase text-[#3498db] sm:text-base lg:text-[1.8vw]">
                  {item.origem === 'RECEPCAO' ? 'Guichê' : 'Sala'} {item.guiche}
                </p>
                {item.nome_paciente && (
                  <p className="w-full truncate px-2 text-center text-xs font-medium uppercase italic text-gray-400 sm:text-base lg:px-4 lg:text-[1.4em]">{item.nome_paciente}</p>
                )}
              </div>
            ))}
            {historico.length <= 1 && (
              <div className="flex-1 flex items-center justify-center text-gray-400 font-medium italic">
                Nenhuma chamada recente
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* FOOTER MARQUEE DESIGN EXATO */}
      <footer className="z-10 flex h-10 shrink-0 items-center justify-between overflow-hidden bg-white px-2 py-1 shadow-[0px_0px_5px_2px_rgba(0,0,0,0.2)] sm:h-16 sm:px-5 sm:py-2">
        <div className="animate-marquee whitespace-nowrap px-4 text-sm font-medium text-black sm:text-[18px]">
          Aviso: Realizamos diversos exames, porém, você será chamado somente para salas correspondentes ao seu tipo de atendimento.
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-150%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
