create table if not exists public.pacientes_assinatura_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  paciente_assinatura_id uuid null references public.pacientes_assinatura(id) on delete set null,
  unidade_id uuid not null,
  nome_paciente text null,
  sequencial_ficha text null,
  acao text not null,
  observacao text null,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  usuario_email text null
);

create index if not exists pacientes_assinatura_logs_unidade_created_idx
  on public.pacientes_assinatura_logs (unidade_id, created_at desc);

create index if not exists pacientes_assinatura_logs_paciente_idx
  on public.pacientes_assinatura_logs (paciente_assinatura_id);

alter table public.pacientes_assinatura_logs enable row level security;

drop policy if exists "logs_aso_select_unidade" on public.pacientes_assinatura_logs;
create policy "logs_aso_select_unidade"
on public.pacientes_assinatura_logs
for select
to authenticated
using (
  unidade_id = (
    select profiles.unidade_id
    from public.profiles
    where profiles.id = auth.uid()
  )
);

drop policy if exists "logs_aso_insert_proprio_usuario" on public.pacientes_assinatura_logs;
create policy "logs_aso_insert_proprio_usuario"
on public.pacientes_assinatura_logs
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and unidade_id = (
    select profiles.unidade_id
    from public.profiles
    where profiles.id = auth.uid()
  )
);
