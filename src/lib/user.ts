import * as z from "zod";

export const userFormSchema = z.object({
  full_name: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres" }),
  // Removi o objeto de configuração que estava dando erro de propriedade desconhecida
  role: z.union([
    z.literal("admin"),
    z.literal("recepcao"),
    z.literal("especialista")
  ]),
  especialidade_id: z.string().min(1, { message: "Selecione uma especialidade" }),
});

export type UserFormValues = z.infer<typeof userFormSchema>;