/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef, useMemo } from "react";
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

const salasAndar = {
  '1': 'térreo', '2': 'térreo', '3': 'térreo', '4': 'térreo', '5': 'térreo',
  '6': 'térreo', '7': 'primeiro andar', '8': 'primeiro andar',
  '9': 'primeiro andar', '10': 'primeiro andar',
};

export default function PainelTV() {
  const [ultimaChamada, setUltimaChamada] = useState<Chamada | null>(null);
  const [historico, setHistorico] = useState<Chamada[]>([]);
  const [fila, setFila] = useState<Chamada[]>([]);
  const [processando, setProcessando] = useState(false);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [ativado, setAtivado] = useState(false);
  // const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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
      const andar = salasAndar[chamada.guiche as keyof typeof salasAndar];

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

    const fetchDados = async () => {
      try {
        const { data: rec } = await supabase.from('atendimentos').select('id, senha_codigo, guiche, updated_at, pacientes(nome)').eq('status', 'EM_FILA').eq('unidade_id', unidadeId).order('updated_at', { ascending: true });
        const { data: exm } = await supabase.from('atendimento_exames').select(`id, num_sala, atendimentos!inner(senha_codigo, updated_at, unidade_id, pacientes(nome))`).eq('status', 'EM_FILA').eq('atendimentos.unidade_id', unidadeId).order('atendimentos(updated_at)', { ascending: true });

        const lRec: Chamada[] = rec?.map(r => ({ id: r.id, senha_codigo: r.senha_codigo, nome_paciente: (r.pacientes as any)?.nome, guiche: r.guiche, origem: 'RECEPCAO', updated_at: r.updated_at })) || [];
        const lExm: Chamada[] = exm?.map(e => {
          const a = Array.isArray(e.atendimentos) ? e.atendimentos[0] : (e.atendimentos as any);
          return { id: e.id, senha_codigo: a.senha_codigo, nome_paciente: a.pacientes?.nome, guiche: e.num_sala, origem: 'EXAME', updated_at: a.updated_at };
        }) || [];

        const intercalados: Chamada[] = [];
        const max = Math.max(lRec.length, lExm.length);
        for (let i = 0; i < max; i++) {
          if (lRec[i]) intercalados.push(lRec[i]);
          if (lExm[i]) intercalados.push(lExm[i]);
        }

        if (intercalados.length > 0) {
          setFila(prev => {
            const ids = new Set(prev.map(p => p.id));
            return [...prev, ...intercalados.filter(n => !ids.has(n.id))];
          });
        }
      } catch (e) { console.error(e); }
    };

    fetchDados();
    const inv = setInterval(fetchDados, 4000);
    return () => clearInterval(inv);
  }, [unidadeId]);

  // const fetchDados = async () => {
  //   try {
  //     const { data: rec } = await supabase.from('atendimentos').select('id, senha_codigo, guiche, updated_at, pacientes(nome)').eq('status', 'EM_FILA').eq('unidade_id', unidadeId).order('updated_at', { ascending: true });
  //     const { data: exm } = await supabase.from('atendimento_exames').select(`id, num_sala, atendimentos!inner(senha_codigo, updated_at, unidade_id, pacientes(nome))`).eq('status', 'EM_FILA').eq('atendimentos.unidade_id', unidadeId).order('atendimentos(updated_at)', { ascending: true });

  //     const lRec: Chamada[] = rec?.map(r => ({ id: r.id, senha_codigo: r.senha_codigo, nome_paciente: (r.pacientes as any)?.nome, guiche: r.guiche, origem: 'RECEPCAO', updated_at: r.updated_at })) || [];
  //     const lExm: Chamada[] = exm?.map(e => {
  //       const a = Array.isArray(e.atendimentos) ? e.atendimentos[0] : (e.atendimentos as any);
  //       return { id: e.id, senha_codigo: a.senha_codigo, nome_paciente: a.pacientes?.nome, guiche: e.num_sala, origem: 'EXAME', updated_at: a.updated_at };
  //     }) || [];

  //     const intercalados: Chamada[] = [];
  //     const max = Math.max(lRec.length, lExm.length);
  //     for (let i = 0; i < max; i++) {
  //       if (lRec[i]) intercalados.push(lRec[i]);
  //       if (lExm[i]) intercalados.push(lExm[i]);
  //     }

  //     if (intercalados.length > 0) {
  //       setFila(prev => {
  //         const ids = new Set(prev.map(p => p.id));
  //         return [...prev, ...intercalados.filter(n => !ids.has(n.id))];
  //       });
  //     }
  //   } catch (e) { console.error(e); }
  // };
  // 3. BUSCA COM INTERCALAÇÃO (Zip-Merge)
  // useEffect(() => {
  //   if (!unidadeId) return;

  //   fetchDados();

  //   const eventSource = new EventSource(
  //     `https://doctors-distribuidor-sse.cgalnz.easypanel.host/stream-fila?unidadeId=${unidadeId}`
  //   );

  //   eventSource.onmessage = () => {

  //     if (debounceRef.current) {
  //       clearTimeout(debounceRef.current);
  //     }

  //     debounceRef.current = setTimeout(() => {
  //       fetchDados();
  //     }, 500);

  //   };

  //   const fallbackInterval = setInterval(() => {
  //     fetchDados();
  //   }, 180000);

  //   return () => {

  //     if (debounceRef.current) {
  //       clearTimeout(debounceRef.current);
  //     }

  //     eventSource.close();
  //     clearInterval(fallbackInterval);

  //   };

  // }, [unidadeId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('unidade_id').eq('id', user.id).single()
          .then(({ data }) => data && setUnidadeId(data.unidade_id));
      }
    });
  }, []);

  // TELA DE ATIVAÇÃO
  if (!ativado) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#3498db] text-white p-10 text-center">
        <img src="/images/logo/doctors-svg.svg" alt="Logo" className="h-24 mb-10 brightness-0 invert" />
        <h1 className="text-4xl font-bold mb-4">Painel de Chamada Doctor's</h1>
        <button
          onClick={() => setAtivado(true)}
          className="px-12 py-6 bg-white text-[#3498db] rounded-full font-black text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all mb-6"
        >
          ATIVAR ÁUDIO E INICIAR
        </button>
        <p className="opacity-70 text-xl max-w-md">O navegador exige um clique para permitir que o sistema fale os nomes dos pacientes automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white overflow-hidden flex flex-col font-sans">
      <audio ref={audioRef} src="/sounds/call-bell.wav" preload="auto" />

      {/* HEADER DESIGN EXATO */}
      <header className="h-20 flex justify-between items-center px-5 py-2 bg-white shadow-[0px_2px_5px_0px_rgba(0,0,0,0.2)] z-10">
        <div className="flex items-center gap-2">
          <img src="/images/logo/doctors-svg.svg" alt="Doctors" className="h-12" />
        </div>
        <p className="text-black font-medium text-lg capitalize">
          {dataAtual.weekday}, {dataAtual.day} <span className="lowercase">de {dataAtual.month} de</span> {dataAtual.year}
        </p>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden">

        {/* LADO ESQUERDO: DESTAQUE AZUL */}
        <div className="flex-[3.1] flex p-5">
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
                  <div className="text-[2.2em] absolute top-10 flex flex-col items-center text-white font-bold uppercase text-center">
                    <h3 className="tracking-widest opacity-90">Senha Atual</h3>
                    <p className="text-5xl mt-2">{ultimaChamada.senha_codigo}</p>
                  </div>

                  <div className="flex flex-col items-center w-full mt-0">
                    {ultimaChamada.nome_paciente ? (
                      <h2 className="text-[6vw] leading-[1.1] font-black text-center px-10 uppercase drop-shadow-md break-words">
                        {ultimaChamada.nome_paciente}
                      </h2>
                    ) : (
                      <h2 className="text-[19rem] leading-none font-black drop-shadow-lg tracking-tighter">
                        {ultimaChamada.senha_codigo}
                      </h2>
                    )}
                  </div>

                  <div className="absolute bottom-12 text-7xl font-bold uppercase tracking-tight flex flex-col items-center">
                    <div className="flex gap-8">
                      <span>
                        {ultimaChamada.origem === 'RECEPCAO' ? 'Guichê' : 'Sala'}
                      </span>
                      <span>
                        {ultimaChamada.guiche}
                      </span>
                    </div>

                    {unidadeId === "ba83f0b4-1b16-4b07-9473-fe929f16f881" && (
                      <div className="flex flex-col items-center mt-2">
                        <span className="text-5xl tracking-tight">
                          {ultimaChamada.origem === 'RECEPCAO'
                            ? "Recepção"
                            : salasAndar[ultimaChamada.guiche as keyof typeof salasAndar] || ""}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.main>
          </AnimatePresence>
        </div>

        {/* LADO DIREITO: HISTÓRICO DESIGN EXATO */}
        <aside className="shadow-[0px_4px_15px_0px_rgba(0,0,0,0.2)] flex-1 bg-white flex flex-col overflow-hidden">
          <div className="p-3 border-b-2 border-[#3498db] mx-4">
            <h3 className="text-2xl font-bold text-black text-center">Últimas Senhas Chamadas</h3>
          </div>
          <div className="flex-1 flex flex-col">
            {historico.slice(1, 6).map((item, idx) => (
              <div key={item.id + idx} className="flex-1 border-b border-gray-400 flex flex-col items-center justify-center p-2 last:border-0">
                <p className="text-[3.5vw] font-black text-gray-800 leading-tight">{item.senha_codigo}</p>
                <p className="text-[1.8vw] font-bold text-[#3498db] uppercase">
                  {item.origem === 'RECEPCAO' ? 'Guichê' : 'Sala'} {item.guiche}
                </p>
                {item.nome_paciente && (
                  <p className="text-[1.4em] text-gray-400 font-medium w-full text-center uppercase italic px-4 truncate">{item.nome_paciente}</p>
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
      <footer className="h-16 flex justify-between items-center px-5 py-2 bg-white shadow-[0px_0px_5px_2px_rgba(0,0,0,0.2)] z-10 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap text-black text-[18px] font-medium px-4">
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