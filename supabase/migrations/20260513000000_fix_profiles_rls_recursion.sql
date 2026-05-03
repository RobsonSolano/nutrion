-- =====================================================================
-- NutriOn — Fix RLS recursão em profiles
-- A policy "profiles_select_own" da migration 20260505 fazia subquery
-- na própria tabela profiles pra descobrir o coach_id do caller. Como
-- o subquery dispara a mesma policy, o postgres detecta loop infinito
-- e bloqueia toda leitura com:
--   "infinite recursion detected in policy for relation profiles"
--
-- Resultado: nenhum query em profiles funcionava no app pra aluno
-- (que precisa ler o profile do coach).
--
-- Solução: helper SECURITY DEFINER que lê profiles bypassando RLS,
-- então a policy chama a função em vez de fazer subquery direto.
-- =====================================================================

-- Helper privada, lê o coach_id do user logado sem aplicar RLS de novo.
create or replace function public._auth_coach_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select coach_id from public.profiles where id = auth.uid()
$$;

comment on function public._auth_coach_id() is
  'Helper interno usado por RLS policies que precisam saber o coach_id do auth.uid() atual sem causar recursão. SECURITY DEFINER pula a RLS de profiles.';

-- Recria a policy de SELECT usando a função.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (
    auth.uid() = id
    or id = public._auth_coach_id()
    or coach_id = auth.uid()
  );
