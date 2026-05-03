-- =====================================================================
-- NutriOn — Histórico de planos gerados pelo professor pra alunos
-- Cada chamada de coach-save-student-plan agora cria uma linha em
-- student_plan_revisions capturando o snapshot das metas + rationale.
-- As rotinas criadas naquele save recebem plan_revision_id apontando
-- pra essa linha — assim conseguimos listar planos antigos depois.
-- =====================================================================

create table if not exists public.student_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  rationale text,
  calorie_goal int,
  protein_goal_g int,
  water_goal_ml int,
  created_at timestamptz not null default now()
);

create index if not exists student_plan_revisions_student_idx
  on public.student_plan_revisions (student_id, created_at desc);

comment on table public.student_plan_revisions is
  'Snapshot de cada plano gerado pelo professor. Permite ver o histórico de planos do aluno (metas + rationale + rotinas via plan_revision_id em workout_routines).';

-- ---------------------------------------------------------------------
-- workout_routines.plan_revision_id — vincula cada rotina à revisão
-- que a criou. Rotinas criadas antes desta migration ficam null.
-- ---------------------------------------------------------------------
alter table public.workout_routines
  add column if not exists plan_revision_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_routines_plan_revision_fk'
  ) then
    alter table public.workout_routines
      add constraint workout_routines_plan_revision_fk
      foreign key (plan_revision_id)
      references public.student_plan_revisions(id)
      on delete set null;
  end if;
end $$;

create index if not exists workout_routines_plan_revision_idx
  on public.workout_routines (plan_revision_id)
  where plan_revision_id is not null;

-- ---------------------------------------------------------------------
-- RLS — coach lê suas próprias revisions; aluno lê as suas (pra
-- eventualmente mostrar metadados na tela de aluno).
-- ---------------------------------------------------------------------
alter table public.student_plan_revisions enable row level security;

drop policy if exists "plan_revisions_select" on public.student_plan_revisions;
create policy "plan_revisions_select" on public.student_plan_revisions
  for select using (
    auth.uid() = coach_id
    or auth.uid() = student_id
  );

-- INSERT só via service_role (edge function coach-save-student-plan).
-- UPDATE/DELETE bloqueados — histórico é imutável.
