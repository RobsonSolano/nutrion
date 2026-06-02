// NutriOn — Edge Function delete-my-account
//
// Fluxo de auto-exclusão de conta exigido por LGPD, Play Store e
// App Store. Chamado pelo próprio user autenticado (JWT). Hard delete:
// supabase.auth.admin.deleteUser → cascade limpa profile, logs,
// rotinas, anamneses, etc. Email libera pra recadastro imediato.
//
// Em ordem:
//   1. Lê profile do caller (+ email via admin).
//   2. Se role='professor': bloqueia se houver alunos vinculados (409).
//   3. Se role='aluno' E coach_id: dispara push pro coach
//      (fire-and-forget) ANTES do delete — depois não tem como saber
//      quem era nem ter o token (cascade apaga).
//   4. INSERT em account_deletion_log (auditoria sem PII, só hashes).
//   5. auth.admin.deleteUser(caller.id) → cascade total.
//   6. Retorna { ok: true }.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_REASON_LEN = 500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  reason?: string | null;
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
    const reasonRaw = (body?.reason ?? '').toString().trim();
    const reason = reasonRaw.length > 0
      ? reasonRaw.slice(0, MAX_REASON_LEN)
      : null;

    // 1. Lê profile + email
    const { data: profile, error: profileErr } = await supaService
      .from('profiles')
      .select('id, role, full_name, coach_id, created_at')
      .eq('id', caller.id)
      .single();
    if (profileErr || !profile) {
      return json({ error: 'profile_not_found' }, 404);
    }

    const email = caller.email ?? '';

    // 2. Pré-check: professor com alunos vinculados
    if (profile.role === 'professor') {
      const { data: students, error: stErr } = await supaService
        .from('profiles')
        .select('id')
        .eq('coach_id', caller.id);
      if (stErr) {
        return json(
          { error: 'students_check_failed', detail: stErr.message },
          500,
        );
      }
      if ((students?.length ?? 0) > 0) {
        return json(
          {
            error: 'has_students',
            student_count: students!.length,
            student_ids: students!.map((s) => s.id),
          },
          409,
        );
      }
    }

    // 3. Se aluno com coach: push pro coach ANTES do delete
    if (profile.role === 'aluno' && profile.coach_id) {
      const accountAgeDays = profile.created_at
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(profile.created_at as string).getTime())
                / (24 * 3600 * 1000),
            ),
          )
        : 0;

      // Fire-and-forget — não bloqueia exclusão se push falhar.
      try {
        await sendPushAi(supaService, profile.coach_id as string, 'student_account_deleted', {
          student_name: profile.full_name ?? 'Um aluno',
          account_age_days: accountAgeDays,
          last_activity_summary: 'sem dados', // optional, evitamos query pesada
        });
      } catch (err) {
        console.error('[delete-my-account] push coach falhou:', err);
      }
    }

    // 4. INSERT em account_deletion_log (auditoria sem PII)
    const accountAgeDays = profile.created_at
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(profile.created_at as string).getTime())
              / (24 * 3600 * 1000),
          ),
        )
      : null;

    // Audit insert direto via service_role (bypassa RLS). Hashes
    // computados aqui no edge — WebCrypto disponível no Deno.
    const { error: insertErr } = await supaService
      .from('account_deletion_log')
      .insert({
        user_id_hash: await sha256(caller.id),
        email_hash: email ? await sha256(email) : null,
        role: profile.role,
        was_linked_to_coach_id: profile.coach_id,
        account_age_days: accountAgeDays,
        deletion_reason: reason,
      });
    if (insertErr) {
      console.error('[delete-my-account] audit log falhou:', insertErr);
      // NÃO aborta — audit é nice-to-have, não pode bloquear LGPD.
    }

    // 5. Hard delete via auth admin → cascade limpa tudo
    const { error: deleteErr } = await supaService.auth.admin.deleteUser(
      caller.id,
    );
    if (deleteErr) {
      return json(
        { error: 'delete_failed', detail: deleteErr.message },
        500,
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[delete-my-account] unexpected:', err);
    return json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

// =====================================================================
// Helpers
// =====================================================================

// SHA-256 hex usando WebCrypto (disponível no Deno runtime).
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
