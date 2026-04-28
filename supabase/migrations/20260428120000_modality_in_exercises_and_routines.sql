-- =====================================================================
-- NutriOn — Modalidade em exercises e workout_routines
-- Permite separar catálogo e rotinas por modalidade (musculação,
-- calistenia, crossfit, corrida, genérico). Necessário pra que o plano
-- gerado no onboarding respeite o esporte que o usuário pratica e pra
-- filtrar o ExercisePicker da UI por modalidade ativa da rotina.
--
-- Default 'musculacao' nas duas colunas — mantém compat com os 90
-- exercícios e rotinas existentes (todos eram musculação implicitamente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. exercises.modality
-- ---------------------------------------------------------------------
alter table public.exercises
  add column if not exists modality text not null default 'musculacao';

-- Constraint só é criada se ainda não existir (idempotência).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exercises_modality_check'
  ) then
    alter table public.exercises
      add constraint exercises_modality_check
      check (modality in ('musculacao','calistenia','crossfit','corrida','generico'));
  end if;
end $$;

create index if not exists exercises_modality_idx
  on public.exercises (modality);

comment on column public.exercises.modality is
  'Modalidade do exercício (musculacao, calistenia, crossfit, corrida, generico). Usado pelo ExercisePicker da UI e pelo gerador de plano da onboarding-plan.';

-- ---------------------------------------------------------------------
-- 2. workout_routines.modality
-- ---------------------------------------------------------------------
alter table public.workout_routines
  add column if not exists modality text not null default 'musculacao';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_routines_modality_check'
  ) then
    alter table public.workout_routines
      add constraint workout_routines_modality_check
      check (modality in ('musculacao','calistenia','crossfit','corrida','generico'));
  end if;
end $$;

create index if not exists workout_routines_user_modality_idx
  on public.workout_routines (user_id, modality, is_archived);

comment on column public.workout_routines.modality is
  'Modalidade da rotina — define quais exercícios são oferecidos no ExercisePicker.';
