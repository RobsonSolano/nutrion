-- =====================================================================
-- NutriOn — Log estruturado de IA
-- Estende ai_usage_log pra virar log analítico de cada interação com IA:
-- duração, tokens, status, código de erro. NÃO logamos conteúdo de
-- mensagens pra preservar privacidade — chat_messages já guarda isso
-- separadamente quando precisa.
-- =====================================================================

alter table public.ai_usage_log
  add column if not exists tokens integer,
  add column if not exists duration_ms integer,
  add column if not exists status text,
  add column if not exists error_code text;

-- Atualiza o constraint da feature pra incluir 'chat'.
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in ('chat','sanity_check','onboarding_plan'));

-- Status canônicos: success | error | quota_exceeded.
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_status_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_status_check
  check (status is null or status in ('success','error','quota_exceeded'));

comment on column public.ai_usage_log.tokens is
  'Total de tokens consumidos (prompt + completion) reportado pelo Groq.';
comment on column public.ai_usage_log.duration_ms is
  'Duração da chamada à edge function em milissegundos.';
comment on column public.ai_usage_log.status is
  'success | error | quota_exceeded';
comment on column public.ai_usage_log.error_code is
  'Código curto do erro quando status=error (ex: rate_limit, parse_failed).';
