-- =====================================================================
-- NutriOn — Área do Professor (sub-feature 2: cadastro de aluno + plano IA)
-- Adiciona:
--   workout_routines.created_by_coach   — sinal informativo + base pra
--                                         RLS de lock (sub-feature 3)
--   ai_usage_log.feature                — agora aceita 'coach_plan'
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. workout_routines.created_by_coach
-- ---------------------------------------------------------------------
alter table public.workout_routines
  add column if not exists created_by_coach uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_routines_coach_fk'
  ) then
    alter table public.workout_routines
      add constraint workout_routines_coach_fk
      foreign key (created_by_coach) references public.coaches(id) on delete set null;
  end if;
end $$;

create index if not exists workout_routines_coach_idx
  on public.workout_routines (created_by_coach)
  where created_by_coach is not null;

comment on column public.workout_routines.created_by_coach is
  'Quando preenchido, indica que a rotina foi criada pelo professor pra um aluno. Sub-feature 3 adiciona RLS de lock impedindo o aluno de editar.';

-- ---------------------------------------------------------------------
-- 2. ai_usage_log: aceita feature='coach_plan' (geração de plano pelo
--    professor pra um aluno). Conta na cota do PROFESSOR, não do aluno.
-- ---------------------------------------------------------------------
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in ('chat','sanity_check','onboarding_plan','coach_plan'));

-- ---------------------------------------------------------------------
-- 3. RLS profiles: professor lê seus alunos (pra listar no dashboard).
--    Sub-feature 1 já cobre: próprio + leitura do coach pelo aluno.
--    Esta política adiciona o caso oposto: coach lê seus alunos.
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (
    auth.uid() = id
    or id = (select p.coach_id from public.profiles p where p.id = auth.uid())
    or coach_id = auth.uid()
  );
