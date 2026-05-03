-- =====================================================================
-- NutriOn — Área do Professor (sub-feature 3: lock de treinos)
-- Aluno NÃO pode insert/update/delete rotinas. Toda escrita pra aluno
-- passa por edge function com service_role (coach-save-student-plan).
-- Aluno SELECT continua igual (pra ver as rotinas que o professor
-- criou pra ele).
--
-- SELECT também é expandido: professor passa a ler rotinas dos seus
-- alunos (pra dashboard / detalhe do aluno).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. workout_routines — SELECT inclui rotinas dos alunos pelo professor
-- ---------------------------------------------------------------------
drop policy if exists "routines_select_own" on public.workout_routines;
create policy "routines_select_own" on public.workout_routines
  for select using (
    auth.uid() = user_id
    or user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 2. workout_routines — INSERT/UPDATE/DELETE: aluno bloqueado.
--    Comum/professor podem CRUD próprio (comportamento atual).
--    Edição/criação pra aluno passa por edge function (service_role).
-- ---------------------------------------------------------------------
drop policy if exists "routines_insert_own" on public.workout_routines;
create policy "routines_insert_own" on public.workout_routines
  for insert with check (
    auth.uid() = user_id
    and (select role from public.profiles where id = auth.uid()) <> 'aluno'
  );

drop policy if exists "routines_update_own" on public.workout_routines;
create policy "routines_update_own" on public.workout_routines
  for update using (
    auth.uid() = user_id
    and (select role from public.profiles where id = auth.uid()) <> 'aluno'
  );

drop policy if exists "routines_delete_own" on public.workout_routines;
create policy "routines_delete_own" on public.workout_routines
  for delete using (
    auth.uid() = user_id
    and (select role from public.profiles where id = auth.uid()) <> 'aluno'
  );

-- ---------------------------------------------------------------------
-- 3. workout_routine_exercises — herda permissão pelo parent routine.
--    SELECT: própria rotina OU rotina de aluno meu (professor).
--    INSERT/UPDATE/DELETE: própria rotina E não sou aluno.
-- ---------------------------------------------------------------------
drop policy if exists "routine_exercises_select_own" on public.workout_routine_exercises;
create policy "routine_exercises_select_own" on public.workout_routine_exercises
  for select using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and (
        r.user_id = auth.uid()
        or r.user_id in (
          select id from public.profiles where coach_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "routine_exercises_insert_own" on public.workout_routine_exercises;
create policy "routine_exercises_insert_own" on public.workout_routine_exercises
  for insert with check (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
      and (select role from public.profiles where id = auth.uid()) <> 'aluno'
    )
  );

drop policy if exists "routine_exercises_update_own" on public.workout_routine_exercises;
create policy "routine_exercises_update_own" on public.workout_routine_exercises
  for update using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
      and (select role from public.profiles where id = auth.uid()) <> 'aluno'
    )
  );

drop policy if exists "routine_exercises_delete_own" on public.workout_routine_exercises;
create policy "routine_exercises_delete_own" on public.workout_routine_exercises
  for delete using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id = auth.uid()
      and (select role from public.profiles where id = auth.uid()) <> 'aluno'
    )
  );

-- ---------------------------------------------------------------------
-- 4. workout_sessions — aluno PODE registrar sessions (executou treino).
--    Não bloqueia. Sessions são logs de execução, não edição da rotina.
--    Mantém policies atuais.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 5. food_logs / water_logs / workout_logs — alunos PODEM registrar.
--    Logs do dia-a-dia são responsabilidade do aluno. Mantém policies.
-- ---------------------------------------------------------------------
