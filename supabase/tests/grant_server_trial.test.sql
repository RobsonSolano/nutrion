-- =====================================================================
-- Teste de grant_server_trial (trial-e-migração, [TRIAL]-01,04)
-- Transacional + ROLLBACK: não polui o banco. Rodar contra o LOCAL:
--   npx supabase@latest start
--   docker exec -i supabase_db_nutrion psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/grant_server_trial.test.sql
-- Saída esperada ao final: NOTICE "GRANT_SERVER_TRIAL: ALL PASS".
--
-- session_replication_role=replica bypassa triggers (inclui o trigger de
-- onboarding desta própria spec) e a FK p/ auth.users — testamos a FUNÇÃO
-- direto, não o trigger.
-- =====================================================================
begin;
set local session_replication_role = replica;

insert into public.profiles (id, role, coach_id, user_number) values
  ('bbbbbbbb-0000-0000-0000-000000000001','comum',     null, 8001), -- comum novo (elegível)
  ('bbbbbbbb-0000-0000-0000-000000000002','comum',     null, 8002), -- comum grandfather
  ('bbbbbbbb-0000-0000-0000-000000000003','comum',     null, 8003), -- comum com loja
  ('bbbbbbbb-0000-0000-0000-000000000004','aluno',     null, 8004), -- aluno (role inelegível)
  ('bbbbbbbb-0000-0000-0000-000000000005','professor', null, 8005); -- professor (role inelegível)

insert into public.subscriptions (user_id, tier, source, status) values
  ('bbbbbbbb-0000-0000-0000-000000000002','free','grandfather','active'),
  ('bbbbbbbb-0000-0000-0000-000000000003','pro','store_play','active');

do $$
declare
  fail int := 0;
  r text;
  v_source text;
  v_consumed boolean;
  v_trial_end timestamptz;
begin
  -- 1. comum novo → granted, com linha server_trial/consumed/trial_end futuro
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000001');
  if r <> 'granted' then raise warning 'FAIL u1 retorno → %, esperado granted', r; fail := fail+1; end if;
  select source, trial_consumed, trial_end into v_source, v_consumed, v_trial_end
    from public.subscriptions where user_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if v_source is distinct from 'server_trial' then raise warning 'FAIL u1 source → %', v_source; fail := fail+1; end if;
  if v_consumed is distinct from true then raise warning 'FAIL u1 consumed → %', v_consumed; fail := fail+1; end if;
  if v_trial_end is null or v_trial_end <= now() then raise warning 'FAIL u1 trial_end → %', v_trial_end; fail := fail+1; end if;

  -- 2. comum novo, 2ª chamada → skipped_consumed (anti-abuso)
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000001');
  if r <> 'skipped_consumed' then raise warning 'FAIL u1 2ª → %, esperado skipped_consumed', r; fail := fail+1; end if;

  -- 3. grandfather → skipped_source, linha intacta (não vira server_trial)
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000002');
  if r <> 'skipped_source' then raise warning 'FAIL u2 → %, esperado skipped_source', r; fail := fail+1; end if;
  select source into v_source from public.subscriptions where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  if v_source is distinct from 'grandfather' then raise warning 'FAIL u2 source mudou → %', v_source; fail := fail+1; end if;

  -- 4. loja → skipped_source
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000003');
  if r <> 'skipped_source' then raise warning 'FAIL u3 → %, esperado skipped_source', r; fail := fail+1; end if;

  -- 5. aluno → skipped_role
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000004');
  if r <> 'skipped_role' then raise warning 'FAIL u4 → %, esperado skipped_role', r; fail := fail+1; end if;

  -- 6. professor → skipped_role
  r := public.grant_server_trial('bbbbbbbb-0000-0000-0000-000000000005');
  if r <> 'skipped_role' then raise warning 'FAIL u5 → %, esperado skipped_role', r; fail := fail+1; end if;

  if fail > 0 then
    raise exception 'GRANT_SERVER_TRIAL: % asserção(ões) falharam', fail;
  end if;
  raise notice 'GRANT_SERVER_TRIAL: ALL PASS';
end $$;

rollback;
