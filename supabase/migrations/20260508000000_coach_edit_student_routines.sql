-- =====================================================================
-- NutriOn — Permite que professor edite rotinas dos seus alunos.
-- Sub-feature anterior (20260506) bloqueou INSERT/UPDATE/DELETE em
-- workout_routines pra qualquer profile.role='aluno' e manteve as
-- escritas restritas a "auth.uid() = user_id" pros demais. Resultado:
-- professor não conseguia editar rotinas que tinham user_id do aluno.
--
-- Esta migration adiciona policies adicionais (não substitui, soma)
-- permitindo o professor escrever em rotinas onde o user_id é aluno
-- dele. Continua bloqueado pra qualquer outro caller (RLS é OR — a
-- request precisa passar em ALGUMA policy).
-- =====================================================================

-- ---------------------------------------------------------------------
-- workout_routines — INSERT/UPDATE/DELETE pra professor em rotinas
-- dos alunos dele.
-- ---------------------------------------------------------------------
drop policy if exists "routines_insert_coach" on public.workout_routines;
create policy "routines_insert_coach" on public.workout_routines
  for insert with check (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "routines_update_coach" on public.workout_routines;
create policy "routines_update_coach" on public.workout_routines
  for update using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "routines_delete_coach" on public.workout_routines;
create policy "routines_delete_coach" on public.workout_routines
  for delete using (
    user_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- workout_routine_exercises — herda permissão pelo parent routine.
-- Necessário pro replaceRoutineExercises (delete all + insert) usado
-- pelo RoutineEditor no edit flow.
-- ---------------------------------------------------------------------
drop policy if exists "routine_exercises_insert_coach" on public.workout_routine_exercises;
create policy "routine_exercises_insert_coach" on public.workout_routine_exercises
  for insert with check (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id in (
        select id from public.profiles where coach_id = auth.uid()
      )
    )
  );

drop policy if exists "routine_exercises_update_coach" on public.workout_routine_exercises;
create policy "routine_exercises_update_coach" on public.workout_routine_exercises
  for update using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id in (
        select id from public.profiles where coach_id = auth.uid()
      )
    )
  );

drop policy if exists "routine_exercises_delete_coach" on public.workout_routine_exercises;
create policy "routine_exercises_delete_coach" on public.workout_routine_exercises
  for delete using (
    exists (
      select 1 from public.workout_routines r
      where r.id = workout_routine_exercises.routine_id
      and r.user_id in (
        select id from public.profiles where coach_id = auth.uid()
      )
    )
  );
