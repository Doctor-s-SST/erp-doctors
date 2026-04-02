import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Doctor's | Sistema de Gestão Integrada",
  description: "Sistema de Gestão Integrada para Doctor's Saúde e Segurança do Trabalho",
};

export default function Home() {

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-blue-900 mb-4">
        Bem-vindo ao Doctor's
      </h1>
      <p className="text-lg text-gray-700 mb-8 text-center max-w-xl">
        Sistema de Gestão Integrada para Doctor's Saúde e Segurança do Trabalho. Gerencie seus processos de forma eficiente e segura.
      </p>
      {/* <div className="flex space-x-4">
        <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Acessar Módulos
        </button>
        <button className="px-6 py-2 bg-gray-200 text-blue-900 rounded hover:bg-gray-300 transition">
          Saiba Mais
        </button>
      </div> */}
    </main>
  );
}
