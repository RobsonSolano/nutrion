-- =====================================================================
-- NutriOn — Push notifications v3 + imagens v3 (catch-all)
--
-- Parte A) Push:
--   Adiciona 3 novos tipos ao enum push_type:
--     - protein_reminder       (fim do dia, gap de proteína)
--     - daily_workout_check    (noite, infere padrão de treino)
--     - streak_warning         (noite, 1 dia antes de quebrar sequência)
--   Estende ai_usage_log_feature_check e push_history.skip_reason
--   check constraint pra suportar os novos slugs e motivos.
--
-- Parte B) Imagens v3 (catch-all):
--   Mapeia os 15 exercícios criados POR FORA das seeds originais —
--   pela função `coach-save-imported-workout` quando o coach importa
--   treino com IA. Esses entram no catálogo `exercises` sem image_urls
--   e tipicamente com nome em CAPS (a IA extrai assim de planilhas).
--   A correspondência é por nome EXATO (case-sensitive).
--
--   'Natação' e variantes aquáticas seguem sem imagem por design —
--   a lib free-exercise-db não tem natação.
--
-- Observação: ALTER TYPE ADD VALUE IF NOT EXISTS (Postgres 12+) torna
-- a migration idempotente sem precisar de bloco condicional.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Novos valores no enum push_type
-- ---------------------------------------------------------------------
alter type public.push_type add value if not exists 'protein_reminder';
alter type public.push_type add value if not exists 'daily_workout_check';
alter type public.push_type add value if not exists 'streak_warning';

-- ---------------------------------------------------------------------
-- 2. Estende ai_usage_log.feature com slugs dos novos pushes
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
    'push_goal_achieved',
    'push_protein',
    'push_workout_check',
    'push_streak_warning'
  ));

-- ---------------------------------------------------------------------
-- 3. Estende push_history.skip_reason com motivos novos dos crons
--
-- Motivos adicionados:
--   no_goal              — usuário sem meta configurada (água, proteína)
--   goal_met             — meta já atingida no momento do cron
--   rest_day             — hoje não é dia típico de treino do user
--   not_enough_history   — < 28 dias de histórico (não dá pra inferir)
--   already_trained      — já treinou hoje
--   streak_too_short     — streak < 2 (warning irrelevante)
--   active_today         — já registrou algo hoje (streak warning n/a)
-- ---------------------------------------------------------------------
alter table public.push_history
  drop constraint if exists push_history_skip_reason_check;
alter table public.push_history
  add constraint push_history_skip_reason_check
  check (
    skip_reason is null
    or skip_reason in (
      'no_token',
      'opted_out',
      'cooldown',
      'rate_limit',
      'quiet_hours',
      'ai_failed',
      'expo_failed',
      'no_goal',
      'goal_met',
      'rest_day',
      'not_enough_history',
      'already_trained',
      'streak_too_short',
      'active_today'
    )
  );

-- ---------------------------------------------------------------------
-- 4. Imagens — catch-all para exercícios criados via IA (caps lock)
--
-- Helper public.exercise_image_urls(slug) já existe desde a migration
-- 20260423140000_exercise_images.sql. Mapeamento por nome EXATO.
-- ---------------------------------------------------------------------
do $$
declare
  matches text[][] := array[
    -- Costas
    ['REMADA BAIXA ABERTA',         'Seated_Cable_Rows'],
    ['REMADA CURVADA PRON.',        'Bent_Over_Barbell_Row'],

    -- Pernas
    ['ABDUÇÃO',                     'Thigh_Abductor'],
    ['ADUÇÃO',                      'Thigh_Adductor'],
    ['AGACHAMENTO PÊNDULO',         'Barbell_Squat_To_A_Bench'],
    ['EXTENSÃO',                    'Leg_Extensions'],
    ['FLEXÃO CADEIRA',              'Seated_Leg_Curl'],
    ['FLEXÃO MESA',                 'Lying_Leg_Curls'],
    ['GÊMEOS PÊNDULO',              'Standing_Calf_Raises'],
    ['GLÚTEO MÁQUINA',              'Glute_Bridge'],

    -- Ombros
    ['PULLEY FRENTE',               'Wide-Grip_Lat_Pulldown'],

    -- Bíceps
    ['ROSCA DIRETA POLIA',          'Cable_Curl'],

    -- Core
    ['ELEVAÇÃO PÉLVICA SOLO UNI',   'Glute_Bridge'],

    -- Cardio
    ['Ski erg',                     'Rowing_Stationary']

    -- Natação fica fora: a lib não tem.
  ];
begin
  for i in 1 .. array_length(matches, 1) loop
    update public.exercises
       set image_urls = public.exercise_image_urls(matches[i][2])
     where name = matches[i][1]
       and image_urls is null;
  end loop;
end $$;
