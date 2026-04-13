"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const schema = z.object({
  fname: z.string().min(2, "Nome muito curto"),
  lname: z.string().min(2, "Sobrenome muito curto"),
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(6, "Mínimo 6 caracteres")
    .regex(/[A-Z]/, "Precisa de letra maiúscula")
    .regex(/[0-9]/, "Precisa de número"),
});

type FormData = z.infer<typeof schema>;

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.fname,
            last_name: data.lname,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Conta criada com sucesso!");
    } catch {
      toast.error("Erro inesperado");
    }
  }

  return (
    <div className="w-full flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-bold">Criar conta</h1>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-6 space-y-4">

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input placeholder="Nome" {...register("fname")} />
                  {errors.fname && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.fname.message}
                    </p>
                  )}
                </div>

                <div>
                  <Input placeholder="Sobrenome" {...register("lname")} />
                  {errors.lname && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.lname.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Input placeholder="Email" {...register("email")} />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  {...register("password")}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>

                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button className="w-full h-11 hover:opacity-90" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  "Criar conta"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/signin" className="text-primary underline">
                Entrar
              </Link>
            </p>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}