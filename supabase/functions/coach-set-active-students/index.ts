// Persona Fit — Edge Function coach-set-active-students
//
// Recebe o CONJUNTO de alunos que devem ficar ATIVOS. Marca os de fora como
// suspensos e os de dentro como ativos, depois chama sync_coach_student_access
// pra normalizar contra o limite do tier. Caminho único (sem toggle 1-a-1).

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

type Body = { active_ids: string[] };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'unauthorized' }, 401);
    }

    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supaService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await supaAuth.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || !Array.isArray(body.active_ids)) {
      return json({ error: 'invalid_body', detail: 'active_ids obrigatório.' }, 400);
    }
    const activeIds = [...new Set(body.active_ids)];

    // Limite do tier do professor.
    const { data: ent, error: entErr } = await supaService.rpc(
      '_resolve_entitlement',
      { p_uid: caller.id },
    );
    if (entErr) {
      return json({ error: 'entitlement_failed', detail: entErr.message }, 500);
    }
    const limit = (ent as { student_limit: number | null }).student_limit;
    if (limit !== null && activeIds.length > limit) {
      return json({ error: 'needs_upgrade', feature: 'student_limit' }, 402);
    }

    // Todos os alunos do professor.
    const { data: students, error: studentsErr } = await supaService
      .from('profiles')
      .select('id')
      .eq('coach_id', caller.id)
      .eq('role', 'aluno');
    if (studentsErr) {
      return json({ error: 'load_failed', detail: studentsErr.message }, 500);
    }
    const ownedIds = new Set((students ?? []).map((s) => s.id as string));

    // Ownership: todo active_id precisa ser aluno do caller.
    if (activeIds.some((id) => !ownedIds.has(id))) {
      return json({ error: 'forbidden', detail: 'aluno fora do seu vínculo.' }, 403);
    }

    const suspendIds = [...ownedIds].filter((id) => !activeIds.includes(id));

    // Ativa os do conjunto.
    if (activeIds.length > 0) {
      const { error } = await supaService
        .from('profiles')
        .update({ suspended_at: null })
        .in('id', activeIds)
        .eq('coach_id', caller.id);
      if (error) return json({ error: 'update_failed', detail: error.message }, 500);
    }
    // Suspende o restante.
    if (suspendIds.length > 0) {
      const { error } = await supaService
        .from('profiles')
        .update({ suspended_at: new Date().toISOString() })
        .in('id', suspendIds)
        .eq('coach_id', caller.id)
        .is('suspended_at', null);
      if (error) return json({ error: 'update_failed', detail: error.message }, 500);
    }

    // Normaliza contra o limite (segurança/idempotência).
    const { error: syncErr } = await supaService.rpc('sync_coach_student_access', {
      p_coach_id: caller.id,
    });
    if (syncErr) {
      console.error('[coach-set-active] sync:', syncErr.message);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[coach-set-active-students] unexpected:', err);
    return json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : String(err) },
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
