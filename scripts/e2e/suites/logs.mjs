import { suite, expect } from '../lib/runner.mjs';
import { cleanupUser, createTestUser } from '../lib/clients.mjs';

suite('Logs (food / water / workout_session)', ({ test }) => {
  test('food_log: criar, listar, deletar', async (ctx) => {
    const user = await createTestUser({ prefix: 'food' });
    ctx.defer(() => cleanupUser(user));

    const { data: created, error: insErr } = await user.client
      .from('food_logs')
      .insert({
        user_id: user.id,
        meal_name: 'Almoço de teste',
        description: '150g arroz, 120g frango',
        calories: 600,
        protein_g: 40,
        carbs_g: 70,
        fats_g: 12,
      })
      .select('*')
      .single();
    expect(insErr).toBeNull();
    expect(created.calories).toBe(600);
    expect(created.user_id).toBe(user.id);

    const { data: list, error: listErr } = await user.client
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id);
    expect(listErr).toBeNull();
    expect(list.length).toBe(1);

    // Cleanup explícito (cascade do user também cobriria, mas testar
    // delete com RLS é parte do teste).
    const { error: delErr } = await user.client
      .from('food_logs')
      .delete()
      .eq('id', created.id);
    expect(delErr).toBeNull();
  });

  test('water_log: upsert por dia', async (ctx) => {
    const user = await createTestUser({ prefix: 'water' });
    ctx.defer(() => cleanupUser(user));

    const today = new Date().toISOString().slice(0, 10);

    const { error: insErr } = await user.client
      .from('water_logs')
      .upsert(
        { user_id: user.id, day: today, volume_ml: 500 },
        { onConflict: 'user_id,day' },
      );
    expect(insErr).toBeNull();

    // Upsert de novo com volume diferente — deve atualizar, não duplicar.
    await user.client
      .from('water_logs')
      .upsert(
        { user_id: user.id, day: today, volume_ml: 1500 },
        { onConflict: 'user_id,day' },
      );

    const { data: rows } = await user.client
      .from('water_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('day', today);

    expect(rows.length).toBe(1);
    expect(rows[0].volume_ml).toBe(1500);
  });

  test('workout_session: criar e marcar dia', async (ctx) => {
    const user = await createTestUser({ prefix: 'session' });
    ctx.defer(() => cleanupUser(user));

    const today = new Date().toISOString().slice(0, 10);

    const { data: session, error } = await user.client
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        routine_id: null,
        routine_name: 'Treino livre — teste',
        day: today,
        duration_min: 45,
        notes: 'Foco em peito',
      })
      .select('*')
      .single();
    expect(error).toBeNull();
    expect(session.routine_name).toBe('Treino livre — teste');
    expect(session.day).toBe(today);
  });

  test('user A não vê food_logs de user B (RLS)', async (ctx) => {
    const userA = await createTestUser({ prefix: 'iso-a' });
    const userB = await createTestUser({ prefix: 'iso-b' });
    ctx.defer(() => cleanupUser(userA));
    ctx.defer(() => cleanupUser(userB));

    await userA.client
      .from('food_logs')
      .insert({ user_id: userA.id, meal_name: 'Privado de A', calories: 100 });

    const { data: visibleToB } = await userB.client.from('food_logs').select('*');
    expect(visibleToB.length).toBe(0);
  });
});
