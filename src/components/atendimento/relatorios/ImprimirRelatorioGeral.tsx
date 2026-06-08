import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { RelatorioAtendimentoGeral } from './RelatorioAtendimentoGeral';

export const BotaoImprimirRelatorio = ({ item, text }: { item: any[], text: string }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: 'Relatorio_Geral_Atendimentos',
  });

  return (
    <>
      <Button 
        onClick={handlePrint}
        className="bg-orange-600 hover:bg-orange-700 text-white gap-2 py-4 disabled:opacity-70 text-[12px]"
      >
        <Printer className="w-4 h-4" /> {text}
      </Button>

      {/* Container oculto para impressão */}
      <div className="hidden">
        <div ref={componentRef} className="p-0">
          {item.map((individual, index) => (
            <RelatorioAtendimentoGeral key={index + 1} item={individual} />
          ))}
        </div>
      </div>
    </>
  );
};