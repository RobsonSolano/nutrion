import { suite, expect } from '../lib/runner.mjs';
import { cleanupUser, createTestUser } from '../lib/clients.mjs';

suite('Data export', ({ test }) => {
  test('user exporta os próprios dados (queries paralelas)', async (ctx) => {
    const user = await createTestUser({ prefix: 'export' });
    ctx.defer(() => cleanupUser(user));

    // Cria 1 food_log + 1 water_log pra ter o que exportar.
    await user.client.from('food_logs').insert({
      user_id: user.id,
      meal_name: 'Café',
      description: 'Café preto + ovos',
      calories: 250,
      protein_g: 18,
    });
    const today = new Date().toISOString().slice(0, 10);
    await user.client.from('water_logs').upsert(
      { user_id: user.id, day: today, volume_ml: 1500 },
      { onConflict: 'user_id,day' },
    );

    // Replica o que dataExport faz (queries paralelas isoladas por RLS).
    const [
      profileRes,
      foodRes,
      waterRes,
    ] = await Promise.all([
      user.client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      user.client.from('food_logs').select('*').eq('user_id', user.id),
      user.client.from('water_logs').select('*').eq('user_id', user.id),
    ]);

    expect(profileRes.error).toBeNull();
    expect(profileRes.data?.id).toBe(user.id);

    expect(foodRes.error).toBeNull();
    expect(foodRes.data.length).toBe(1);
    expect(foodRes.data[0].calories).toBe(250);

    expect(waterRes.error).toBeNull();
    expect(waterRes.data.length).toBe(1);
    expect(waterRes.data[0].volume_ml).toBe(1500);
  });

  test('user A não exporta dados de user B (RLS)', async (ctx) => {
    const userA = await createTestUser({ prefix: 'exp-a' });
    const userB = await createTestUser({ prefix: 'exp-b' });
    ctx.defer(() => cleanupUser(userA));
    ctx.defer(() => cleanupUser(userB));

    await userA.client.from('food_logs').insert({
      user_id: userA.id,
      meal_name: 'Privado',
      calories: 999,
    });

    const { data } = await userB.client.from('food_logs').select('*');
    expect(data.length).toBe(0);
  });
});
