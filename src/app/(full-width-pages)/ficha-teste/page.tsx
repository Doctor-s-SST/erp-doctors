'use client'

import { TemplateFicha } from "@/components/atendimento/ficha-impressao/TemplateFicha"

export default function FichaTeste() {
    const dados = {
        empresa: {
            razao_social: "Empresa XYZ LTDA",
            cnpj: "12.345.678/0001-90"
        },
        funcionario: {
            nome: "João da Silva",
            rg: "12.345.678-9",
            nascimento: "01/01/1990",
            cargo: "Médico",
            setor: "Clínico",
            cpf: "123.456.789-00"
        },
        exame: {
            tipo: "Exame de Sangue"
        },
        exames: [
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Hemograma" },
            { exame: "Glicose" }
        ],
        especialidadesSelecionadas: [1, 2],
        observacao: "Paciente com histórico de diabetes."
    }

    return (
        <TemplateFicha dados={dados} />
    )
}