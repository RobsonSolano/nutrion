-- =====================================================================
-- Persona Fit — ajuste dos limites de alunos por tier
-- Decisão de produto: free = 2, pro = 5, premium = ilimitado
-- (antes: free = 5, pro = 20). Substitui só o bloco de student_limit do
-- _resolve_entitlement; o resto da função é idêntico ao billing-core (#1).
-- coach-create-student e o cliente já leem esse valor da RPC (não hardcodam),
-- então propaga sozinho no servidor. Copy do paywall e comentários: à parte.
-- =====================================================================

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

  v_trial_active := coalesce(v_source = 'server_trial' and v_trial_end > now(), false);
  v_store_active := coalesce(
    v_source in ('store_play','store_apple','stripe') and (
      v_status in ('active','in_trial')
      or (v_status = 'canceled' and coalesce(v_period_end > now(), false))
    ), false);
  v_has_tier_access := (v_trial_active or v_store_active)
                       and coalesce(v_tier in ('pro','premium'), false);
  v_grandfather := coalesce(v_source = 'grandfather', false) or coalesce(v_early, false);
  v_tier_out := case when v_has_tier_access then v_tier else 'free' end;

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

  v_ai_personal := v_has_tier_access or v_grandfather;

  if v_role = 'professor' then
    v_ai_coach := v_has_tier_access;  -- D3: grandfather/early NÃO concede coach
    v_student_limit := case v_tier_out
                         when 'premium' then null
                         when 'pro' then 5
                         else 2 end;          -- free/grandfather = 2
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
