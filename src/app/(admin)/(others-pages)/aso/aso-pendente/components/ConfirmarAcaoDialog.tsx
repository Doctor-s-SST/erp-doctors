import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, Send } from "lucide-react";

type Acao = "salvar" | "enviar";

interface ConfirmarAcaoDialogProps {
    acao: Acao | null;
    quantidade: number;
    onOpenChange: (open: boolean) => void;
    onConfirmar: () => void;
}

export function ConfirmarAcaoDialog({ acao, quantidade, onOpenChange, onConfirmar }: ConfirmarAcaoDialogProps) {
    const isEnvio = acao === "enviar";
    const Icon = isEnvio ? Send : Save;

    return (
        <Dialog open={acao !== null} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className={`mb-1 flex h-10 w-10 items-center justify-center rounded-full ${isEnvio ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <DialogTitle>{isEnvio ? "Confirmar envio dos ASOs" : "Confirmar salvamento"}</DialogTitle>
                    <DialogDescription>
                        {isEnvio
                            ? `Deseja enviar ${quantidade} ASO(s) selecionado(s)?`
                            : `Deseja salvar ${quantidade} funcionário(s) selecionado(s)?`}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="button" onClick={onConfirmar} className={isEnvio ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-blue-600 text-white hover:bg-blue-700"}>
                        <Icon className="h-4 w-4" />
                        {isEnvio ? "Confirmar envio" : "Confirmar salvamento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
