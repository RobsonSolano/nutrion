-- =====================================================================
-- NutriOn — Meus Treinos (rotinas reutilizáveis)
-- Cria:
--   workout_routines           — rotinas/templates do usuário ("Peito A", "Cardio 30min", ...)
--   workout_routine_exercises  — exercícios prescritos da rotina (snapshot de nome)
--   workout_sessions           — execuções diárias (qual rotina o user fez no dia)
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. workout_routines
-- ---------------------------------------------------------------------
create table if not exists public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  group_id uuid references public.exercise_groups(id) on delete set null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_routines_user_idx
  on public.workout_routines (user_id, is_archived, created_at desc);

drop trigger if exists workout_routines_set_updated_at on public.workout_routines;
create trigger workout_routines_set_updated_at
  before update on public.workout_routines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. workout_routine_exercises (exercícios prescritos dentro da rotina)
-- ---------------------------------------------------------------------
create table if not exists public.workout_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null, -- snapshot (não perde se o catálogo for editado/removido)
  equipment text,
  sort_order int not null default 0,
  sets int,
  reps_min int,
  reps_max int,
  weight_min_kg float,
  weight_max_kg float,
  duration_min int, -- usado em cardio ou holds
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workout_routine_exercises_routine_idx
  on public.workout_routine_exercises (routine_id, sort_order);

-- ---------------------------------------------------------------------
-- 3. workout_sessions (execução diária)
-- ---------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  routine_id uuid references public.workout_routines(id) on delete set null,
  routine_name text not null, -- snapshot para o histórico permanecer mesmo após delete
  day date not null,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_day_idx
  on public.workout_sessions (user_id, day desc);

-- ---------------------------------------------------------------------
-- 4. RLS + policies
-- ---------------------------------------------------------------------
alter table public.workout_routines enable row level security;

drop policy if exists "routines_select_own" on public.workout_routines;
create policy "routines_select_own" on public.workout_routines
  for select using (auth.uid() = user_id);

drop policy if exists "routines_insert_own" on public.workout_routines;
create policy "routines_insert_own" on public.workout_routines
  for insert with check (auth.uid() = user_id);

drop policy if exists "routines_update_own" on public.workout_routines;
create policy "routines_update_own" on public.workout_routines
  for update using (auth.uid() = user_id);

drop policy if exists "routines_delete_own" on public.workout_routines;
create policy "routines_delete_own" on public.workout_routines
  for delete using (auth.uid() = user_id);

alter table public.workout_routine_exercises enable row level security;

-- Para routine_exercises, a posse é validada através do join com routines.
drop policy if exists "routine_exercises_select_own" on public.workout_routine_exercises;
create policy "routine_exercises_select_own" on public.workout_routine_exercises
  for select using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
    )
  );

drop policy if exists "routine_exercises_insert_own" on public.workout_routine_exercises;
create policy "routine_exercises_insert_own" on public.workout_routine_exercises
  for insert with check (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
    )
  );

drop policy if exists "routine_exercises_update_own" on public.workout_routine_exercises;
create policy "routine_exercises_update_own" on public.workout_routine_exercises
  for update using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
    )
  );

drop policy if exists "routine_exercises_delete_own" on public.workout_routine_exercises;
create policy "routine_exercises_delete_own" on public.workout_routine_exercises
  for delete using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
    )
  );

alter table public.workout_sessions enable row level security;

drop policy if exists "sessions_select_own" on public.workout_sessions;
create policy "sessions_select_own" on public.workout_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.workout_sessions;
create policy "sessions_insert_own" on public.workout_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.workout_sessions;
create policy "sessions_update_own" on public.workout_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on public.workout_sessions;
create policy "sessions_delete_own" on public.workout_sessions
  for delete using (auth.uid() = user_id);
