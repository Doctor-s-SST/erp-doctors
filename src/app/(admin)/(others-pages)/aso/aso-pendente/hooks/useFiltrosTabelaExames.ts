import { useCallback, useState } from "react";
import type { GrupoFiltroExames } from "../components/FiltroGrupoExames";
import type { FiltroPrazoAso } from "../components/FiltroPrazoCards";

/** Estado compartilhado pelos filtros das listas de exames pendentes e concluídos. */
export function useFiltrosTabelaExames() {
    const [busca, setBusca] = useState("");
    const [filtroMedico, setFiltroMedico] = useState("todos");
    const [filtroExameEspecifico, setFiltroExameEspecifico] = useState("todos");
    const [filtroPrestador, setFiltroPrestador] = useState("todos");
    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");
    const [grupoExames, setGrupoExames] = useState<GrupoFiltroExames | null>(null);
    const [filtroPrazoAso, setFiltroPrazoAso] = useState<FiltroPrazoAso>("todos");

    const limparFiltros = useCallback(() => {
        setBusca("");
        setFiltroMedico("todos");
        setFiltroExameEspecifico("todos");
        setFiltroPrestador("todos");
        setDataInicio("");
        setDataFim("");
        setGrupoExames(null);
        setFiltroPrazoAso("todos");
    }, []);

    return {
        busca,
        setBusca,
        filtroMedico,
        setFiltroMedico,
        filtroExameEspecifico,
        setFiltroExameEspecifico,
        filtroPrestador,
        setFiltroPrestador,
        dataInicio,
        setDataInicio,
        dataFim,
        setDataFim,
        grupoExames,
        setGrupoExames,
        filtroPrazoAso,
        setFiltroPrazoAso,
        limparFiltros,
    };
}
