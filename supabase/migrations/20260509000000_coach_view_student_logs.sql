-- =====================================================================
-- NutriOn — Permite que professor veja os logs do dia-a-dia dos alunos.
-- Necessário pra calcular aderência e mostrar histórico no detalhe do
-- aluno (food_logs, water_logs, workout_logs, workout_sessions).
--
-- chat_messages NÃO entra — chat é privado por decisão de produto
-- (Q5 do spec da Área do Professor).
-- =====================================================================

-- food_logs
drop policy if exists "food_logs_select_coach" on public.food_logs;
create policy "food_logs_select_coach" on public.food_logs
  for select using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- water_logs
drop policy if exists "water_logs_select_coach" on public.water_logs;
create policy "water_logs_select_coach" on public.water_logs
  for select using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- workout_logs
drop policy if exists "workout_logs_select_coach" on public.workout_logs;
create policy "workout_logs_select_coach" on public.workout_logs
  for select using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- workout_sessions
drop policy if exists "sessions_select_coach" on public.workout_sessions;
create policy "sessions_select_coach" on public.workout_sessions
  for select using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );
