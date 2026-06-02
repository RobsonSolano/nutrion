-- =====================================================================
-- NutriOn — Exclusão de conta (LGPD / Play Store / App Store)
--
-- Feature account-deletion. Adiciona:
--   1. account_deletion_log — audit minimal sem PII (apenas hashes
--      SHA-256 + estatística + motivo opcional). Permite que o time
--      cruze pedidos de suporte sem reter dados pessoais.
--   2. Dois novos tipos no enum push_type:
--      - student_account_deleted (aluno saiu → coach é avisado)
--      - coach_unlinked (coach desvinculou → aluno é avisado)
--   3. Estende ai_usage_log_feature_check com os 2 slugs novos.
--
-- Estratégia: hard delete em auth.users via auth.admin.deleteUser na
-- edge function delete-my-account. Cascade cuida do resto (profiles,
-- logs, rotinas, anamneses, etc — todos com on delete cascade pra
-- auth.users via FK em profiles.id).
--
-- Idempotente: tudo via IF NOT EXISTS / ADD VALUE IF NOT EXISTS /
-- DROP+CREATE no check constraint.
-- =====================================================================

-- Garante extension pgcrypto pra função digest() usada na edge function
-- delete-my-account ao calcular sha256 dos hashes.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tabela de auditoria — sem PII, apenas hashes e estatística
-- ---------------------------------------------------------------------
create table if not exists public.account_deletion_log (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  user_id_hash text not null,
  email_hash text,
  role text check (role in ('comum','aluno','professor')),
  was_linked_to_coach_id uuid,  -- sem FK: coach pode ter sido deletado também
  account_age_days int,
  deletion_reason text          -- opcional, max 500 chars validado no caller
);

create index if not exists account_deletion_log_email_hash_idx
  on public.account_deletion_log (email_hash);
create index if not exists account_deletion_log_deleted_at_idx
  on public.account_deletion_log (deleted_at desc);

comment on table public.account_deletion_log is
  'Auditoria mínima de auto-exclusão de contas. Sem PII direta: apenas hashes SHA-256 de id e email pra cruzamento manual em pedidos de suporte. LGPD: dados pessoais são fisicamente removidos via cascade quando auth.users é deletado pela edge function delete-my-account.';

-- RLS: ninguém com JWT comum lê/escreve. Apenas service_role (edge
-- function delete-my-account) e queries diretas do time via painel.
alter table public.account_deletion_log enable row level security;

-- ---------------------------------------------------------------------
-- 2. Novos tipos de push
-- ---------------------------------------------------------------------
alter type public.push_type add value if not exists 'student_account_deleted';
alter type public.push_type add value if not exists 'coach_unlinked';

-- ---------------------------------------------------------------------
-- 3. Estende ai_usage_log.feature com os slugs novos
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
    'push_streak_warning',
    'push_account_deleted',
    'push_coach_unlinked'
  ));
