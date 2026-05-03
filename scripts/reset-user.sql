-- =====================================================================
-- NutriOn — Reset de usuário
-- =====================================================================
-- Limpa todos os dados de um usuário **exceto o login** (auth.users
-- continua, profiles.id continua, full_name e avatar_url do Google
-- preservados). Após rodar, o app vai redirecionar o user pro
-- onboarding na próxima sessão.
--
-- Como rodar (Supabase Studio → SQL Editor):
--   1. Trocar o email no `where email = 'xxx'` abaixo.
--   2. Executar.
--   3. (opcional) Limpar fotos do bucket meal-photos manualmente:
--      Storage → meal-photos → pasta com o UUID do user → Delete.
--      `storage.objects` rejeita DELETE direto via SQL (proteção do
--      Supabase) — a limpeza tem que ser pela UI ou pela Storage API.
-- =====================================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'TROCAR_EMAIL_AQUI';
  if uid is null then
    raise exception 'Usuário não encontrado';
  end if;

  delete from public.chat_messages       where user_id = uid;
  delete from public.ai_usage_log        where user_id = uid;
  delete from public.workout_sessions    where user_id = uid;
  delete from public.workout_routines    where user_id = uid;  -- cascade limpa workout_routine_exercises
  delete from public.workout_logs        where user_id = uid;
  delete from public.food_logs           where user_id = uid;
  delete from public.water_logs          where user_id = uid;

  update public.profiles set
    weight_kg = null, height_cm = null, goal_weight_kg = null,
    daily_calorie_goal = 2500, protein_goal_g = 180, water_goal_ml = 4000,
    sex = null, birth_year = null,
    goal_type = null, goal_target_date = null,
    bio = null, allergies = null, physical_limitations = null,
    practices_sport = null, sports = null, weekly_frequency = null,
    onboarding_completed_at = null, onboarding_skipped_at = null
  where id = uid;

  raise notice 'Reset OK pro user %', uid;
end $$;
