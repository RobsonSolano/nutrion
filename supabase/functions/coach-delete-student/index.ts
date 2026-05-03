// NutriOn — Edge Function coach-delete-student
// Permite que o professor exclua um aluno. Usa
// supabase.auth.admin.deleteUser que deleta o auth.users — cascade
// limpa profile, food/water/workout logs, sessions, chat_messages,
// ai_usage_log, student_requests etc (todos têm FK pra profiles ou
// auth.users com on delete cascade).

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  student_id: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAuth.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.student_id) {
      return json(
        { error: 'invalid_body', detail: 'student_id obrigatório.' },
        400,
      );
    }

    // Valida ownership.
    const { data: student, error: studentErr } = await supabaseService
      .from('profiles')
      .select('id, role, coach_id')
      .eq('id', body.student_id)
      .single();
    if (studentErr || !student) {
      return json({ error: 'student_not_found' }, 404);
    }
    if (student.role !== 'aluno' || student.coach_id !== caller.id) {
      return json({ error: 'forbidden' }, 403);
    }

    // Delete em auth.users cascateia tudo (profiles + logs + etc).
    const { error: deleteErr } = await supabaseService.auth.admin.deleteUser(
      body.student_id,
    );
    if (deleteErr) {
      return json(
        { error: 'delete_failed', detail: deleteErr.message },
        500,
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[coach-delete-student] unexpected error:', err);
    return json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
