// NutriOn — Edge Function coach-unlink-student
//
// Substitui o `coach-delete-student` no fluxo do coach: em vez de
// excluir a conta do aluno (LGPD/loja não permite mais coach deletar),
// transforma o aluno em usuário comum.
//
// Em ordem:
//   1. DELETE coach_notes WHERE student_id=X AND coach_id=caller
//      (privacidade do ex-aluno — coach perde memória das notas)
//   2. UPDATE student_plan_revisions SET coach_id=null
//      (aluno mantém via auth.uid()=student_id; coach perde via RLS)
//   3. UPDATE profiles SET role='comum', coach_id=null
//      (desvínculo principal)
//   4. Dispara push pro aluno (fire-and-forget) tipo coach_unlinked
//
// Cada passo grava erro se falhar, mas só interrompe se o passo 3
// falhar (que é o desvínculo de fato). Notes/revisions são limpezas
// de privacidade — devem rodar mas não bloqueiam o desvínculo.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

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
    if (!body?.student_id) {
      return json(
        { error: 'invalid_body', detail: 'student_id obrigatório.' },
        400,
      );
    }

    // Valida ownership: caller é o coach desse aluno.
    const { data: student, error: studentErr } = await supaService
      .from('profiles')
      .select('id, role, coach_id, full_name, created_at')
      .eq('id', body.student_id)
      .single();
    if (studentErr || !student) {
      return json({ error: 'student_not_found' }, 404);
    }
    if (student.role !== 'aluno' || student.coach_id !== caller.id) {
      return json({ error: 'forbidden' }, 403);
    }

    // Lê nome do coach pra contexto do push (antes de qualquer mudança).
    const { data: coachProfile } = await supaService
      .from('profiles')
      .select('full_name')
      .eq('id', caller.id)
      .single();

    // 1. Apaga notas privadas do coach sobre o aluno (privacidade).
    const { error: notesErr } = await supaService
      .from('coach_notes')
      .delete()
      .eq('student_id', body.student_id)
      .eq('coach_id', caller.id);
    if (notesErr) {
      console.error('[coach-unlink] coach_notes delete:', notesErr.message);
      // Não aborta — passo 3 ainda deve rodar
    }

    // 2. Anula coach_id nas plan_revisions (aluno mantém via student_id).
    const { error: revisionsErr } = await supaService
      .from('student_plan_revisions')
      .update({ coach_id: null })
      .eq('student_id', body.student_id)
      .eq('coach_id', caller.id);
    if (revisionsErr) {
      console.error(
        '[coach-unlink] plan_revisions update:',
        revisionsErr.message,
      );
      // Não aborta
    }

    // 3. Desvínculo principal — passo crítico.
    const { error: unlinkErr } = await supaService
      .from('profiles')
      .update({ role: 'comum', coach_id: null })
      .eq('id', body.student_id)
      .eq('coach_id', caller.id); // double-check
    if (unlinkErr) {
      return json(
        { error: 'unlink_failed', detail: unlinkErr.message },
        500,
      );
    }

    // 3.5 Concede o trial de servidor ao ex-aluno (spec #3, [TRIAL]-03).
    // Best-effort: não reverte o desvínculo se falhar. grant_server_trial é
    // grandfather-safe + anti-abuso (não concede a quem é grandfather/já consumiu).
    let trialGranted = false;
    try {
      const { data: grantResult } = await supaService.rpc('grant_server_trial', {
        p_uid: body.student_id,
      });
      trialGranted = grantResult === 'granted';
    } catch (err) {
      console.error('[coach-unlink] grant_server_trial falhou:', err);
    }

    // Desvincular liberou uma vaga: reconcilia pra reativar o suspenso mais antigo (se houver).
    // Best-effort: não impacta o retorno do desvínculo.
    try {
      const { error: syncErr } = await supaService.rpc('sync_coach_student_access', {
        p_coach_id: caller.id,
      });
      if (syncErr) {
        console.error('[coach-unlink] sync_coach_student_access:', syncErr.message);
      }
    } catch (err) {
      console.error('[coach-unlink] sync falhou:', err);
    }

    // 4. Push pro aluno (fire-and-forget). Falha não impacta retorno.
    const daysWithCoach = student.created_at
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(student.created_at as string).getTime())
              / (24 * 3600 * 1000),
          ),
        )
      : 0;

    void sendPushAi(supaService, body.student_id, 'coach_unlinked', {
      coach_name: (coachProfile?.full_name as string | null) ?? 'Seu professor',
      days_with_coach: daysWithCoach,
      trial_granted: trialGranted,
      trial_days: trialGranted ? 7 : 0,
    }).catch((err) => {
      console.error('[coach-unlink] push falhou:', err);
    });

    return json({ ok: true, trial_granted: trialGranted });
  } catch (err) {
    console.error('[coach-unlink-student] unexpected:', err);
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
