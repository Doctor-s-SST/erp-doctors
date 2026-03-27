"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Digite sua senha"),
});

type FormData = z.infer<typeof schema>;

export default function SignInForm() {
  const router = useRouter();
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      // Busca o role do usuário na tabela profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, especialidade_id')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        toast.error("Erro ao carregar perfil");
        return;
      }

      toast.success("Login realizado!");

      // 2. Redirecionamento condicional
      if (profile.role === 'admin') {
        router.push("/sistema-filas/kanban");
      }
      else if (profile.role === 'recepcao') {
        router.push("/sistema-filas/senhas-recepcao");
      }
      else if (profile.role === 'especialista') {
        // Se tiver uma especialidade, manda para a fila dela, senão para a geral
        if (profile.especialidade_id) {
          router.push(`/sistema-filas/filas/${profile.especialidade_id}`);
        } else {
          router.push("/sistema-filas/filas");
        }
      }

      router.refresh();
    } catch {
      toast.error("Erro inesperado");
    }
  }

  return (
    <div className=" w-full flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-bold">Entrar</h1>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-6 space-y-4">

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

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

              <Button className="w-full h-11" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link href="/signup" className="text-primary">
                Criar conta
              </Link>
            </p>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}