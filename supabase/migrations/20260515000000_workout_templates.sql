-- =====================================================================
-- NutriOn — Biblioteca de treinos do professor (templates)
--
-- Permite que o professor pré-cadastre treinos reutilizáveis ("templates")
-- na sua biblioteca privada. Quando aplicado a um aluno, o template é
-- copiado (snapshot) pra workout_routines normais — independentes do
-- template depois disso. O que mudar no template não afeta alunos já
-- vinculados.
--
-- Cria:
--   workout_templates           — biblioteca privada do coach
--   workout_template_exercises  — exercícios prescritos do template
--   workout_routines.source_template_id — auditoria (qual template gerou)
--
-- Ligação com area-professor:
--   - Templates pertencem a um coach (FK pra coaches.id, cascade)
--   - Cópia pra aluno via edge function coach-apply-template (service_role)
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. workout_templates
-- ---------------------------------------------------------------------
create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null,
  description text,
  group_id uuid references public.exercise_groups(id) on delete set null,
  modality text not null default 'musculacao',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHECKs idempotentes
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_templates_name_len_check'
  ) then
    alter table public.workout_templates
      add constraint workout_templates_name_len_check
      check (char_length(name) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workout_templates_description_len_check'
  ) then
    alter table public.workout_templates
      add constraint workout_templates_description_len_check
      check (description is null or char_length(description) <= 500);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workout_templates_modality_check'
  ) then
    alter table public.workout_templates
      add constraint workout_templates_modality_check
      check (modality in ('musculacao','calistenia','crossfit','corrida','generico'));
  end if;
end $$;

create index if not exists workout_templates_coach_idx
  on public.workout_templates (coach_id, is_archived, created_at desc);

drop trigger if exists workout_templates_set_updated_at on public.workout_templates;
create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

comment on table public.workout_templates is
  'Biblioteca privada do coach: treinos reutilizáveis aplicáveis em alunos por cópia (snapshot).';

-- ---------------------------------------------------------------------
-- 2. workout_template_exercises (exercícios prescritos do template)
-- ---------------------------------------------------------------------
create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  equipment text,
  sort_order int not null default 0,
  sets int,
  reps_min int,
  reps_max int,
  weight_min_kg float,
  weight_max_kg float,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workout_template_exercises_template_idx
  on public.workout_template_exercises (template_id, sort_order);

comment on table public.workout_template_exercises is
  'Exercícios de um template. Espelho de workout_routine_exercises sem snapshot histórico (template é interno do coach).';

-- ---------------------------------------------------------------------
-- 3. workout_routines.source_template_id (auditoria)
-- ---------------------------------------------------------------------
alter table public.workout_routines
  add column if not exists source_template_id uuid;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_routines_source_template_fk'
  ) then
    alter table public.workout_routines
      add constraint workout_routines_source_template_fk
      foreign key (source_template_id)
      references public.workout_templates(id)
      on delete set null;
  end if;
end $$;

create index if not exists workout_routines_source_template_idx
  on public.workout_routines (source_template_id)
  where source_template_id is not null;

comment on column public.workout_routines.source_template_id is
  'Quando preenchido, indica qual template gerou esta rotina (auditoria, não cópia viva).';

-- ---------------------------------------------------------------------
-- 4. RLS — workout_templates
-- ---------------------------------------------------------------------
alter table public.workout_templates enable row level security;

drop policy if exists "templates_select_own" on public.workout_templates;
create policy "templates_select_own" on public.workout_templates
  for select using ((select auth.uid()) = coach_id);

drop policy if exists "templates_insert_own" on public.workout_templates;
create policy "templates_insert_own" on public.workout_templates
  for insert with check (
    (select auth.uid()) = coach_id
    and exists (select 1 from public.coaches c where c.id = (select auth.uid()))
  );

drop policy if exists "templates_update_own" on public.workout_templates;
create policy "templates_update_own" on public.workout_templates
  for update using ((select auth.uid()) = coach_id);

drop policy if exists "templates_delete_own" on public.workout_templates;
create policy "templates_delete_own" on public.workout_templates
  for delete using ((select auth.uid()) = coach_id);

-- ---------------------------------------------------------------------
-- 5. RLS — workout_template_exercises (herda via parent)
-- ---------------------------------------------------------------------
alter table public.workout_template_exercises enable row level security;

drop policy if exists "template_exercises_select_own" on public.workout_template_exercises;
create policy "template_exercises_select_own" on public.workout_template_exercises
  for select using (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.coach_id = (select auth.uid())
    )
  );

drop policy if exists "template_exercises_insert_own" on public.workout_template_exercises;
create policy "template_exercises_insert_own" on public.workout_template_exercises
  for insert with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.coach_id = (select auth.uid())
    )
  );

drop policy if exists "template_exercises_update_own" on public.workout_template_exercises;
create policy "template_exercises_update_own" on public.workout_template_exercises
  for update using (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.coach_id = (select auth.uid())
    )
  );

drop policy if exists "template_exercises_delete_own" on public.workout_template_exercises;
create policy "template_exercises_delete_own" on public.workout_template_exercises
  for delete using (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.coach_id = (select auth.uid())
    )
  );
