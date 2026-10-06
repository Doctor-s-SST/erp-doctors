import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Save, Send } from "lucide-react";

type Acao = "salvar" | "enviar" | "concluido";

interface ConfirmarAcaoDialogProps {
    acao: Acao | null;
    quantidade: number;
    onOpenChange: (open: boolean) => void;
    onConfirmar: () => void;
}

export function ConfirmarAcaoDialog({ acao, quantidade, onOpenChange, onConfirmar }: ConfirmarAcaoDialogProps) {
    const isEnvio = acao === "enviar";
    const isConcluido = acao === "concluido";
    const Icon = isConcluido ? CheckCircle2 : isEnvio ? Send : Save;
    const corIcone = isConcluido
        ? "bg-orange-500/10 text-orange-600"
        : isEnvio
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-blue-500/10 text-blue-600";
    const corBotao = isConcluido
        ? "bg-orange-500 text-white hover:bg-orange-600"
        : isEnvio
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-blue-600 text-white hover:bg-blue-700";

    return (
        <Dialog open={acao !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className={`mb-1 flex h-10 w-10 items-center justify-center rounded-full ${corIcone}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <DialogTitle>
                        {isConcluido
                            ? "Confirmar atendimento concluído"
                            : isEnvio
                                ? "Confirmar envio dos ASOs"
                                : "Confirmar salvamento"}
                    </DialogTitle>
                    <DialogDescription>
                        {isConcluido
                            ? `Deseja marcar ${quantidade} atendimento(s) selecionado(s) como concluído(s)?`
                            : isEnvio
                                ? `Deseja enviar ${quantidade} ASO(s) selecionado(s)?`
                                : `Deseja salvar ${quantidade} funcionário(s) selecionado(s)?`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={onConfirmar} className={corBotao}>
                        <Icon className="h-4 w-4" />
                        {isConcluido ? "Confirmar conclusão" : isEnvio ? "Confirmar envio" : "Confirmar salvamento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
