export function senhaTemplate({
  senha,
  // tipo,
  // guiche,
}: {
  senha: string;
  // tipo: string;
  // guiche: string;
}) {
  const agora = new Date();

  const dataHora =
    agora.toLocaleDateString("pt-BR") +
    " " +
    agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return [
    {
      value: "DOCTOR'S SAÚDE E SEGURANÇA NO TRABALHO\n\n\n",
      align: "center",
      bold: true,
    },

    // {
    //   value: `SENHA ${tipo}`,
    //   align: "center",
    //   bold: true,
    //   br: 1,
    // },

    {
      value: `${senha}\n\n\n`,
      align: "center",
      bold: true,
      size: "double",
      br: 2,
    },

    // {
    //   value: `Guichê: ${guiche}`,
    //   align: "center",
    // },

    {
      value: dataHora,
      align: "center",
      br: 2,
    },
  ];
}