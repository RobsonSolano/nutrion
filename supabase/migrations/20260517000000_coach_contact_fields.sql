-- =====================================================================
-- NutriOn — Card do professor no perfil do aluno
--
-- Adiciona campos de contato em coaches e estende RLS pra que o aluno
-- possa ler os dados do seu próprio coach (via _auth_coach_id helper).
--
-- Cria/altera:
--   coaches.show_contact_to_students  bool default false
--   coaches.contact_phone             text (regex 10-13 dígitos, BR)
--   policy coaches_select_own_or_student (drop coaches_select_own)
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas em coaches
-- ---------------------------------------------------------------------
alter table public.coaches
  add column if not exists show_contact_to_students boolean not null default false,
  add column if not exists contact_phone text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'coaches_contact_phone_check'
  ) then
    alter table public.coaches
      add constraint coaches_contact_phone_check
      check (contact_phone is null or contact_phone ~ '^[0-9]{10,13}$');
  end if;
end $$;

comment on column public.coaches.show_contact_to_students is
  'Se true, alunos vinculados ao coach podem ler contact_phone via RLS.';
comment on column public.coaches.contact_phone is
  'Telefone com DDI+DDD+número, só dígitos (ex: 5511999999999 pra BR).';

-- ---------------------------------------------------------------------
-- 2. RLS: aluno lê o profile do seu coach
-- ---------------------------------------------------------------------
-- A policy original (coaches_select_own) só permitia auth.uid() = id.
-- Aluno precisa ler campos do seu coach pra renderizar o card no
-- perfil. Usamos _auth_coach_id() (SECURITY DEFINER, definido em
-- 20260513000000_fix_profiles_rls_recursion.sql) pra evitar recursão.

drop policy if exists "coaches_select_own" on public.coaches;
drop policy if exists "coaches_select_own_or_student" on public.coaches;
create policy "coaches_select_own_or_student" on public.coaches
  for select using (
    (select auth.uid()) = id
    or id = public._auth_coach_id()
  );
