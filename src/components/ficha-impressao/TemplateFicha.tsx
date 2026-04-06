import React, { forwardRef } from "react";

interface TemplateFichaProps {
  dados: any;
}

export const TemplateFicha = forwardRef<HTMLDivElement, TemplateFichaProps>(
  ({ dados }, ref) => {
    return (
      <div
        ref={ref}
        className="w-[794px] h-[1123px] bg-white text-black p-8 text-sm"
      >
        {/* HEADER */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold">
            FICHA DE ATENDIMENTO
          </h1>
          <p className="text-xs">
            {dados?.empresa?.razao || "Empresa"} -{" "}
            {dados?.empresa?.cnpj || "CNPJ"}
          </p>
        </div>

        {/* FUNCIONÁRIO */}
        <div className="mb-4">
          <h2 className="font-bold border-b mb-2">FUNCIONÁRIO</h2>

          <div className="grid grid-cols-2 gap-2">
            <p><strong>Nome:</strong> {dados?.funcionario?.nome}</p>
            <p><strong>Nascimento:</strong> {dados?.funcionario?.nascimento}</p>
            <p><strong>Cargo:</strong> {dados?.funcionario?.cargo}</p>
            <p><strong>Setor:</strong> {dados?.funcionario?.setor}</p>
            <p><strong>Tipo de exame:</strong> {dados?.tipoExame}</p>
            <p><strong>Sequencial:</strong> {dados?.sequencial}</p>
          </div>
        </div>

        {/* EXAMES */}
        <div className="mb-4">
          <h2 className="font-bold border-b mb-2">
            AVALIAÇÃO CLÍNICA E EXAMES
          </h2>

          {dados?.exames?.length ? (
            <table className="w-full border text-xs">
              <thead>
                <tr className="border">
                  <th className="border p-1">Data</th>
                  <th className="border p-1">Exame</th>
                </tr>
              </thead>
              <tbody>
                {dados.exames.map((ex: any, i: number) => (
                  <tr key={i}>
                    <td className="border p-1">{ex.data}</td>
                    <td className="border p-1">{ex.exame}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">Sem exames registrados</p>
          )}
        </div>

        {/* TRIAGEM */}
        <div className="mb-4">
          <h2 className="font-bold border-b mb-2">TRIAGEM</h2>

          <div className="grid grid-cols-3 gap-2">
            <p><strong>PA:</strong> {dados?.triagem?.pa}</p>
            <p><strong>Altura:</strong> {dados?.triagem?.altura}</p>
            <p><strong>Peso:</strong> {dados?.triagem?.peso}</p>
          </div>
        </div>

        {/* ACUIDADE VISUAL */}
        <div className="mb-4">
          <h2 className="font-bold border-b mb-2">
            ACUIDADE VISUAL
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <p><strong>OD:</strong> {dados?.visao?.od}</p>
            <p><strong>OE:</strong> {dados?.visao?.oe}</p>
          </div>
        </div>

        {/* TESTES */}
        <div className="mb-4">
          <h2 className="font-bold border-b mb-2">TESTES</h2>

          <p>
            <strong>Ishihara:</strong>{" "}
            {dados?.testes?.ishihara}
          </p>

          <p>
            <strong>Cromático:</strong>{" "}
            {dados?.testes?.cromatico}
          </p>

          <p>
            <strong>Romberg:</strong>{" "}
            {dados?.testes?.romberg}
          </p>
        </div>

        {/* RODAPÉ */}
        <div className="absolute bottom-8 left-8 right-8 text-xs text-center">
          <p>
            Doctor's Saúde e Segurança no Trabalho LTDA
          </p>
          <p>
            {dados?.data || ""}
          </p>
        </div>
      </div>
    );
  }
);

TemplateFicha.displayName = "TemplateFicha";