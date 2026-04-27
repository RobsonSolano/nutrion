-- =====================================================================
-- NutriOn — Schema inicial
-- Cria: profiles, workout_logs, food_logs, bucket meal-photos, RLS, trigger
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela de perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  weight_kg float,
  height_cm float,
  goal_weight_kg float,
  daily_calorie_goal integer default 2500,
  protein_goal_g integer default 180,
  water_goal_ml integer default 4000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil antropométrico e metas diárias do usuário';

-- ---------------------------------------------------------------------
-- 2. Tabela de logs de treino
-- ---------------------------------------------------------------------
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_name text not null,
  sets integer,
  reps integer,
  weight_kg float,
  intensity_rpe smallint check (intensity_rpe between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workout_logs_user_id_created_idx
  on public.workout_logs (user_id, created_at desc);

comment on table public.workout_logs is 'Sessões de treino com progressão de carga';

-- ---------------------------------------------------------------------
-- 3. Tabela de logs alimentares
-- ---------------------------------------------------------------------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_name text,
  description text,
  calories integer check (calories >= 0),
  protein_g integer check (protein_g >= 0),
  carbs_g integer check (carbs_g >= 0),
  fats_g integer check (fats_g >= 0),
  photo_path text,
  ai_feedback text,
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_id_created_idx
  on public.food_logs (user_id, created_at desc);

comment on table public.food_logs is 'Registro de refeições com macros e opcional foto/feedback de IA';

-- ---------------------------------------------------------------------
-- 4. Trigger que atualiza updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Trigger handle_new_user: cria profile automaticamente no signup
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. Habilitar RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workout_logs enable row level security;
alter table public.food_logs enable row level security;

-- ---------------------------------------------------------------------
-- 7. Policies: cada usuário só acessa suas próprias linhas
-- ---------------------------------------------------------------------

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- workout_logs
drop policy if exists "workout_logs_select_own" on public.workout_logs;
create policy "workout_logs_select_own" on public.workout_logs
  for select using (auth.uid() = user_id);

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own" on public.workout_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "workout_logs_update_own" on public.workout_logs;
create policy "workout_logs_update_own" on public.workout_logs
  for update using (auth.uid() = user_id);

drop policy if exists "workout_logs_delete_own" on public.workout_logs;
create policy "workout_logs_delete_own" on public.workout_logs
  for delete using (auth.uid() = user_id);

-- food_logs
drop policy if exists "food_logs_select_own" on public.food_logs;
create policy "food_logs_select_own" on public.food_logs
  for select using (auth.uid() = user_id);

drop policy if exists "food_logs_insert_own" on public.food_logs;
create policy "food_logs_insert_own" on public.food_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "food_logs_update_own" on public.food_logs;
create policy "food_logs_update_own" on public.food_logs
  for update using (auth.uid() = user_id);

drop policy if exists "food_logs_delete_own" on public.food_logs;
create policy "food_logs_delete_own" on public.food_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 8. Storage: bucket meal-photos + policies
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists "meal_photos_select_own" on storage.objects;
create policy "meal_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "meal_photos_insert_own" on storage.objects;
create policy "meal_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "meal_photos_delete_own" on storage.objects;
create policy "meal_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'meal-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
