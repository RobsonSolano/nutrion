-- =====================================================================
-- NutriOn — Push Notifications com IA
-- Tabelas push_preferences (opt-out por tipo) + push_history (audit + cooldown).
-- Estende ai_usage_log.feature com slugs por tipo de push.
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enum dos tipos canônicos
-- ---------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'push_type') then
    create type public.push_type as enum (
      'inactivity_reminder',
      'streak_celebration',
      'daily_workout_reminder',
      'water_reminder',
      'weekly_summary',
      'coach_adherence_alert',
      'coach_plan_update',
      'goal_achieved'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Preferências por usuário
-- Default: row criada apenas quando usuário desativa um tipo.
-- Ausência de row = enabled (mais simples e econômico em storage).
-- ---------------------------------------------------------------------
create table if not exists public.push_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.push_type not null,
  enabled boolean not null default true,
  preferred_time time, -- null = usar default global do tipo
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

drop trigger if exists push_preferences_set_updated_at
  on public.push_preferences;
create trigger push_preferences_set_updated_at
  before update on public.push_preferences
  for each row execute function public.set_updated_at();

comment on table public.push_preferences is
  'Opt-in/out granular por tipo de push. Ausencia da row = habilitado.';

-- ---------------------------------------------------------------------
-- 3. Histórico de envios (cooldown + auditoria + dashboard de custo)
-- ---------------------------------------------------------------------
create table if not exists public.push_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.push_type not null,
  title text not null,
  body text not null,
  data jsonb,
  ai_generated boolean not null default false,
  ai_tokens int,
  expo_response jsonb,
  status text not null check (status in ('sent','failed','skipped')),
  skip_reason text check (
    skip_reason is null
    or skip_reason in ('no_token','opted_out','cooldown','rate_limit','quiet_hours','ai_failed','expo_failed')
  ),
  sent_at timestamptz not null default now()
);

create index if not exists push_history_user_type_sent_idx
  on public.push_history (user_id, type, sent_at desc);

create index if not exists push_history_sent_at_idx
  on public.push_history (sent_at desc);

comment on table public.push_history is
  'Log de envios e tentativas (cooldown, opt-out, falhas). Insert via service_role.';

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.push_preferences enable row level security;
alter table public.push_history enable row level security;

drop policy if exists "push_prefs_own" on public.push_preferences;
create policy "push_prefs_own" on public.push_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_history_select_own" on public.push_history;
create policy "push_history_select_own" on public.push_history
  for select using (auth.uid() = user_id);
-- Insert/update/delete em push_history só via service_role (bypass RLS).

-- ---------------------------------------------------------------------
-- 5. Estende ai_usage_log.feature com slugs por tipo de push
-- ---------------------------------------------------------------------
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in (
    'chat',
    'sanity_check',
    'onboarding_plan',
    'coach_plan',
    'push_inactivity',
    'push_streak',
    'push_workout',
    'push_weekly_summary',
    'push_coach_alert',
    'push_plan_update',
    'push_goal_achieved'
  ));
