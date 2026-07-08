import { Card } from "@/components/ui/card"

interface Props{

    titulo:string;

    valor:string|number;

    subtitulo?:string;

    icon:any;

}

export function CardIndicador({

    titulo,

    valor,

    subtitulo,

    icon

}:Props){

    return(

        <Card className="p-5">

            <div className="flex justify-between">

                <div>

                    <p className="text-xs uppercase font-semibold text-muted-foreground">

                        {titulo}

                    </p>

                    <h2 className="text-3xl font-bold mt-2">

                        {valor}

                    </h2>

                    {

                        subtitulo && (

                            <p className="text-xs text-muted-foreground mt-2">

                                {subtitulo}

                            </p>

                        )

                    }

                </div>

                <div className="text-primary">

                    {icon}

                </div>

            </div>

        </Card>

    )

}