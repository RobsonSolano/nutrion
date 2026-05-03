// NutriOn — Edge Function send-push-notification
// Envia push via Expo Push API. Chamável pelo cliente com event_type
// específico — internamente valida ownership e descobre o destinatário.
//
// Eventos suportados:
//   new_request       — aluno cria solicitação → push pro coach
//   request_response  — coach responde solicitação → push pro aluno
//
// Free tier do Expo Push é gratuito e ilimitado pra esse volume.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendExpoPush } from '../_shared/expoPush.ts';

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
  event: 'new_request' | 'request_response';
  request_id: string;
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
    if (!body?.event || !body?.request_id) {
      return json(
        { error: 'invalid_body', detail: 'event e request_id obrigatórios.' },
        400,
      );
    }

    // Pega a request + nomes via join com profiles.
    const { data: request, error: reqErr } = await supabaseService
      .from('student_requests')
      .select(
        'id, student_id, coach_id, message, status, coach_response, student:profiles!student_requests_student_id_fkey(full_name), coach:profiles!student_requests_coach_id_fkey(full_name)',
      )
      .eq('id', body.request_id)
      .single();

    if (reqErr || !request) {
      return json({ error: 'request_not_found' }, 404);
    }

    let recipientId: string;
    let title: string;
    let bodyText: string;

    if (body.event === 'new_request') {
      // Caller precisa ser o student da request.
      if (caller.id !== request.student_id) {
        return json({ error: 'forbidden' }, 403);
      }
      recipientId = request.coach_id;
      const studentName =
        // deno-lint-ignore no-explicit-any
        (request.student as any)?.full_name ?? 'Um aluno';
      title = 'Nova solicitação';
      bodyText = `${studentName} abriu uma solicitação.`;
    } else if (body.event === 'request_response') {
      // Caller precisa ser o coach da request.
      if (caller.id !== request.coach_id) {
        return json({ error: 'forbidden' }, 403);
      }
      recipientId = request.student_id;
      const coachName =
        // deno-lint-ignore no-explicit-any
        (request.coach as any)?.full_name ?? 'Seu professor';
      title = 'Resposta do professor';
      bodyText = `${coachName} respondeu sua solicitação.`;
    } else {
      return json({ error: 'unknown_event' }, 400);
    }

    const result = await sendExpoPush(supabaseService, recipientId, {
      title,
      body: bodyText,
      data: { event: body.event, request_id: body.request_id },
    });
    if (!result.ok) {
      return json({ error: 'expo_push_failed', detail: result.error }, 502);
    }
    return json(result);
  } catch (err) {
    console.error('[send-push-notification] unexpected error:', err);
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
