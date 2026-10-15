import { useCallback, useEffect, useState } from "react";

/** Mantém um conjunto de identificadores sincronizado com o localStorage. */
export function useConjuntoPersistido(chave: string | null, descricao: string) {
    const [itens, setItens] = useState<Set<string>>(new Set());

    useEffect(() => {
        let ativo = true;
        queueMicrotask(() => {
            if (!ativo) return;
            if (!chave) {
                setItens(new Set());
                return;
            }
            try {
                const armazenados = JSON.parse(localStorage.getItem(chave) || "[]");
                setItens(new Set(Array.isArray(armazenados) ? armazenados : []));
            } catch {
                setItens(new Set());
            }
        });
        return () => { ativo = false; };
    }, [chave]);

    const adicionar = useCallback((novosItens: string[]) => {
        if (!chave) return;
        setItens(anteriores => {
            const atualizados = new Set(anteriores);
            novosItens.forEach(item => atualizados.add(item));
            try {
                localStorage.setItem(chave, JSON.stringify([...atualizados]));
            } catch (error) {
                console.warn(`Não foi possível persistir ${descricao}:`, error);
            }
            return atualizados;
        });
    }, [chave, descricao]);

    return { itens, adicionar };
}
