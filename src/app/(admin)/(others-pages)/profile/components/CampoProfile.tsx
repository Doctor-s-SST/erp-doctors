import { Input } from "@/components/ui/input";

interface CampoProfileProps {
    label: string;
    value: string;
    className?: string;
}

export function CampoProfile({ label, value, className }: CampoProfileProps) {
    return (
        <div className={className || "space-y-2"}>
            <label className="text-[10px] font-black uppercase text-slate-500">{label}</label>
            <Input value={value} disabled className="h-12" />
        </div>
    );
}
