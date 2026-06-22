-- =====================================================================
-- Persona Fit — trial-e-migração (spec #3)
-- CONCEDE o trial de servidor que o billing-core (#1) já sabe LER.
--   T1b: trigger keyed na CONCLUSÃO de onboarding de um comum (não no insert)
--        — coach-create-student cria o aluno via role='comum' (default) e só
--        depois seta role='aluno'; keyed no onboarding, o aluno não dispara.
--   T3 : grandfather-safe + anti-abuso (trial_consumed = 1 por vida).
-- Não altera resolve_entitlement (#1). Ver .specs/features/2026-06-22-trial-e-migracao/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. grant_server_trial — fonte única da concessão ([TRIAL]-01)
-- ---------------------------------------------------------------------
create or replace function public.grant_server_trial(p_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_source text;
  v_consumed boolean;
begin
  if p_uid is null then
    return 'skipped_null';
  end if;

  select role into v_role from public.profiles where id = p_uid;
  if not found then
    return 'skipped_no_profile';
  end if;
  -- Trial pessoal é de comum. Professor = oferta da loja (#5); aluno herda do coach.
  if v_role <> 'comum' then
    return 'skipped_role';
  end if;

  select source, trial_consumed
    into v_source, v_consumed
    from public.subscriptions where user_id = p_uid;

  -- Anti-abuso: 1 trial de servidor por vida.
  if coalesce(v_consumed, false) then
    return 'skipped_consumed';
  end if;
  -- Grandfather-safe: nunca sobrescreve IA-pra-sempre nem assinatura de loja.
  if v_source in ('grandfather', 'store_play', 'store_apple', 'stripe') then
    return 'skipped_source';
  end if;

  insert into public.subscriptions
    (user_id, tier, source, status, trial_end, trial_consumed)
  values
    (p_uid, 'pro', 'server_trial', 'in_trial', now() + interval '7 days', true)
  on conflict (user_id) do update set
    tier = 'pro',
    source = 'server_trial',
    status = 'in_trial',
    trial_end = now() + interval '7 days',
    trial_consumed = true,
    updated_at = now();

  return 'granted';
end;
$$;

comment on function public.grant_server_trial(uuid) is
  'Concede 7d de server_trial (tier=pro) se elegível: role=comum, sem trial consumido, '
  'sem grandfather/loja. Idempotente. Chamada pelo trigger de onboarding e por coach-unlink-student.';

-- Escrita de entitlement é privilégio de servidor: revoke do client, grant ao service_role.
-- O trigger roda como SECURITY DEFINER, então não precisa de grant ao authenticated.
revoke all on function public.grant_server_trial(uuid) from public;
grant execute on function public.grant_server_trial(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 2. Trigger: concede ao comum que conclui (ou pula) o onboarding ([TRIAL]-02)
-- ---------------------------------------------------------------------
create or replace function public.tg_grant_trial_on_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_server_trial(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists trg_grant_trial_on_onboarding on public.profiles;
create trigger trg_grant_trial_on_onboarding
  after update on public.profiles
  for each row
  when (
    NEW.role = 'comum' and (
      (NEW.onboarding_completed_at is not null and OLD.onboarding_completed_at is null)
      or
      (NEW.onboarding_skipped_at is not null and OLD.onboarding_skipped_at is null)
    )
  )
  execute function public.tg_grant_trial_on_onboarding();
