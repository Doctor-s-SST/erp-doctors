/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Stethoscope, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Chamada {
  id: string;
  senha_codigo: string;
  nome_paciente?: string;
  guiche: string;
  origem: 'RECEPCAO' | 'EXAME';
  updated_at: string;
}

export default function PainelTV() {
  const [ultimaChamada, setUltimaChamada] = useState<Chamada | null>(null);
  const [historico, setHistorico] = useState<Chamada[]>([]);
  const [fila, setFila] = useState<Chamada[]>([]);
  const [processando, setProcessando] = useState(false);

  const lastTimeRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. FUNÇÃO DE VOZ MELHORADA
  const executarChamadaSonora = (chamada: Chamada) => {
    return new Promise<void>((resolve) => {
      const falar = (texto: string) => {
        return new Promise<void>((res) => {
          window.speechSynthesis.cancel();
          const msg = new SpeechSynthesisUtterance(texto);
          msg.lang = 'pt-BR';
          msg.rate = 0.85;
          msg.onend = () => res();
          msg.onerror = () => res();
          window.speechSynthesis.speak(msg);
        });
      };

      const tocarSino = () => {
        return new Promise<void>((res) => {
          if (!audioRef.current) return res();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.play()
            .then(() => setTimeout(res, 1800))
            .catch(() => res());
        });
      };

      // Proteção para senha não definida
      const senhaSoletreada = (chamada.senha_codigo || "").split('').join(' ');
      const identificador = chamada.nome_paciente
        ? `${chamada.nome_paciente}`
        : `Senha, ${senhaSoletreada}`;

      const local = chamada.origem === 'RECEPCAO'
        ? `comparecer ao guichê ${chamada.guiche}`
        : `comparecer à sala ${chamada.guiche}`;

      const textoFinal = `${identificador}, ${local}`;

      (async () => {
        try {
          await tocarSino();
          await falar(textoFinal);
          await new Promise(r => setTimeout(r, 1000));
          await tocarSino();
          await falar(textoFinal);
        } catch (e) {
          console.error("Erro na sequência de áudio", e);
        } finally {
          resolve();
        }
      })();
    });
  };

  // 2. PROCESSADOR DE FILA
  useEffect(() => {
    async function processarFila() {
      if (fila.length > 0 && !processando) {
        setProcessando(true);
        const proxima = fila[0];

        setUltimaChamada(proxima);
        setHistorico(prev => [proxima, ...prev.filter(h => h.id !== proxima.id)].slice(0, 7));

        
        try {
          const tabela = proxima.origem === 'RECEPCAO' ? 'atendimentos' : 'atendimento_exames';
          const novoStatus = proxima.origem === 'RECEPCAO' ? 'EM_RECEPCAO' : 'EM_ATENDIMENTO';
          await supabase.from(tabela).update({ status: novoStatus }).eq('id', proxima.id);
        } catch (err) { console.error("Erro ao atualizar status:", err); }
        
        await executarChamadaSonora(proxima);
        
        await new Promise(res => setTimeout(res, 3000));
        setFila(prev => prev.slice(1));
        setProcessando(false);
      }
    }
    processarFila();
  }, [fila, processando]);

  // 3. BUSCA DE DADOS (COM INTERCALAÇÃO)
  async function fetchDados() {
    try {
      // 1. Busca Recepção
      const { data: rec } = await supabase
        .from('atendimentos')
        .select('id, senha_codigo, guiche, updated_at, pacientes(nome)')
        .eq('status', 'EM_FILA')
        .order('updated_at', { ascending: true })
        .limit(3);

      // 2. Busca Exames - FOCO AQUI
      const { data: exm } = await supabase
        .from('atendimento_exames')
        .select(`
          id, 
          num_sala, 
          status,
          atendimentos!inner(
            senha_codigo, 
            updated_at, 
            pacientes(nome)
          )
        `)
        .eq('status', 'EM_FILA')
        .limit(3);
        
      const novosParaFila: Chamada[] = [];

      // Processa Recepção
      rec?.forEach(r => {
        if (!lastTimeRef.current || r.updated_at > lastTimeRef.current) {
          const p = Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes;
          novosParaFila.push({
            id: r.id,
            senha_codigo: r.senha_codigo,
            nome_paciente: p?.nome,
            guiche: r.guiche,
            origem: 'RECEPCAO',
            updated_at: r.updated_at
          });
        }
      });

      // Processa Exames
      exm?.forEach(e => {
        // No Supabase, o retorno do join pode vir como objeto ou array
        const atalhes = Array.isArray(e.atendimentos) ? e.atendimentos[0] : e.atendimentos;
        if (!atalhes) return;

        const p = Array.isArray(atalhes.pacientes) ? atalhes.pacientes[0] : atalhes.pacientes;
        const dataReferencia = atalhes.updated_at;

        // Se não houver lastTimeRef, pegamos os registros atuais para popular o histórico sem chamar áudio
        // Se houver, comparamos para saber se é novo
        if (dataReferencia && (!lastTimeRef.current || dataReferencia > lastTimeRef.current)) {
          novosParaFila.push({
            id: e.id,
            senha_codigo: atalhes.senha_codigo || '---',
            nome_paciente: p?.nome,
            guiche: e.num_sala, // Usa o num_sala da tabela de exames
            origem: 'EXAME',
            updated_at: dataReferencia
          });
        }
      });

      if (novosParaFila.length > 0) {
        novosParaFila.sort((a, b) => a.updated_at.localeCompare(b.updated_at));

        setFila(prev => {
          const idsExistentes = new Set(prev.map(i => i.id));
          const filtrados = novosParaFila.filter(n => !idsExistentes.has(n.id));
          return [...prev, ...filtrados];
        });

        lastTimeRef.current = novosParaFila[novosParaFila.length - 1].updated_at;
      }
    } catch (err) {
      console.error("Erro no polling:", err);
    }
  }

  useEffect(() => {
    fetchDados();
    const interval = setInterval(fetchDados, 4000);
    return () => clearInterval(interval);
  }, []);

  const data = new Date();
  const dataAtual = {
    weekday: data.toLocaleDateString('pt-BR', { weekday: 'long' }),
    day: data.toLocaleDateString('pt-BR', { day: '2-digit' }),
    month: data.toLocaleDateString('pt-BR', { month: 'long' }),
    year: data.toLocaleDateString('pt-BR', { year: 'numeric' }),
  };

  return (
    <div className="h-screen w-screen bg-white overflow-hidden flex flex-col font-sans">
      <audio ref={audioRef} src="/sounds/call-bell.wav" preload="auto" />

      {/* HEADER */}
      <header className="h-20 flex justify-between items-center px-5 py-2 bg-white shadow-[0px_2px_5px_0px_rgba(0,0,0,0.2)] z-10">
        <div className="flex items-center gap-2">
          <img src="/images/logo/doctors-svg.svg" alt="Doctors" className="h-15" />
        </div>
        <p className="text-black font-medium text-lg capitalize">
          {dataAtual.weekday}, {dataAtual.day} <span className="lowercase">de {dataAtual.month} de</span> {dataAtual.year}
        </p>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden"> {/* Adicionado gap para separar os lados se desejar */}

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
              {/* CABEÇALHO INTERNO: Posicionado no topo */}
              <div className="text-[2.2em] absolute top-10 flex flex-col items-center text-white font-bold uppercase" >
                <h3 className="tracking-widest">
                  Senha Atual
                </h3>
                {ultimaChamada?.nome_paciente && (
                  <p>
                    {ultimaChamada.senha_codigo}
                  </p>
                )}
              </div>

              {/* CONTEÚDO CENTRAL: Sempre no centro do main */}
              <div className="flex flex-col items-center w-full">
                {ultimaChamada?.nome_paciente ? (
                  <h2 className="text-[6vw] leading-[1.1] font-black text-center wrap-break-word px-10 uppercase drop-shadow-md">
                    {ultimaChamada.nome_paciente}
                    {/* Abel Joaquim Dantas Pereira Marcondes */}
                  </h2>
                ) : (
                  <h2 className="text-[22rem] leading-none font-black drop-shadow-lg tracking-tighter">
                    {ultimaChamada?.senha_codigo || "---"}
                  </h2>
                )}
              </div>

              {/* RODAPÉ INTERNO: Posicionado na base */}
              <div className="absolute bottom-12 text-7xl font-bold uppercase tracking-tight flex items-center gap-4">
                <span>
                  {ultimaChamada?.origem !== 'RECEPCAO' ? 'Sala' : 'Guichê'}
                </span>
                <span >
                  {ultimaChamada?.guiche || '-'}
                </span>
              </div>
            </motion.main>
          </AnimatePresence>
        </div>

        {/* LADO DIREITO: HISTÓRICO */}
        <aside className="shadow-[0px_4px_15px_0px_rgba(0,0,0,0.2)] flex-1 bg-white flex flex-col overflow-hidden">
          <div className="p-5 border-b-2 border-[#3498db] mx-5">
            <h3 className="text-2xl font-bold text-black text-center">Últimas Senhas Chamadas</h3>
          </div>
          <div className="flex-1 flex flex-col">
            {historico.slice(1).map((item, idx) => (
              <div key={item.id + idx} className="flex-1 border-b border-gray-400 flex flex-col items-center justify-center p-2 last:border-0">
                <p className="text-[3.5vw] font-black text-gray-800 leading-tight">{item.senha_codigo}</p>
                <p className="text-[1.8vw] font-bold text-[#3498db] uppercase">
                  {item.origem === 'RECEPCAO' ? 'Guichê' : 'Sala'} {item.guiche}
                </p>
                {item.nome_paciente && (
                  <p className="text-[1.4em] text-gray-400 break-word font-medium w-full text-center uppercase italic px-4">{item.nome_paciente}</p>
                )}
              </div>
            ))}
            {historico.length <= 1 && (
              <div className="flex-1 flex items-center justify-center text-gray-600 font-medium italic">
                Nenhuma chamada recente
              </div>
            )}
          </div>
        </aside>
      </div>
      {/* FOOTER MARQUEE */}
      <footer className="h-15 flex justify-between items-center px-5 py-2 bg-white shadow-[0px_0px_5px_2px_rgba(0,0,0,0.2)] z-10">
        <div className="animate-marquee whitespace-nowrap text-black text-[18px] font-medium px-4">
          Aviso: Realizamos diversos exames, porém, você será chamado somente para salas correspondentes ao seu tipo de atendimento.
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}