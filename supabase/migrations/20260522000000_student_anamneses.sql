-- =====================================================================
-- NutriOn — Anamnese Estendida V1
-- Tabela student_anamneses (1:1 com profile) com campos clínicos
-- estruturados pra coach e IA.
-- RLS: aluno e seu coach leem/escrevem; só aluno apaga (histórico clínico).
-- Backfill copia profiles.physical_limitations → injuries_notes
--          e profiles.allergies → allergy_food (não deleta os antigos).
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.student_anamneses (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  -- Lesões / limitações ortopédicas
  injuries text[] not null default '{}',
  injuries_notes text,

  -- Cirurgias prévias — array de { date: 'YYYY' | 'YYYY-MM', type, notes? }
  surgeries jsonb not null default '[]'::jsonb,

  -- Doenças crônicas
  chronic_conditions text[] not null default '{}',
  chronic_conditions_notes text,

  -- Medicamentos em uso (texto livre)
  medications text,

  -- Alergias (separadas pra IA poder usar só alimentar sem ruído)
  allergy_food text,
  allergy_medication text,
  allergy_environmental text,

  -- Restrições alimentares
  dietary_restrictions text[] not null default '{}',
  dietary_notes text,

  -- Contato de emergência
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,

  -- Contexto qualitativo
  sport_history text,
  goal_notes text,

  -- Liberação médica
  has_medical_clearance boolean,
  medical_clearance_notes text,

  -- Metadata
  filled_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.student_anamneses is
  'Anamnese clinica estruturada (1:1 com profile). RLS: aluno + coach do aluno.';

-- ---------------------------------------------------------------------
-- 2. Constraints de tamanho (idempotente — drop+add pra evitar duplicar)
-- ---------------------------------------------------------------------
do $$
declare
  c record;
  names text[] := array[
    'anamnese_injuries_notes_len',
    'anamnese_chronic_notes_len',
    'anamnese_medications_len',
    'anamnese_allergy_food_len',
    'anamnese_allergy_med_len',
    'anamnese_allergy_env_len',
    'anamnese_dietary_notes_len',
    'anamnese_sport_history_len',
    'anamnese_goal_notes_len',
    'anamnese_med_clear_notes_len',
    'anamnese_emerg_name_len',
    'anamnese_emerg_phone_len',
    'anamnese_emerg_rel_len'
  ];
  n text;
begin
  foreach n in array names loop
    if exists (select 1 from pg_constraint where conname = n) then
      execute format('alter table public.student_anamneses drop constraint %I', n);
    end if;
  end loop;
end $$;

alter table public.student_anamneses
  add constraint anamnese_injuries_notes_len     check (char_length(injuries_notes) <= 1000),
  add constraint anamnese_chronic_notes_len      check (char_length(chronic_conditions_notes) <= 1000),
  add constraint anamnese_medications_len        check (char_length(medications) <= 1000),
  add constraint anamnese_allergy_food_len       check (char_length(allergy_food) <= 500),
  add constraint anamnese_allergy_med_len        check (char_length(allergy_medication) <= 500),
  add constraint anamnese_allergy_env_len        check (char_length(allergy_environmental) <= 500),
  add constraint anamnese_dietary_notes_len      check (char_length(dietary_notes) <= 500),
  add constraint anamnese_sport_history_len      check (char_length(sport_history) <= 1000),
  add constraint anamnese_goal_notes_len         check (char_length(goal_notes) <= 500),
  add constraint anamnese_med_clear_notes_len    check (char_length(medical_clearance_notes) <= 500),
  add constraint anamnese_emerg_name_len         check (char_length(emergency_contact_name) <= 80),
  add constraint anamnese_emerg_phone_len        check (char_length(emergency_contact_phone) <= 30),
  add constraint anamnese_emerg_rel_len          check (char_length(emergency_contact_relation) <= 30);

-- ---------------------------------------------------------------------
-- 3. Trigger updated_at
-- ---------------------------------------------------------------------
drop trigger if exists student_anamneses_set_updated_at on public.student_anamneses;
create trigger student_anamneses_set_updated_at
  before update on public.student_anamneses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.student_anamneses enable row level security;

drop policy if exists "anamnese_select_own_or_coach" on public.student_anamneses;
create policy "anamnese_select_own_or_coach" on public.student_anamneses
  for select using (
    auth.uid() = user_id
    or user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "anamnese_insert_own" on public.student_anamneses;
create policy "anamnese_insert_own" on public.student_anamneses
  for insert with check (auth.uid() = user_id);

drop policy if exists "anamnese_insert_coach" on public.student_anamneses;
create policy "anamnese_insert_coach" on public.student_anamneses
  for insert with check (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "anamnese_update_own_or_coach" on public.student_anamneses;
create policy "anamnese_update_own_or_coach" on public.student_anamneses
  for update using (
    auth.uid() = user_id
    or user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  ) with check (
    auth.uid() = user_id
    or user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "anamnese_delete_own" on public.student_anamneses;
create policy "anamnese_delete_own" on public.student_anamneses
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. Backfill: cria linha vazia + migra dados legado
-- ---------------------------------------------------------------------
insert into public.student_anamneses (user_id, allergy_food, injuries_notes)
  select
    p.id,
    nullif(trim(p.allergies), ''),
    nullif(trim(p.physical_limitations), '')
  from public.profiles p
  where p.allergies is not null or p.physical_limitations is not null
on conflict (user_id) do nothing;

-- Cria linha vazia pra todos os profiles restantes
insert into public.student_anamneses (user_id)
  select id from public.profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Trigger: cria linha vazia ao nascer profile novo
-- ---------------------------------------------------------------------
create or replace function public.create_student_anamnese_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_anamneses (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_create_anamnese on public.profiles;
create trigger profiles_create_anamnese
  after insert on public.profiles
  for each row execute function public.create_student_anamnese_for_new_profile();
