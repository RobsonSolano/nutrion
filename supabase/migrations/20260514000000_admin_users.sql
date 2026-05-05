-- =====================================================================
-- NutriOn — Tabela admin_users + is_admin() + RLS de admin
-- Cria a base do painel administrativo. Admin é separado de profiles
-- (não é usuário do app). is_admin() é SECURITY DEFINER pra ser usado
-- em policies de outras tabelas.
-- =====================================================================

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Administradores do painel. Separado de profiles — admin não tem perfil de usuário do app.';

-- ---------------------------------------------------------------------
-- Função is_admin: usada em policies de outras tabelas
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where id = uid);
$$;

-- ---------------------------------------------------------------------
-- RLS na própria admin_users
-- ---------------------------------------------------------------------
alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own" on public.admin_users
  for select using (auth.uid() = id);

-- INSERT/UPDATE/DELETE: somente service_role (script de seed e edge functions futuras).

-- ---------------------------------------------------------------------
-- Policies de admin nas tabelas lidas pelo painel
-- ---------------------------------------------------------------------
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select using (public.is_admin(auth.uid()));

drop policy if exists "ai_usage_log_admin_read_all" on public.ai_usage_log;
create policy "ai_usage_log_admin_read_all" on public.ai_usage_log
  for select using (public.is_admin(auth.uid()));

drop policy if exists "coaches_admin_read_all" on public.coaches;
create policy "coaches_admin_read_all" on public.coaches
  for select using (public.is_admin(auth.uid()));

drop policy if exists "student_requests_admin_read_all" on public.student_requests;
create policy "student_requests_admin_read_all" on public.student_requests
  for select using (public.is_admin(auth.uid()));
