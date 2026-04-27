import React from 'react';

export const RelatorioAtendimentoGeral = React.forwardRef<HTMLDivElement, { item: any }>(({ item }, ref) => {
  if (!item) return null;

  return (
    <div
      ref={ref}
      className="sheet text-[12px] flex flex-col"
      style={{
        pageBreakAfter: 'always',
      }}
    >
      {/* Cabeçalho */}
      <header className="border-b border-blue-600 pb-4 mb-5 flex justify-between items-end shrink-0">
        <div className="flex flex-col">
          <img src="/images/logo/doctors-svg.svg" alt="Logo" className="w-20 h-20 object-contain" />
        </div>
        <div className="text-right text-xs font-medium">
          <p className="font-bold text-sm uppercase">Relatório de Atendimento Individual</p>
          <p>EMITIDO EM: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-grow space-y-8">
        <section>
          <h2 className="bg-slate-900 text-white px-2 py-1 text-sm font-bold uppercase mb-2">Dados do Paciente</h2>
          <div className='flex justify-between items-center'>
            <div className="grid grid-cols-2 gap-y-2 text-sm flex-grow">
              <p><strong>NOME:</strong> <span className="uppercase">{item?.cabecalho?.nome}</span></p>
              <p><strong>IDADE:</strong> <span className="uppercase">{item?.cabecalho?.idade}</span></p>
              <p><strong>SENHA:</strong> {item?.cabecalho?.senha}</p>
              <p><strong>EMPRESA:</strong> <span className="uppercase">{item?.cabecalho?.empresa}</span></p>
              <p><strong>DATA:</strong> {item?.cabecalho?.acionamento?.split(' ')[0]}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase">Permanência</p>
              <p className="text-xl font-black text-blue-600">
                {item.tempo_total_dispensado?.split('(')[1]?.replace(')', '') || '---'}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="bg-slate-900 text-white px-2 py-1 text-sm font-bold uppercase mb-2">Atendimento Detalhado</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left uppercase">
                <th className="py-2">Etapa</th>
                <th className="py-2">Profissional</th>
                <th className="py-2">Período</th>
                <th className="py-2 text-right">Duração</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 font-bold text-blue-600">ACIONAMENTO</td>
                <td className="py-3">-</td>
                <td className="py-3">{item.cabecalho.acionamento?.split(' ')[1]}</td>
                <td className="py-3 text-right">-</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 font-bold">RECEPÇÃO</td>
                <td className="py-3 uppercase">{item?.recepcao?.atendente}</td>
                <td className="py-3 font-mono">{item?.recepcao?.periodo}</td>
                <td className="py-3 text-right font-bold">{item?.recepcao?.duracao}</td>
              </tr>
              {item.procedimentos?.map((proc: any, idx: number) => (
                <tr key={idx} className="border-b border-slate-100 break-inside-avoid">
                  <td className="py-3 font-bold uppercase">{proc?.especialidade || proc?.especialiade}</td>
                  <td className="py-3 uppercase">{proc?.profissional}</td>
                  <td className="py-3 font-mono">{proc?.periodo}</td>
                  <td className="py-3 text-right font-bold">{proc?.duracao_sala}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {/* Rodapé fixo ao final da página */}
      {/* <footer className="mt-auto pt-10 border-t border-slate-200 text-center shrink-0">
        <div className="w-64 h-[1px] bg-slate-400 mx-auto mb-2"></div>
        <p className="text-[10px] font-bold uppercase text-slate-500">Assinatura do Responsável</p>
        <p className="text-[9px] text-slate-400 mt-2">Doctor's Saúde e Segurança do Trabalho</p>
      </footer> */}
    </div>
  );
});

RelatorioAtendimentoGeral.displayName = "RelatorioAtendimentoGeral";