import { suite, expect } from '../lib/runner.mjs';
import {
  adminClient,
  anonClient,
  cleanupUser,
  createTestUser,
} from '../lib/clients.mjs';

suite('Auth & Profile', ({ test }) => {
  test('signup → login → profile criado pelo trigger', async (ctx) => {
    const user = await createTestUser({ prefix: 'auth' });
    ctx.defer(() => cleanupUser(user));

    // Trigger handle_new_user cria o profile automaticamente.
    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single();

    expect(error).toBeNull();
    expect(profile.id).toBe(user.id);
    expect(profile.role).toBe('comum');
    expect(profile.full_name).toBeTruthy();
  });

  test('user lê só o próprio profile (RLS)', async (ctx) => {
    const userA = await createTestUser({ prefix: 'rls-a' });
    const userB = await createTestUser({ prefix: 'rls-b' });
    ctx.defer(() => cleanupUser(userA));
    ctx.defer(() => cleanupUser(userB));

    // userA tenta ler profile do userB via JWT.
    const { data, error } = await userA.client
      .from('profiles')
      .select('id')
      .eq('id', userB.id);

    // RLS retorna data vazia (não erro) — comportamento padrão.
    expect(error).toBeNull();
    expect(Array.isArray(data) ? data.length : -1).toBe(0);
  });

  test('user não pode mudar próprio role via cliente (trigger guard)', async (ctx) => {
    const user = await createTestUser({ prefix: 'guard' });
    ctx.defer(() => cleanupUser(user));

    // Tenta promover a si mesmo a professor via JWT — deve ser silenciosamente
    // ignorado pelo trigger guard_role_changes.
    await user.client
      .from('profiles')
      .update({ role: 'professor' })
      .eq('id', user.id);

    // Confirma via admin que o role NÃO mudou.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    expect(profile.role).toBe('comum');
  });

  test('login com senha errada falha', async (ctx) => {
    const user = await createTestUser({ prefix: 'wrongpw' });
    ctx.defer(() => cleanupUser(user));

    const { error } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: 'senha-errada',
    });
    expect(error).toBeTruthy();
  });
});
