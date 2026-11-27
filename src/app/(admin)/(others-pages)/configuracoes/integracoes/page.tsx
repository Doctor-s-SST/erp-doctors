"use client";

/**
 * Configurações > Integrações: dados do web service do SOC e dos Exporta Dados
 * da unidade, usados pelas integrações automáticas.
 *
 * Segredos (chave de acesso do WS-Security e chaves dos Exporta Dados) nunca
 * voltam para o navegador: get_integracao_soc devolve só se estão definidos e os
 * 4 últimos caracteres; salvar_integracao_soc mantém o valor atual quando nada
 * novo é enviado.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Pencil, Plug, Plus, RefreshCw, RotateCcw, Save, Trash2, X, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { mensagemErroConfiguracao } from "../utils";

/** Exporta Dados usados pelo sistema (identificador fixo). */
const EXPORTA_DADOS_PADRAO = [
    {
        identificador: "agendados_agenda",
        nome: "Listagem de funcionários com atendimento em uma agenda",
        uso: "Lista de agendados do dia.",
    },
    {
        identificador: "agendamentos_funcionario",
        nome: "Agendamentos Futuros do Funcionário",
        uso: "Horário e código de cada agendamento.",
    },
    {
        identificador: "pedido_exame",
        nome: "Pedido de Exame",
        uso: "Sequencial da ficha e busca por CPF.",
    },
];

const PADRAO_POR_IDENTIFICADOR = new Map(EXPORTA_DADOS_PADRAO.map((e) => [e.identificador, e]));

/** Outros web services do SOC: só a URL do WSDL (gravada em integracao_soc.ws_urls). */
const OUTROS_WEBSERVICES = [
    {
        identificador: "socged",
        nome: "SOCGED",
        descricao: "Consulta, envio e alteração de documentos no GED.",
        placeholder: "endereço do WSDL do SOCGED",
    },
    {
        identificador: "download_arquivos",
        nome: "Download de Arquivos",
        descricao: "Download dos arquivos do GED.",
        placeholder: "endereço do WSDL do Download de Arquivos",
    },
];

// ---------------------------------------------------------------- segredo

/** Estado de um campo secreto na tela. */
interface Segredo {
    /** Já existe valor salvo no banco. */
    salvo: boolean;
    /** Últimos 4 caracteres do valor salvo. */
    final: string | null;
    /** Valor novo digitado (só enviado quando editando). */
    novo: string;
    editando: boolean;
    remover: boolean;
}

function segredoDoBanco(definido: boolean, final: string | null): Segredo {
    return { salvo: definido, final, novo: "", editando: !definido, remover: false };
}

/** O que mandar ao salvar: valor novo, pedido de remoção ou nada (mantém). */
function envioDoSegredo(s: Segredo): { valor: string | null; limpar: boolean } {
    if (s.remover) return { valor: null, limpar: true };
    if (s.editando && s.novo.trim()) return { valor: s.novo.trim(), limpar: false };
    return { valor: null, limpar: false };
}

/**
 * Campo de senha/chave: salvo aparece como "•••• 1a2b" com Alterar e Remover;
 * ao alterar, abre o campo vazio (Cancelar volta ao salvo).
 */
function CampoSegredo({
    valor,
    onChange,
    placeholder,
    altura = "h-11",
}: {
    valor: Segredo;
    onChange: (s: Segredo) => void;
    placeholder: string;
    altura?: string;
}) {
    if (valor.salvo && valor.remover) {
        return (
            <div className={`flex ${altura} items-center justify-between gap-2 rounded-md border border-dashed border-red-300 bg-red-50 px-3 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300`}>
                <span>Será removida ao salvar</span>
                <button
                    type="button"
                    onClick={() => onChange({ ...valor, remover: false })}
                    className="flex items-center gap-1 font-bold hover:underline"
                >
                    <RotateCcw className="h-3 w-3" /> Desfazer
                </button>
            </div>
        );
    }

    if (valor.salvo && !valor.editando) {
        return (
            <div className={`flex ${altura} items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800/60`}>
                <span className="flex min-w-0 items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="font-mono text-sm tracking-widest text-slate-700 dark:text-slate-200">••••{valor.final ?? ""}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Salva
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onChange({ ...valor, editando: true, novo: "" })}
                        title="Alterar"
                        className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-bold uppercase text-slate-600 hover:bg-gray-200 dark:text-slate-300 dark:hover:bg-gray-700"
                    >
                        <Pencil className="h-3 w-3" /> Alterar
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange({ ...valor, remover: true })}
                        title="Remover"
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <Input
                type="password"
                autoComplete="new-password"
                value={valor.novo}
                autoFocus={valor.salvo}
                onChange={(e) => onChange({ ...valor, novo: e.target.value })}
                placeholder={valor.salvo ? "nova chave" : placeholder}
                className={altura}
            />
            {valor.salvo && (
                <button
                    type="button"
                    onClick={() => onChange({ ...valor, editando: false, novo: "" })}
                    title="Cancelar e manter a salva"
                    className="rounded p-2 text-slate-400 hover:bg-gray-100 hover:text-slate-700 dark:hover:bg-gray-800"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

// ---------------------------------------------------------------- tipos

interface ConfigSalva {
    empresa_principal: string | null;
    codigo_responsavel: string | null;
    codigo_usuario: string | null;
    ws_username: string | null;
    ws_url: string | null;
    ws_urls: Record<string, string> | null;
    ws_senha_definida: boolean;
    ws_senha_final: string | null;
    codigo_usuario_agenda: string | null;
    updated_at: string | null;
}

interface ExportaDadosSalvo {
    id: string;
    identificador: string;
    nome: string;
    codigo: string | null;
    chave_definida: boolean;
    chave_final: string | null;
    ativo: boolean;
    observacao: string | null;
}

interface LinhaExportaDados {
    chaveLinha: string;
    identificador: string;
    nome: string;
    codigo: string;
    chave: Segredo;
    ativo: boolean;
    observacao: string;
    salvo: boolean;
}

interface Sincronizacao {
    id: string;
    created_at: string;
    situacao: string | null;
    quantidade: number | null;
    resultado: { gravados?: number; removidos?: number } | null;
    erros: unknown[] | null;
    erro: string | null;
}

function linhaVazia(identificador = ""): LinhaExportaDados {
    return {
        chaveLinha: `${identificador || "novo"}-${Math.random().toString(36).slice(2)}`,
        identificador,
        nome: "",
        codigo: "",
        chave: segredoDoBanco(false, null),
        ativo: true,
        observacao: "",
        salvo: false,
    };
}

function formatarDataHora(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const ROTULO = "text-[10px] font-black uppercase text-slate-500";
const DICA = "mt-1 text-[10px] text-slate-400";

// ---------------------------------------------------------------- página

export default function IntegracoesPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [empresaPrincipal, setEmpresaPrincipal] = useState("");
    const [codigoResponsavel, setCodigoResponsavel] = useState("");
    const [codigoUsuario, setCodigoUsuario] = useState("");
    const [wsUsername, setWsUsername] = useState("");
    const [wsSenha, setWsSenha] = useState<Segredo>(segredoDoBanco(false, null));
    const [wsUrl, setWsUrl] = useState("");
    const [wsUrls, setWsUrls] = useState<Record<string, string>>({});
    const [codigoAgenda, setCodigoAgenda] = useState("");
    const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

    const [linhas, setLinhas] = useState<LinhaExportaDados[]>([]);
    const [removidos, setRemovidos] = useState<string[]>([]);
    const [sincronizacoes, setSincronizacoes] = useState<Sincronizacao[] | null>(null);

    async function carregar() {
        try {
            const { data, error } = await supabase.rpc("get_integracao_soc");
            if (error) throw error;

            const config = (data?.config ?? null) as ConfigSalva | null;
            setEmpresaPrincipal(config?.empresa_principal ?? "");
            setCodigoResponsavel(config?.codigo_responsavel ?? "");
            setCodigoUsuario(config?.codigo_usuario ?? "");
            setWsUsername(config?.ws_username ?? "");
            setWsSenha(segredoDoBanco(!!config?.ws_senha_definida, config?.ws_senha_final ?? null));
            setWsUrl(config?.ws_url ?? "");
            setWsUrls(config?.ws_urls ?? {});
            setCodigoAgenda(config?.codigo_usuario_agenda ?? "");
            setAtualizadoEm(config?.updated_at ?? null);

            const salvos = (data?.exporta_dados ?? []) as ExportaDadosSalvo[];
            const porIdentificador = new Map(salvos.map((e) => [e.identificador, e]));
            const deSalvo = (e: ExportaDadosSalvo): LinhaExportaDados => ({
                chaveLinha: e.id,
                identificador: e.identificador,
                nome: e.nome,
                codigo: e.codigo ?? "",
                chave: segredoDoBanco(e.chave_definida, e.chave_final),
                ativo: e.ativo,
                observacao: e.observacao ?? "",
                salvo: true,
            });

            // Usados pelo sistema primeiro (mesmo os ainda não salvos), depois os demais.
            setLinhas([
                ...EXPORTA_DADOS_PADRAO.map((p) => {
                    const salvo = porIdentificador.get(p.identificador);
                    return salvo ? deSalvo(salvo) : linhaVazia(p.identificador);
                }),
                ...salvos.filter((e) => !PADRAO_POR_IDENTIFICADOR.has(e.identificador)).map(deSalvo),
            ]);
            setRemovidos([]);

            // Histórico existe depois da migração dos agendamentos.
            const { data: historico, error: erroHistorico } = await supabase
                .from("agendamentos_sincronizacoes")
                .select("id, created_at, situacao, quantidade, resultado, erros, erro")
                .order("created_at", { ascending: false })
                .limit(10);
            setSincronizacoes(erroHistorico ? null : ((historico || []) as Sincronizacao[]));
        } catch (error: unknown) {
            toast.error(mensagemErroConfiguracao(error));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        queueMicrotask(() => void carregar());
    }, []);

    function alterarLinha(chaveLinha: string, alteracao: Partial<LinhaExportaDados>) {
        setLinhas((atual) => atual.map((l) => (l.chaveLinha === chaveLinha ? { ...l, ...alteracao } : l)));
    }

    function removerLinha(linha: LinhaExportaDados) {
        if (linha.salvo && !confirm(`Excluir o Exporta Dados "${linha.nome}"? As integrações que usam "${linha.identificador}" deixam de funcionar.`)) return;
        setLinhas((atual) => atual.filter((l) => l.chaveLinha !== linha.chaveLinha));
        if (linha.salvo) setRemovidos((atual) => [...atual, linha.identificador]);
    }

    async function salvar() {
        // Padrão sem nada preenchido e ainda não salvo não é gravado; extras vazios são ignorados.
        const enviar = linhas.filter((l) => {
            if (l.salvo) return true;
            const preenchida = !!(l.codigo.trim() || l.chave.novo.trim());
            return PADRAO_POR_IDENTIFICADOR.has(l.identificador) ? preenchida : preenchida || !!l.nome.trim() || !!l.identificador.trim();
        });

        const identificadores = new Set<string>();
        for (const l of enviar) {
            const id = l.identificador.trim().toLowerCase();
            const nome = PADRAO_POR_IDENTIFICADOR.get(id)?.nome ?? l.nome.trim();
            if (!/^[a-z0-9_]{2,60}$/.test(id)) {
                toast.error(`Identificador inválido: "${l.identificador || "(vazio)"}". Use letras minúsculas, números e _.`);
                return;
            }
            if (!nome) {
                toast.error(`Informe o nome do Exporta Dados "${id}".`);
                return;
            }
            if (identificadores.has(id)) {
                toast.error(`Identificador repetido: "${id}".`);
                return;
            }
            identificadores.add(id);
        }

        setSaving(true);
        try {
            const senha = envioDoSegredo(wsSenha);
            const { error } = await supabase.rpc("salvar_integracao_soc", {
                p_config: {
                    empresa_principal: empresaPrincipal,
                    codigo_responsavel: codigoResponsavel,
                    codigo_usuario: codigoUsuario,
                    ws_username: wsUsername,
                    ws_senha: senha.valor,
                    limpar_ws_senha: senha.limpar,
                    ws_url: wsUrl,
                    ws_urls: wsUrls,
                    codigo_usuario_agenda: codigoAgenda,
                },
                p_exporta_dados: enviar.map((l) => {
                    const id = l.identificador.trim().toLowerCase();
                    const chave = envioDoSegredo(l.chave);
                    return {
                        identificador: id,
                        nome: PADRAO_POR_IDENTIFICADOR.get(id)?.nome ?? l.nome.trim(),
                        codigo: l.codigo.trim(),
                        chave: chave.valor,
                        limpar_chave: chave.limpar,
                        ativo: l.ativo,
                        observacao: l.observacao.trim(),
                    };
                }),
                p_remover: removidos,
            });
            if (error) throw error;

            toast.success("Integrações salvas!");
            await carregar();
        } catch (error: unknown) {
            toast.error(mensagemErroConfiguracao(error));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-fit mt-2 space-y-8 bg-gray-500/20 rounded-xl p-2">
            <div className="w-full mx-auto space-y-5">
                {/* HEADER */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row justify-between items-center gap-4 border border-gray-600">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-3 rounded-xl">
                            <Plug className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Integrações</h1>
                            <p className="text-gray-400 text-[11px] font-bold tracking-[0.2em] uppercase">SOC · web service e exporta dados</p>
                        </div>
                    </div>
                    <Button
                        onClick={salvar}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 text-xs font-black uppercase tracking-widest"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </Button>
                </div>

                {/* WEB SERVICE */}
                <Card className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm">
                    <CardContent className="space-y-5 p-4 sm:p-6">
                        <div>
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Web service do SOC</h2>
                            <p className="text-[11px] text-slate-500">
                                Chaves ficam só no banco e não podem ser vistas depois de salvas: aparecem apenas os 4 últimos caracteres.
                                {atualizadoEm && <> Atualizado em {formatarDataHora(atualizadoEm)}.</>}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className={ROTULO}>Empresa principal</label>
                                <Input value={empresaPrincipal} onChange={(e) => setEmpresaPrincipal(e.target.value)} placeholder="código da empresa principal" className="h-11" />
                            </div>
                            <div>
                                <label className={ROTULO}>Código do responsável</label>
                                <Input value={codigoResponsavel} onChange={(e) => setCodigoResponsavel(e.target.value)} placeholder="codigoResponsavel" className="h-11" />
                                <p className={DICA}>Responsável da empresa principal no SOC.</p>
                            </div>
                            <div>
                                <label className={ROTULO}>Código do usuário</label>
                                <Input value={codigoUsuario} onChange={(e) => setCodigoUsuario(e.target.value)} placeholder="codigoUsuario" className="h-11" />
                                <p className={DICA}>Usuário do web service na conta do SOC.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Autenticação do web service</p>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={ROTULO}>Username</label>
                                    <Input value={wsUsername} onChange={(e) => setWsUsername(e.target.value)} placeholder="username da integração" className="h-11" />
                                </div>
                                <div>
                                    <label className={ROTULO}>Chave de acesso</label>
                                    <CampoSegredo valor={wsSenha} onChange={setWsSenha} placeholder="chave de acesso do username" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div>
                                <label className={ROTULO}>Código do usuário Agenda</label>
                                <Input value={codigoAgenda} onChange={(e) => setCodigoAgenda(e.target.value)} placeholder="agenda da unidade" className="h-11" />
                                <p className={DICA}>Usado na sincronização de agendamentos. Vazio = não sincroniza.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* EXPORTA DADOS */}
                <Card className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm">
                    <CardContent className="space-y-4 p-4 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Exporta Dados</h2>
                                <p className="text-[11px] text-slate-500">
                                    Código e chave de cada Exporta Dados (tela 733 do SOC). As integrações localizam cada um pelo identificador.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLinhas((atual) => [...atual, linhaVazia()])}
                                className="h-9 text-[10px] font-bold uppercase tracking-widest"
                            >
                                <Plus className="w-3.5 h-3.5" /> Exporta Dados
                            </Button>
                        </div>

                        <div className="lg:max-w-2xl">
                            <label className={ROTULO}>URL do web service Exporta Dados</label>
                            <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="endereço do ExportaDadosWs" className="h-11" />
                            <p className={DICA}>Endereço usado em todas as chamadas de Exporta Dados abaixo.</p>
                        </div>

                        <div className="space-y-3">
                            {linhas.map((l) => {
                                const padrao = PADRAO_POR_IDENTIFICADOR.get(l.identificador);
                                return (
                                    <div key={l.chaveLinha} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                        {padrao ? (
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{padrao.nome}</span>
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800">{padrao.identificador}</span>
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                    Usado pelo sistema
                                                </span>
                                                <span className="text-[10px] text-slate-500">{padrao.uso}</span>
                                            </div>
                                        ) : (
                                            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <div>
                                                    <label className={ROTULO}>Nome</label>
                                                    <Input value={l.nome} onChange={(e) => alterarLinha(l.chaveLinha, { nome: e.target.value })} placeholder="nome do Exporta Dados" className="h-10" />
                                                </div>
                                                <div>
                                                    <label className={ROTULO}>Identificador</label>
                                                    <Input
                                                        value={l.identificador}
                                                        disabled={l.salvo}
                                                        onChange={(e) => alterarLinha(l.chaveLinha, { identificador: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                                                        placeholder="letras minúsculas, números e _"
                                                        className="h-10 font-mono text-xs"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.8fr_1.4fr_auto]">
                                            <div>
                                                <label className={ROTULO}>Código</label>
                                                <Input value={l.codigo} onChange={(e) => alterarLinha(l.chaveLinha, { codigo: e.target.value })} placeholder="código do Exporta Dados" className="h-10" />
                                            </div>
                                            <div>
                                                <label className={ROTULO}>Chave</label>
                                                <CampoSegredo
                                                    valor={l.chave}
                                                    onChange={(chave) => alterarLinha(l.chaveLinha, { chave })}
                                                    placeholder="chave do Exporta Dados"
                                                    altura="h-10"
                                                />
                                            </div>
                                            <div className="flex items-end gap-3 pb-1">
                                                <label className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
                                                    <Switch checked={l.ativo} onCheckedChange={(v) => alterarLinha(l.chaveLinha, { ativo: v })} />
                                                    Ativo
                                                </label>
                                                {!padrao && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removerLinha(l)}
                                                        aria-label="Excluir Exporta Dados"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* OUTROS WEB SERVICES */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {OUTROS_WEBSERVICES.map((ws) => (
                        <Card key={ws.identificador} className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm">
                            <CardContent className="space-y-3 p-4 sm:p-6">
                                <div>
                                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{ws.nome}</h2>
                                    <p className="text-[11px] text-slate-500">{ws.descricao}</p>
                                </div>
                                <div>
                                    <label className={ROTULO}>URL do WSDL</label>
                                    <Input
                                        value={wsUrls[ws.identificador] ?? ""}
                                        onChange={(e) => setWsUrls((atual) => ({ ...atual, [ws.identificador]: e.target.value }))}
                                        placeholder={ws.placeholder}
                                        className="h-11"
                                    />
                                    <p className={DICA}>Autenticação: username e chave de acesso do card Web service do SOC.</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* SINCRONIZAÇÕES */}
                <Card className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm">
                    <CardContent className="space-y-3 p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Sincronização de agendamentos</h2>
                                <p className="text-[11px] text-slate-500">Últimas execuções (7h, 12h e 17h, de segunda a sábado).</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => void carregar()} aria-label="Atualizar" className="h-8 w-8">
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>

                        {sincronizacoes === null ? (
                            <p className="text-xs text-slate-400">Disponível depois da migração dos agendamentos.</p>
                        ) : sincronizacoes.length === 0 ? (
                            <p className="text-xs text-slate-400">Nenhuma execução ainda.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 text-xs dark:divide-gray-800">
                                {sincronizacoes.map((s) => {
                                    const ok = s.situacao === "ok";
                                    const qtdErros = Array.isArray(s.erros) ? s.erros.length : 0;
                                    return (
                                        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                                            {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                                            <span className="font-bold">{formatarDataHora(s.created_at)}</span>
                                            <span className="text-slate-500">
                                                {ok
                                                    ? `${s.quantidade ?? 0} agendado(s) · ${s.resultado?.gravados ?? 0} gravado(s) · ${s.resultado?.removidos ?? 0} removido(s) do SOC`
                                                    : s.situacao === "falha_consulta"
                                                        ? "Falha ao consultar o SOC; nada gravado"
                                                        : `Erro ao gravar: ${s.erro ?? ""}`}
                                            </span>
                                            {qtdErros > 0 && <span className="text-amber-600">{qtdErros} aviso(s) na consulta</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
