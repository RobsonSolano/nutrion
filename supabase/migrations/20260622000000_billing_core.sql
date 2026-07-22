-- =====================================================================
-- Persona Fit — billing-core (spec #1)
-- Fonte de verdade do entitlement: tabela `subscriptions` + RPC
-- `resolve_entitlement`. Gating nas edge functions consome o RPC.
-- Decisões D1-D5: ver .specs/features/2026-06-22-billing-core/spec.md
--   D2: grandfather = todos os usuários atuais (backfill abaixo)
--   D3: grandfather/early-adopter concede só IA pessoal (não coach/limite)
--   D4: trial é só leitura aqui (granting fica na spec #3)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela subscriptions ([BILL]-01)
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro','premium')),
  source text check (source in ('store_play','store_apple','stripe','server_trial','grandfather')),
  status text not null default 'active' check (status in ('active','in_trial','canceled','expired')),
  trial_end timestamptz,
  period_end timestamptz,
  rc_app_user_id text,
  trial_consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Fonte de verdade do entitlement por usuário. Escrita só por service_role (edge/webhook); leitura do dono.';
comment on column public.subscriptions.source is
  'Origem do direito: store_play|store_apple|stripe (loja), server_trial (grant #3), grandfather (usuários pré-billing).';
comment on column public.subscriptions.trial_consumed is
  'Anti-abuso: 1 trial de servidor por vida. Granting na spec #3.';

-- ---------------------------------------------------------------------
-- 2. RLS — dono lê; escrita só via service_role ([BILL]-02)
-- ---------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Sem policies de insert/update/delete: service_role ignora RLS; o client
-- (authenticated/anon) nunca escreve direto.

-- ---------------------------------------------------------------------
-- 3. Backfill grandfather — todos os profiles existentes ([BILL]-03 / D2)
-- ---------------------------------------------------------------------
insert into public.subscriptions (user_id, tier, source, status)
  select id, 'free', 'grandfather', 'active' from public.profiles
  on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
-- 4. resolve_entitlement ([BILL]-04,05,06)
--    Core testável (uid explícito) + wrapper público (no-arg, auth.uid()).
-- ---------------------------------------------------------------------
create or replace function public._resolve_entitlement(p_uid uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_coach_id uuid;
  v_early boolean;
  v_tier text;
  v_source text;
  v_status text;
  v_trial_end timestamptz;
  v_period_end timestamptz;
  v_trial_active boolean;
  v_store_active boolean;
  v_has_tier_access boolean;
  v_grandfather boolean;
  v_tier_out text;
  v_ai_personal boolean;
  v_ai_coach boolean;
  v_student_limit int;
begin
  if p_uid is null then
    return json_build_object('tier','free','source','none','ai_personal',false,
                             'ai_coach',false,'student_limit',null,'trial_end',null);
  end if;

  select role, coach_id, is_early_adopter
    into v_role, v_coach_id, v_early
    from public.profiles where id = p_uid;

  if not found then
    return json_build_object('tier','free','source','none','ai_personal',false,
                             'ai_coach',false,'student_limit',null,'trial_end',null);
  end if;

  select tier, source, status, trial_end, period_end
    into v_tier, v_source, v_status, v_trial_end, v_period_end
    from public.subscriptions where user_id = p_uid;

  -- Trial de servidor: ativo enquanto trial_end no futuro (status é só rótulo;
  -- a expiração formal vem da spec #3).
  v_trial_active := coalesce(v_source = 'server_trial' and v_trial_end > now(), false);
  -- Loja/stripe: ativo, em trial da loja, ou cancelado mas ainda dentro do
  -- período já pago (acesso até period_end — arestas de cancelamento §3.6).
  v_store_active := coalesce(
    v_source in ('store_play','store_apple','stripe') and (
      v_status in ('active','in_trial')
      or (v_status = 'canceled' and coalesce(v_period_end > now(), false))
    ), false);
  v_has_tier_access := (v_trial_active or v_store_active)
                       and coalesce(v_tier in ('pro','premium'), false);
  v_grandfather := coalesce(v_source = 'grandfather', false) or coalesce(v_early, false);
  v_tier_out := case when v_has_tier_access then v_tier else 'free' end;

  -- Aluno: IA pessoal herdada do coach (D5). Coach é sempre professor → sem
  -- recursão profunda. Sem coach_id → sem IA.
  if v_role = 'aluno' then
    if v_coach_id is null then
      v_ai_personal := false;
    else
      v_ai_personal := coalesce(
        (public._resolve_entitlement(v_coach_id) ->> 'ai_personal')::boolean, false);
    end if;
    return json_build_object(
      'tier', v_tier_out, 'source', coalesce(v_source,'none'),
      'ai_personal', v_ai_personal, 'ai_coach', false,
      'student_limit', null, 'trial_end', v_trial_end);
  end if;

  -- Comum / professor
  v_ai_personal := v_has_tier_access or v_grandfather;

  if v_role = 'professor' then
    v_ai_coach := v_has_tier_access;  -- D3: grandfather/early NÃO concede coach
    v_student_limit := case v_tier_out
                         when 'premium' then null
                         when 'pro' then 20
                         else 5 end;          -- free/grandfather = 5
  else
    v_ai_coach := false;
    v_student_limit := null;
  end if;

  return json_build_object(
    'tier', v_tier_out, 'source', coalesce(v_source,'none'),
    'ai_personal', v_ai_personal, 'ai_coach', v_ai_coach,
    'student_limit', v_student_limit, 'trial_end', v_trial_end);
end;
$$;

comment on function public._resolve_entitlement(uuid) is
  'Core do entitlement (uid explícito, testável). Wrapper público: resolve_entitlement().';

create or replace function public.resolve_entitlement()
returns json
language sql
security definer
set search_path = public
stable
as $$ select public._resolve_entitlement(auth.uid()); $$;

comment on function public.resolve_entitlement() is
  'Entitlement do usuário autenticado (auth.uid()). Consumido pelo gating das edge functions.';

-- Só o wrapper no-arg é exposto ao client; o core fica interno (chamado pelo
-- wrapper, que roda como definer).
revoke all on function public._resolve_entitlement(uuid) from public;
grant execute on function public.resolve_entitlement() to authenticated;
