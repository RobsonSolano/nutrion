-- =====================================================================
-- NutriOn — Área do Professor (sub-feature 1: Auth + role)
-- Adiciona:
--   profiles.role     ('comum' | 'aluno' | 'professor')
--   profiles.coach_id (FK pra profiles, só pra alunos)
--   coaches           (dados específicos do professor)
--   guard_role_changes() — trigger que bloqueia o user de mudar o
--                          próprio role/coach_id via cliente (escalada
--                          de privilégio). Mudança só via service_role.
--   RLS coaches: leitura própria + leitura do coach pelo aluno
--   RLS profiles: aluno lê o full_name/avatar do seu coach
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.role + profiles.coach_id
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'comum',
  add column if not exists coach_id uuid;

-- Constraint só é criada se ainda não existir (idempotência).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('comum','aluno','professor'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_coach_id_fk'
  ) then
    alter table public.profiles
      add constraint profiles_coach_id_fk
      foreign key (coach_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists profiles_coach_id_idx
  on public.profiles (coach_id) where coach_id is not null;
create index if not exists profiles_role_idx
  on public.profiles (role) where role <> 'comum';

comment on column public.profiles.role is
  'comum (default — usuário direto do app) | aluno (cadastrado por professor) | professor (signup-professor).';
comment on column public.profiles.coach_id is
  'FK pro professor responsável. Só preenchido quando role=aluno.';

-- ---------------------------------------------------------------------
-- 2. tabela coaches (1:1 com profiles quando role=professor)
-- ---------------------------------------------------------------------
create table if not exists public.coaches (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  cref text,
  max_students int not null default 20 check (max_students > 0),
  created_at timestamptz not null default now()
);

comment on table public.coaches is
  'Dados específicos de profile.role=professor (bio, registro profissional, limite de alunos).';

alter table public.coaches enable row level security;

-- Professor lê os próprios dados.
drop policy if exists "coaches_select_own" on public.coaches;
create policy "coaches_select_own" on public.coaches
  for select using (auth.uid() = id);

-- Professor atualiza os próprios dados (bio, cref). max_students só via
-- service_role (admin).
drop policy if exists "coaches_update_own" on public.coaches;
create policy "coaches_update_own" on public.coaches
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- INSERT só via service_role (edge function signup-professor).

-- ---------------------------------------------------------------------
-- 3. RLS profiles: aluno pode ler o profile do seu coach
--    (precisa do full_name/avatar_url pra mostrar "Seu professor: X")
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (
    auth.uid() = id
    or id = (select p.coach_id from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 4. Trigger anti-escalada: usuário authenticated NÃO pode mudar o
--    próprio role/coach_id. Mudança só pela edge function (service_role).
--    Trigger silenciosamente reverte os valores em vez de levantar erro
--    (mais robusto a updates parciais que enviam o objeto inteiro).
-- ---------------------------------------------------------------------
create or replace function public.guard_role_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role bypassa RLS e dispara o trigger com role='service_role'.
  -- authenticated/anon: força os valores antigos, ignorando o que veio.
  if auth.role() <> 'service_role' then
    new.role := old.role;
    new.coach_id := old.coach_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role_changes on public.profiles;
create trigger profiles_guard_role_changes
  before update on public.profiles
  for each row execute function public.guard_role_changes();

-- ---------------------------------------------------------------------
-- 5. is_early_adopter: alunos NÃO contam (goodwill é só pra usuários
--    diretos do app). user_number continua sequencial pra todos.
-- ---------------------------------------------------------------------
alter table public.profiles
  drop column if exists is_early_adopter;
alter table public.profiles
  add column is_early_adopter boolean
    generated always as (user_number <= 100 and role <> 'aluno') stored;
