-- =====================================================================
-- NutriOn — Campos de onboarding
-- Extende public.profiles com dados coletados no fluxo de onboarding
-- (perfil biométrico detalhado, objetivo, esporte, hábitos, limitações)
-- =====================================================================

alter table public.profiles
  add column if not exists sex text check (sex in ('m','f','o')),
  add column if not exists birth_year integer check (birth_year between 1900 and extract(year from now())::int),
  add column if not exists goal_type text check (goal_type in ('lose_fat','maintain','gain_muscle','reduce_body_fat')),
  add column if not exists goal_target_date date,
  add column if not exists bio text,
  add column if not exists allergies text,
  add column if not exists physical_limitations text,
  add column if not exists practices_sport boolean,
  add column if not exists sports text[],
  add column if not exists weekly_frequency text check (weekly_frequency in ('1-2','2-3','3-4','4-5','5-6','6-7')),
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_skipped_at timestamptz;

-- Checagem de tamanho do bio (255 caracteres no app; relaxado no banco pra não
-- quebrar se a UI permitir marginalmente mais).
alter table public.profiles
  drop constraint if exists profiles_bio_length_chk;
alter table public.profiles
  add constraint profiles_bio_length_chk check (bio is null or char_length(bio) <= 500);

comment on column public.profiles.sex is 'm=masculino, f=feminino, o=outro';
comment on column public.profiles.goal_type is 'lose_fat | maintain | gain_muscle | reduce_body_fat';
comment on column public.profiles.weekly_frequency is 'Faixa de treinos por semana (ex: 3-4)';
comment on column public.profiles.onboarding_completed_at is 'Null até o usuário concluir o onboarding com IA';
comment on column public.profiles.onboarding_skipped_at is 'Marcado quando o usuário pula o onboarding';
