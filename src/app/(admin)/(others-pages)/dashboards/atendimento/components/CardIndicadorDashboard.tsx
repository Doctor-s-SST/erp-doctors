import { Card, CardContent } from "@/components/ui/card";

interface CardIndicadorDashboardProps {
    titulo: string;
    valor: number;
}

export function CardIndicadorDashboard({ titulo, valor }: CardIndicadorDashboardProps) {
    return (
        <Card className="border-gray-200 dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="p-4">
                <div className="flex w-full flex-col items-center gap-1">
                    <p className="mb-1 text-base font-black uppercase tracking-widest text-gray-700 dark:text-gray-400">
                        {titulo}
                    </p>
                    <p className="text-4xl font-black italic leading-none tracking-tight text-gray-900 dark:text-white">
                        {valor}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
