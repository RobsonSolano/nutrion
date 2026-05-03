import { suite, expect } from '../lib/runner.mjs';
import {
  adminClient,
  cleanupUser,
  createTestUser,
} from '../lib/clients.mjs';

suite('Workout routines', ({ test }) => {
  test('criar routine + exercícios + listar', async (ctx) => {
    const user = await createTestUser({ prefix: 'routine' });
    ctx.defer(() => cleanupUser(user));

    // Pega um group_id real do catálogo pra associar.
    const { data: groups } = await adminClient
      .from('exercise_groups')
      .select('id')
      .eq('slug', 'chest')
      .limit(1);
    const groupId = groups?.[0]?.id ?? null;

    const { data: routine, error: rErr } = await user.client
      .from('workout_routines')
      .insert({
        user_id: user.id,
        name: 'Peito A — teste',
        modality: 'musculacao',
        group_id: groupId,
        description: 'Rotina de teste',
      })
      .select('*')
      .single();
    expect(rErr).toBeNull();
    expect(routine.name).toBe('Peito A — teste');

    const { error: exErr } = await user.client
      .from('workout_routine_exercises')
      .insert([
        {
          routine_id: routine.id,
          exercise_name: 'Supino reto (barra)',
          equipment: 'barra',
          sort_order: 0,
          sets: 4,
          reps_min: 6,
          reps_max: 10,
        },
        {
          routine_id: routine.id,
          exercise_name: 'Crucifixo (halter)',
          equipment: 'halter',
          sort_order: 1,
          sets: 3,
          reps_min: 8,
          reps_max: 12,
        },
      ]);
    expect(exErr).toBeNull();

    const { data: withExercises } = await user.client
      .from('workout_routines')
      .select('*, exercises:workout_routine_exercises(count)')
      .eq('id', routine.id)
      .single();
    expect(withExercises.exercises[0].count).toBe(2);
  });

  test('aluno não consegue criar routine própria (RLS lock)', async (ctx) => {
    // Cria usuário e força role=aluno via admin (pra simular um aluno
    // cadastrado por professor).
    const user = await createTestUser({ prefix: 'studentlock' });
    ctx.defer(() => cleanupUser(user));

    // Promove a aluno simulando a edge function coach-create-student.
    // coach_id pode ser null pra esse teste — só interessa o role.
    await adminClient
      .from('profiles')
      .update({ role: 'aluno' })
      .eq('id', user.id);

    const { error } = await user.client.from('workout_routines').insert({
      user_id: user.id,
      name: 'Tentativa do aluno',
      modality: 'musculacao',
    });

    // RLS deve bloquear o INSERT.
    expect(error).toBeTruthy();
  });
});
