"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { User, Volume2, ArrowRight, Stethoscope } from "lucide-react";

interface Chamada {
  id: string;
  senha_codigo: string;
  guiche: string;
  paciente_nome?: string;
  updated_at: string;
}

export default function PainelTV() {
  const [ultimaChamada, setUltimaChamada] = useState<Chamada | null>(null);
  const [historico, setHistorico] = useState<Chamada[]>([]);
  const lastIdRef = useRef<string | null>(null); // Para saber se a senha mudou
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Função de busca (O "Pooling")
  async function fetchDados() {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('id, senha_codigo, guiche, updated_at')
        .eq('status', 'EM_RECEPCAO')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        const novaChamada = data[0];

        // Dentro do fetchDados da TV
        if (novaChamada.id !== lastIdRef.current || novaChamada.updated_at !== lastTimeRef.current) {
          lastIdRef.current = novaChamada.id;
          lastTimeRef.current = novaChamada.updated_at; // Crucial para o "Chamar Novamente"

          setUltimaChamada(novaChamada);

          // Lógica do Som Duplo
          if (audioRef.current) {
            audioRef.current.play();

            // Toca a segunda vez após 2.5 segundos
            setTimeout(() => {
              if (audioRef.current) audioRef.current.play();
            }, 2500);
          }
        }
        // Só dispara o alerta sonoro e visual se o ID da última senha mudou
        if (novaChamada.id !== lastIdRef.current || novaChamada.updated_at !== lastTimeRef.current) {
          lastIdRef.current = novaChamada.id;
          lastTimeRef.current = novaChamada.updated_at; // Crucial para o "Chamar Novamente"

          setUltimaChamada(novaChamada);

          // Lógica do Som Duplo
          if (audioRef.current) {
            audioRef.current.play();

            // Toca a segunda vez após 2.5 segundos
            setTimeout(() => {
              if (audioRef.current) audioRef.current.play();
            }, 2500);
          }
        }
      }
    } catch (err) {
      console.error("Erro no pooling:", err);
    }
  }

  useEffect(() => {
    // Executa imediatamente ao carregar
    fetchDados();

    // Configura o pooling severo (Ex: a cada 3 segundos)
    const interval = setInterval(() => {
      fetchDados();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col p-8">
      <audio ref={audioRef} src="/sounds/call-bell.mp3" preload="auto" />

      {/* HEADER */}
      <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl">
            <Stethoscope className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Doctors</h1>
        </div>
        <div className="text-right">
          <p className="text-5xl font-mono font-bold text-slate-500">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-10">
        {/* SENHA EM DESTAQUE */}
        <section className="col-span-8 bg-blue-700 rounded-[50px] flex flex-col items-center justify-center p-12 relative overflow-hidden">
          {/* Efeito de fundo para chamar atenção */}
          <div className="absolute inset-0 bg-linear-to-br from-blue-500/20 to-transparent" />

          <p className="text-5xl font-black uppercase tracking-[0.4em] mb-6 text-blue-200 z-10">Senha</p>
          <h2 className="text-[22rem] leading-none font-black mb-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-10">
            {ultimaChamada?.senha_codigo || "---"}
          </h2>

          <div className="bg-black/30 backdrop-blur-xl px-16 py-8 rounded-[30px] border border-white/10 z-10">
            <p className="text-6xl font-black uppercase italic">
              Guichê <span className="text-yellow-400 ml-6">{ultimaChamada?.guiche || "--"}</span>
            </p>
          </div>
        </section>

        {/* ÚLTIMAS CHAMADAS */}
        <aside className="col-span-4 flex flex-col gap-6">
          <h3 className="text-3xl font-black uppercase text-slate-400 flex items-center gap-3">
            <ArrowRight className="w-8 h-8 text-blue-500" /> Histórico
          </h3>

          <div className="flex flex-col gap-4">
            {historico.map((item) => (
              <div key={item.id} className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[35px] flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-5xl font-black text-blue-500">{item.senha_codigo}</p>
                  <p className="text-xl font-bold text-slate-500 uppercase mt-2">Guichê {item.guiche}</p>
                </div>
                <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center">
                  <User className="text-slate-600 w-8 h-8" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto p-8 bg-blue-900/20 border border-blue-500/20 rounded-[30px]">
            <p className="text-blue-300 text-lg font-bold uppercase text-center leading-tight">
              Aguarde ser chamado pelo painel sonoro.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}