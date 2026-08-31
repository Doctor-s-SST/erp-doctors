import { NextResponse } from "next/server";
import { createClient } from "@/lib/server-supabase";

export interface AuthContext {
    authorized: true;
    user: { id: string; email?: string };
    profile: {
        id: string;
        role?: string;
        unidade_id?: string;
        ativo?: boolean;
    } | null;
    isAdmin: boolean;
    unidadeId: string;
}

export interface AuthContextError {
    authorized: false;
    response: NextResponse;
}

export type AuthResult = AuthContext | AuthContextError;

/**
 * Valida a autenticação e autorização server-side para Route Handlers (/api/*).
 * Garante que apenas usuários logados e ativos acessem a API
 * e isola estritamente o acesso a dados pela unidade_id do perfil, sem exceções.
 */
export async function getAuthSession(): Promise<AuthResult> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: "Não autorizado: faça login para continuar." },
                    { status: 401 }
                ),
            };
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("id, role, unidade_id, ativo")
            .eq("id", user.id)
            .maybeSingle();

        if (profile && profile.ativo === false) {
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: "Acesso negado: usuário inativo." },
                    { status: 403 }
                ),
            };
        }

        // Sem exceções: todos usam estritamente a unidade vinculada ao seu perfil
        const unidadeId = profile?.unidade_id;

        if (!unidadeId) {
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: "Acesso negado: usuário não possui unidade vinculada." },
                    { status: 403 }
                ),
            };
        }

        const isAdmin = profile?.role === "admin";

        return {
            authorized: true,
            user: { id: user.id, email: user.email },
            profile,
            isAdmin,
            unidadeId,
        };
    } catch (error) {
        console.error("Erro ao validar sessão na API:", error);
        return {
            authorized: false,
            response: NextResponse.json(
                { error: "Erro interno de autenticação." },
                { status: 500 }
            ),
        };
    }
}