import { supabase } from "@/lib/supabase";
import React, { forwardRef, useEffect, useState } from "react";

export const TemplateFicha = forwardRef<any, any>(({ dados }, ref) => {
  const [form, setForm] = useState({
    razao_social: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    logo_url: "",
  });

  useEffect(() => {
    carregarUnidade();
  }, []);

  const carregarUnidade = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("unidade_id")
        .eq("id", user.id)
        .single();

      if (!profile?.unidade_id) return;

      const { data: unidadeData, error } = await supabase
        .from("unidades")
        .select("*")
        .eq("id", profile.unidade_id)
        .single();

      if (error) throw error;

      setForm({
        razao_social: unidadeData.razao_social || "",
        endereco: unidadeData.endereco || "",
        numero: unidadeData.numero || "",
        bairro: unidadeData.bairro || "",
        cidade: unidadeData.cidade || "",
        estado: unidadeData.estado || "",
        logo_url: unidadeData.logo_url || ""
      });
    } catch (error: any) {
      console.error(error.message);
    }
  };

  return (
    <div ref={ref} className="sheet text-[12px] flex flex-col h-full">

      {/* HEADER */}
      <header className="relative text-center mb-1">
        <div className="text-[2.45rem] font-extrabold uppercase tracking-wide">
          FICHA DE ATENDIMENTO
        </div>

        <div className="absolute right-0 top-1 text-[10px] text-gray-600">
          {new Date().toLocaleDateString("pt-BR")}
        </div>
      </header>

      {/* EMPRESA */}
      <section className="border border-black rounded p-2 mb-2">
        <div className="font-bold text-[11px] uppercase">EMPRESA</div>

        <div className="grid grid-cols-12 gap-1">
          <div className="col-span-8">
            <label className="text-[10px] font-semibold">Razão Social:</label>
            <div className="border border-black rounded p-1 text-[11px]">
              {dados?.empresa?.codigo_empresa} - {dados?.empresa?.razao_social}
            </div>
          </div>

          <div className="col-span-4">
            <label className="text-[10px] font-semibold">CNPJ:</label>
            <div className="border border-black rounded p-1 text-[11px]">
              {dados?.empresa?.cnpj}
            </div>
          </div>

        </div>
      </section>

      {/* FUNCIONÁRIO */}
      <section className="border border-black rounded p-2 mb-2">
        <div className="font-bold text-[11px] uppercase mb-1">
          FUNCIONÁRIO
        </div>

        <table className="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td className="w-1/2 border border-black p-1 align-top">
                <div><strong>NOME:</strong> {dados?.funcionario?.nome}</div>
                <div><strong>CARGO:</strong> {dados?.funcionario?.cargo}</div>
                <div><strong>TIPO DE EXAME:</strong> {dados?.exame?.tipo || dados?.tipo}</div>
              </td>

              <td className="w-1/2 border border-black p-1 align-top">
                <div><strong>DT. NASCIMENTO:</strong> {dados?.funcionario?.nascimento}</div>
                <div><strong>SETOR:</strong> {dados?.funcionario?.setor}</div>
                <div><strong>SEQUENCIAL:</strong> {dados?.sequencial}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* EXAMES */}
      <section className="border border-black rounded p-2 mb-2">
        <div className="font-bold text-[11px] uppercase mb-1">
          AVALIAÇÃO CLÍNICA E EXAMES REALIZADOS
        </div>

        <table className="w-full border-collapse text-[11px] ">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-1 w-[15%]">Data</th>
              <th className="border border-black p-1 w-[35%]">Exame</th>
              <th className="border border-black p-1 w-[15%]">Data</th>
              <th className="border border-black p-1 w-[35%]">Exame</th>
            </tr>
          </thead>

          <tbody>
            {dados?.exames?.length ? (
              Array.from({ length: Math.ceil(dados.exames.length / 2) }).map((_, i) => {
                const e1 = dados.exames[i * 2];
                const e2 = dados.exames[i * 2 + 1];

                const formatarNome = (texto: string) =>
                  texto
                    ?.toLowerCase()
                    .split(" ")
                    .map(p =>
                      p.charAt(0).toUpperCase() + p.slice(1)
                    )
                    .join(" ");

                return (
                  <tr key={i}>
                    {/* PRIMEIRO EXAME */}
                    <td className="border border-black px-1">
                      {e1?.data || ""}
                    </td>
                    <td className="border border-black px-1">
                      {formatarNome(e1?.exame || "")}
                    </td>

                    {/* SEGUNDO EXAME */}
                    <td className="border border-black px-1">
                      {e2?.data || ""}
                    </td>
                    <td className="border border-black px-1">
                      {formatarNome(e2?.exame || "")}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="text-center border border-black p-2">
                  Sem exames registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* TRIAGEM */}
      <section className="border border-black rounded p-2 mb-2">
        <div className="font-bold text-[11px] uppercase">
          TRIAGEM
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-semibold">PA:</label>
            <div className="border border-black p-2 rounded"></div>
          </div>

          <div>
            <label className="text-[10px] font-semibold">ALTURA:</label>
            <div className="border border-black p-2 rounded"></div>
          </div>

          <div>
            <label className="text-[10px] font-semibold">PESO:</label>
            <div className="border border-black p-2 rounded"></div>
          </div>
        </div>
      </section>

      {/* ACUIDADE VISUAL */}
      <section className="border border-black rounded p-2 mb-2">
        <div className="font-bold text-[11px] uppercase mb-1">
          ACUIDADE VISUAL
        </div>

        <div className="grid grid-cols-2 gap-2">

          {/* SNELLEN */}
          <div className="border border-gray-500 border-dashed rounded p-2 bg-gray-50">
            <div className="font-bold text-[11px] mb-1">
              SNELLEN (PARA LONGE)
            </div>

            <div className="mb-3">
              <div className="text-[12px]">SEM LENTES CORRETIVAS</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] font-semibold">OD:</label>
                  <div className="border border-black px-1 rounded">20/</div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold">OE:</label>
                  <div className="border border-black px-1 rounded">20/</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12px]">COM LENTES CORRETIVAS</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] font-semibold">OD:</label>
                  <div className="border border-black px-1 rounded">20/</div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold">OE:</label>
                  <div className="border border-black px-1 rounded">20/</div>
                </div>
              </div>
            </div>
          </div>

          {/* JAEGER */}
          <div className="border border-gray-500 border-dashed rounded p-2 bg-gray-50">
            <div className="font-bold text-[11px] mb-1">
              JAEGER (PARA PERTO)
            </div>

            <div className="mb-3">
              <div className="text-[12px]">SEM LENTES CORRETIVAS</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] font-semibold">OD:</label>
                  <div className="border border-black h-5 rounded"></div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold">OE:</label>
                  <div className="border border-black h-5 rounded"></div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12px]">COM LENTES CORRETIVAS</div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[10px] font-semibold">OD:</label>
                  <div className="border border-black h-5 rounded"></div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold">OE:</label>
                  <div className="border border-black h-5 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="mb-3">
            <div className="font-bold text-[11px] mb-1">TESTE DE ISHIHARA</div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Normal</label>
              </div>
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Alterado</label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[11px] mb-1">TESTE CROMÁTICO
              (VERDE/VERMELHO/AMARELO)</div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Normal</label>
              </div>
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Alterado</label>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <div className="font-bold text-[11px] mb-1">ROMBERG</div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Positivo</label>
              </div>
              <div className="flex items-center gap-1">
                <div className="border border-black h-5 w-5 rounded"></div>
                <label className="text-[11px] font-semibold">Negativo</label>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="font-bold text-[11px]">DUM:</label>
          <div className="border border-black p-2 rounded">{dados?.triagem?.pa}</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-[10px] mt-auto">
        <div className="mb-2">
          {form.logo_url && (
            <img
              src={form.logo_url}
              className="max-h-[90px] mx-auto"
            />
          )}
        </div>

        <div className="font-bold text-[11px] uppercase">
          {form.razao_social}
        </div>

        <div className="text-[10px]">
          {`${form.endereco}, ${form.numero}, ${form.bairro}, ${form.cidade}, ${form.estado}`}
        </div>
      </footer>

    </div>
  );
});

TemplateFicha.displayName = "TemplateFicha";