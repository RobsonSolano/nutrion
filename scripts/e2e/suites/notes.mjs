import { suite, expect } from '../lib/runner.mjs';
import {
  adminClient,
  cleanupUser,
  createTestUser,
  userClient,
} from '../lib/clients.mjs';

const FN_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function callFn(name, accessToken, body) {
  const res = await fetch(`${FN_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, body: await res.json() };
}

async function setupCoachAndStudent(ctx, prefix) {
  const coach = await createTestUser({ prefix: `${prefix}-coach` });
  ctx.defer(() => cleanupUser(coach));
  await callFn('signup-professor', coach.accessToken, {});

  const email = `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@nutrion-test.local`;
  const password = 'test-1234';
  const create = await callFn('coach-create-student', coach.accessToken, {
    email,
    password,
    full_name: 'Aluno Notas',
  });
  const studentId = create.body.student.id;
  ctx.defer(() => adminClient.auth.admin.deleteUser(studentId).catch(() => {}));

  const { data: signIn } = await adminClient.auth.signInWithPassword({
    email,
    password,
  });

  return {
    coach,
    student: {
      id: studentId,
      accessToken: signIn.session.access_token,
      client: userClient(signIn.session.access_token),
    },
  };
}

suite('Coach notes (privacidade)', ({ test }) => {
  test('coach cria nota e lê', async (ctx) => {
    const { coach, student } = await setupCoachAndStudent(ctx, 'note-rw');

    const { data: note, error } = await coach.client
      .from('coach_notes')
      .insert({
        coach_id: coach.id,
        student_id: student.id,
        body: 'Aluno pesou 78kg hoje.',
      })
      .select('*')
      .single();
    expect(error).toBeNull();
    expect(note.body).toBe('Aluno pesou 78kg hoje.');
  });

  test('aluno NÃO lê coach_notes do próprio coach', async (ctx) => {
    const { coach, student } = await setupCoachAndStudent(ctx, 'note-priv');

    await coach.client.from('coach_notes').insert({
      coach_id: coach.id,
      student_id: student.id,
      body: 'Anotação privada.',
    });

    const { data, error } = await student.client
      .from('coach_notes')
      .select('*');
    // RLS do aluno: zero policies ⇒ select retorna vazio sem erro.
    expect(error).toBeNull();
    expect(data.length).toBe(0);
  });

  test('coach edita e exclui própria nota', async (ctx) => {
    const { coach, student } = await setupCoachAndStudent(ctx, 'note-edit');

    const { data: note } = await coach.client
      .from('coach_notes')
      .insert({
        coach_id: coach.id,
        student_id: student.id,
        body: 'Nota inicial',
      })
      .select('*')
      .single();

    const { data: updated } = await coach.client
      .from('coach_notes')
      .update({ body: 'Nota editada' })
      .eq('id', note.id)
      .select('*')
      .single();
    expect(updated.body).toBe('Nota editada');
    expect(updated.updated_at).toBeTruthy();

    const { error: delErr } = await coach.client
      .from('coach_notes')
      .delete()
      .eq('id', note.id);
    expect(delErr).toBeNull();

    const { data: afterDelete } = await coach.client
      .from('coach_notes')
      .select('*')
      .eq('id', note.id);
    expect(afterDelete.length).toBe(0);
  });
});
