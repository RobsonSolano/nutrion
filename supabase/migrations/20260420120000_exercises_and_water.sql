-- =====================================================================
-- NutriOn — Catálogo de exercícios + logs de água
-- Cria:
--   exercise_groups (grupos musculares)
--   exercises (biblioteca catalogada por grupo e equipamento)
--   water_logs (upsert por dia)
-- Extende workout_logs com colunas de prescrição (reps_min/max, peso min/max)
--   e referência ao exercício e grupo.
-- Idempotente — pode rodar múltiplas vezes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Grupos musculares
-- ---------------------------------------------------------------------
create table if not exists public.exercise_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.exercise_groups is 'Grupos musculares (Peito, Costas, ...) — catálogo global compartilhado.';

-- ---------------------------------------------------------------------
-- 2. Biblioteca de exercícios
-- ---------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.exercise_groups(id) on delete cascade,
  name text not null,
  equipment text,
  is_compound boolean default false,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create index if not exists exercises_group_id_idx on public.exercises (group_id);
create index if not exists exercises_name_idx on public.exercises (name);

comment on table public.exercises is 'Biblioteca global de exercícios por grupo muscular.';

-- ---------------------------------------------------------------------
-- 3. Colunas extras em workout_logs (prescrição em faixa + referência)
-- ---------------------------------------------------------------------
alter table public.workout_logs
  add column if not exists exercise_id uuid references public.exercises(id) on delete set null,
  add column if not exists group_id uuid references public.exercise_groups(id) on delete set null,
  add column if not exists reps_min int,
  add column if not exists reps_max int,
  add column if not exists weight_min_kg float,
  add column if not exists weight_max_kg float;

create index if not exists workout_logs_exercise_id_idx on public.workout_logs (exercise_id);
create index if not exists workout_logs_group_id_created_idx
  on public.workout_logs (user_id, group_id, created_at desc);

-- ---------------------------------------------------------------------
-- 4. water_logs (upsert por dia)
-- ---------------------------------------------------------------------
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  volume_ml int not null check (volume_ml >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists water_logs_user_day_idx
  on public.water_logs (user_id, day desc);

comment on table public.water_logs is 'Total de água consumida por dia (upsert); updated_at muda a cada atualização.';

-- trigger que atualiza updated_at em water_logs
drop trigger if exists water_logs_set_updated_at on public.water_logs;
create trigger water_logs_set_updated_at
  before update on public.water_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. RLS e policies
-- ---------------------------------------------------------------------

-- catálogo é público para leitura (todos autenticados podem ler)
alter table public.exercise_groups enable row level security;
drop policy if exists "exercise_groups_select_all" on public.exercise_groups;
create policy "exercise_groups_select_all" on public.exercise_groups
  for select using (true);

alter table public.exercises enable row level security;
drop policy if exists "exercises_select_all" on public.exercises;
create policy "exercises_select_all" on public.exercises
  for select using (true);

-- water_logs é por usuário
alter table public.water_logs enable row level security;

drop policy if exists "water_logs_select_own" on public.water_logs;
create policy "water_logs_select_own" on public.water_logs
  for select using (auth.uid() = user_id);

drop policy if exists "water_logs_insert_own" on public.water_logs;
create policy "water_logs_insert_own" on public.water_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "water_logs_update_own" on public.water_logs;
create policy "water_logs_update_own" on public.water_logs
  for update using (auth.uid() = user_id);

drop policy if exists "water_logs_delete_own" on public.water_logs;
create policy "water_logs_delete_own" on public.water_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 6. Seed grupos musculares
-- ---------------------------------------------------------------------
insert into public.exercise_groups (slug, name, icon, sort_order) values
  ('chest', 'Peito', '💪', 1),
  ('back', 'Costas', '🔙', 2),
  ('legs', 'Pernas', '🦵', 3),
  ('shoulders', 'Ombros', '🏋️', 4),
  ('biceps', 'Bíceps', '💪', 5),
  ('triceps', 'Tríceps', '💪', 6),
  ('core', 'Core / Abdômen', '🎯', 7),
  ('full_body', 'Full Body / Funcional', '🔥', 8),
  ('cardio', 'Cardio', '🏃', 9)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 7. Seed biblioteca de exercícios (nome inclui equipamento para evitar duplicatas)
-- ---------------------------------------------------------------------
do $$
declare
  g_chest uuid;
  g_back uuid;
  g_legs uuid;
  g_shoulders uuid;
  g_biceps uuid;
  g_triceps uuid;
  g_core uuid;
  g_full uuid;
  g_cardio uuid;
begin
  select id into g_chest     from public.exercise_groups where slug = 'chest';
  select id into g_back      from public.exercise_groups where slug = 'back';
  select id into g_legs      from public.exercise_groups where slug = 'legs';
  select id into g_shoulders from public.exercise_groups where slug = 'shoulders';
  select id into g_biceps    from public.exercise_groups where slug = 'biceps';
  select id into g_triceps   from public.exercise_groups where slug = 'triceps';
  select id into g_core      from public.exercise_groups where slug = 'core';
  select id into g_full      from public.exercise_groups where slug = 'full_body';
  select id into g_cardio    from public.exercise_groups where slug = 'cardio';

  insert into public.exercises (group_id, name, equipment, is_compound) values
    -- Peito
    (g_chest, 'Supino reto (barra)', 'barra', true),
    (g_chest, 'Supino reto (halteres)', 'halter', true),
    (g_chest, 'Supino reto (máquina)', 'máquina', true),
    (g_chest, 'Supino inclinado (barra)', 'barra', true),
    (g_chest, 'Supino inclinado (halteres)', 'halter', true),
    (g_chest, 'Supino inclinado (máquina)', 'máquina', true),
    (g_chest, 'Supino declinado (barra)', 'barra', true),
    (g_chest, 'Crucifixo reto (halteres)', 'halter', false),
    (g_chest, 'Crucifixo inclinado (halteres)', 'halter', false),
    (g_chest, 'Crossover alto (cabos)', 'cabo', false),
    (g_chest, 'Crossover baixo (cabos)', 'cabo', false),
    (g_chest, 'Peck deck (máquina)', 'máquina', false),
    (g_chest, 'Pullover (halter)', 'halter', false),
    (g_chest, 'Flexão de braço', 'peso corporal', true),
    (g_chest, 'Mergulho em paralelas', 'peso corporal', true),

    -- Costas
    (g_back, 'Levantamento terra (barra)', 'barra', true),
    (g_back, 'Puxada frontal (pulley)', 'cabo', true),
    (g_back, 'Puxada atrás (pulley)', 'cabo', true),
    (g_back, 'Puxada triângulo (pulley)', 'cabo', true),
    (g_back, 'Remada curvada (barra)', 'barra', true),
    (g_back, 'Remada curvada (halteres)', 'halter', true),
    (g_back, 'Remada cavalinho', 'barra', true),
    (g_back, 'Remada baixa (pulley)', 'cabo', true),
    (g_back, 'Remada unilateral (halter)', 'halter', true),
    (g_back, 'Remada máquina', 'máquina', true),
    (g_back, 'Barra fixa (pronada)', 'peso corporal', true),
    (g_back, 'Barra fixa (supinada)', 'peso corporal', true),
    (g_back, 'Pull-down (pulley)', 'cabo', false),

    -- Pernas
    (g_legs, 'Agachamento livre (barra)', 'barra', true),
    (g_legs, 'Agachamento frontal (barra)', 'barra', true),
    (g_legs, 'Agachamento búlgaro (halteres)', 'halter', true),
    (g_legs, 'Leg press 45°', 'máquina', true),
    (g_legs, 'Leg press horizontal', 'máquina', true),
    (g_legs, 'Hack squat', 'máquina', true),
    (g_legs, 'Cadeira extensora', 'máquina', false),
    (g_legs, 'Mesa flexora', 'máquina', false),
    (g_legs, 'Cadeira flexora', 'máquina', false),
    (g_legs, 'Cadeira adutora', 'máquina', false),
    (g_legs, 'Cadeira abdutora', 'máquina', false),
    (g_legs, 'Stiff (barra)', 'barra', true),
    (g_legs, 'Stiff (halteres)', 'halter', true),
    (g_legs, 'Afundo (halteres)', 'halter', true),
    (g_legs, 'Avanço (barra)', 'barra', true),
    (g_legs, 'Panturrilha em pé (máquina)', 'máquina', false),
    (g_legs, 'Panturrilha sentado (máquina)', 'máquina', false),
    (g_legs, 'Panturrilha no leg press', 'máquina', false),

    -- Ombros
    (g_shoulders, 'Desenvolvimento (barra)', 'barra', true),
    (g_shoulders, 'Desenvolvimento (halteres)', 'halter', true),
    (g_shoulders, 'Desenvolvimento (máquina)', 'máquina', true),
    (g_shoulders, 'Arnold press (halteres)', 'halter', true),
    (g_shoulders, 'Elevação lateral (halteres)', 'halter', false),
    (g_shoulders, 'Elevação lateral (cabo)', 'cabo', false),
    (g_shoulders, 'Elevação frontal (halteres)', 'halter', false),
    (g_shoulders, 'Elevação frontal (cabo)', 'cabo', false),
    (g_shoulders, 'Elevação posterior (halteres)', 'halter', false),
    (g_shoulders, 'Face pull (cabo)', 'cabo', false),
    (g_shoulders, 'Remada alta (barra)', 'barra', true),
    (g_shoulders, 'Encolhimento (halteres)', 'halter', false),
    (g_shoulders, 'Encolhimento (barra)', 'barra', false),

    -- Bíceps
    (g_biceps, 'Rosca direta (barra)', 'barra', false),
    (g_biceps, 'Rosca direta (halteres)', 'halter', false),
    (g_biceps, 'Rosca direta (W)', 'barra', false),
    (g_biceps, 'Rosca alternada (halteres)', 'halter', false),
    (g_biceps, 'Rosca martelo (halteres)', 'halter', false),
    (g_biceps, 'Rosca Scott (barra)', 'barra', false),
    (g_biceps, 'Rosca Scott (halter)', 'halter', false),
    (g_biceps, 'Rosca concentrada (halter)', 'halter', false),
    (g_biceps, 'Rosca 21 (barra)', 'barra', false),
    (g_biceps, 'Rosca no cabo (pulley)', 'cabo', false),

    -- Tríceps
    (g_triceps, 'Tríceps testa (barra)', 'barra', false),
    (g_triceps, 'Tríceps testa (halter)', 'halter', false),
    (g_triceps, 'Tríceps corda (pulley)', 'cabo', false),
    (g_triceps, 'Tríceps pulley (barra)', 'cabo', false),
    (g_triceps, 'Tríceps francês (halter)', 'halter', false),
    (g_triceps, 'Tríceps coice (halter)', 'halter', false),
    (g_triceps, 'Mergulho (peso corporal)', 'peso corporal', true),
    (g_triceps, 'Mergulho em máquina assistida', 'máquina', true),

    -- Core
    (g_core, 'Abdominal supra', 'peso corporal', false),
    (g_core, 'Abdominal infra', 'peso corporal', false),
    (g_core, 'Abdominal oblíquo', 'peso corporal', false),
    (g_core, 'Prancha (frontal)', 'peso corporal', false),
    (g_core, 'Prancha lateral', 'peso corporal', false),
    (g_core, 'Elevação de pernas', 'peso corporal', false),
    (g_core, 'Russian twist', 'peso corporal', false),
    (g_core, 'Dead bug', 'peso corporal', false),
    (g_core, 'Ab wheel / rodinha', 'peso corporal', false),

    -- Full body / funcional
    (g_full, 'Burpee', 'peso corporal', true),
    (g_full, 'Kettlebell swing', 'kettlebell', true),
    (g_full, 'Thruster (barra)', 'barra', true),
    (g_full, 'Clean and jerk (barra)', 'barra', true),
    (g_full, 'Snatch (barra)', 'barra', true),
    (g_full, 'Farmer walk (halteres)', 'halter', true),

    -- Cardio
    (g_cardio, 'Esteira (corrida)', 'máquina', false),
    (g_cardio, 'Esteira (caminhada)', 'máquina', false),
    (g_cardio, 'Bicicleta ergométrica', 'máquina', false),
    (g_cardio, 'Bicicleta (ao ar livre)', 'equipamento', false),
    (g_cardio, 'Elíptico', 'máquina', false),
    (g_cardio, 'Escada / Stair', 'máquina', false),
    (g_cardio, 'Remo ergômetro', 'máquina', false),
    (g_cardio, 'Pular corda', 'equipamento', false),
    (g_cardio, 'Natação', 'equipamento', false),
    (g_cardio, 'HIIT', 'peso corporal', false)
  on conflict (group_id, name) do nothing;
end $$;
