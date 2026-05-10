// NutriOn — Edge Function cron-inactivity-reminders
// Roda agendada (diária) e envia push pra alunos que estão sem
// registrar nada (food, water, workout_session) há 2+ dias.
//
// V2 (push-ai): conteúdo gerado por IA (Groq Llama 3.3 70B) via
// helper sendPushAi, que cuida de opt-out, cooldown, quiet hours
// e log em push_history.
//
// Autenticação via X-Cron-Secret header (env var CRON_SECRET) pra
// evitar que qualquer um trigger isso. Não usa JWT — é chamada
// server-to-server pelo agendador.
//
// Como agendar:
// 1) Painel Supabase → Database → Cron Jobs → New Cron Job
//    (ou via SQL com pg_cron + pg_net), schedule '0 12 * * *' (12h UTC),
//    POST pra https://<project>.supabase.co/functions/v1/cron-inactivity-reminders
//    com header X-Cron-Secret igual ao secret configurado.
// 2) Alternativa: GitHub Actions com cron + curl.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INACTIVITY_DAYS = 2;
const THROTTLE_MS = 100; // espaça chamadas Groq no batch

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!CRON_SECRET) {
    return json(
      {
        error: 'missing_cron_secret',
        detail:
          'CRON_SECRET nao configurada. Rode: npx supabase secrets set CRON_SECRET="<algo-aleatorio>".',
      },
      500,
    );
  }
  if (req.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();
    const cutoffIso = new Date(
      now - INACTIVITY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const cutoffDate = cutoffIso.slice(0, 10);
    const weekAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name, goal_type')
      .eq('role', 'aluno')
      .not('expo_push_token', 'is', null);
    if (stErr) {
      return json(
        { error: 'students_fetch_failed', detail: stErr.message },
        500,
      );
    }

    let processed = 0;
    let sent = 0;
    let skipped = 0;
    const skipReasons: Record<string, number> = {};

    for (const s of students ?? []) {
      processed++;
      const studentId = s.id as string;

      const [foodCount, sessionCount, waterCount, lastActivity, weekRemindersCount] =
        await Promise.all([
          supabase
            .from('food_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', studentId)
            .gte('created_at', cutoffIso),
          supabase
            .from('workout_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', studentId)
            .gte('day', cutoffDate),
          supabase
            .from('water_logs')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', studentId)
            .gte('day', cutoffDate),
          // Última atividade qualquer pra resumo do contexto
          supabase
            .from('food_logs')
            .select('created_at')
            .eq('user_id', studentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // Quantos lembretes de inatividade já enviei nos últimos 7 dias
          supabase
            .from('push_history')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', studentId)
            .eq('type', 'inactivity_reminder')
            .eq('status', 'sent')
            .gte('sent_at', weekAgoIso),
        ]);

      const totalActivity =
        (foodCount.count ?? 0) +
        (sessionCount.count ?? 0) +
        (waterCount.count ?? 0);

      if (totalActivity > 0) {
        skipped++;
        skipReasons.active = (skipReasons.active ?? 0) + 1;
        continue;
      }

      const lastActivityIso = lastActivity.data?.created_at as string | null;
      const daysInactive = lastActivityIso
        ? Math.floor(
            (now - new Date(lastActivityIso).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : INACTIVITY_DAYS;
      const lastActivitySummary = lastActivityIso
        ? `há ${daysInactive} dias`
        : 'sem registro recente';

      const result = await sendPushAi(
        supabase,
        studentId,
        'inactivity_reminder',
        {
          full_name: s.full_name,
          goal_type: s.goal_type,
          days_inactive: daysInactive,
          last_activity_summary: lastActivitySummary,
          nth_inactivity_reminder_in_week: (weekRemindersCount.count ?? 0) + 1,
        },
      );

      if (result.ok && result.status === 'sent') {
        sent++;
      } else {
        skipped++;
        const reason =
          'reason' in result
            ? result.reason
            : 'error' in result
              ? 'error'
              : 'unknown';
        skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
      }

      // Throttle pra não saturar Groq rate limit
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }

    return json({
      ok: true,
      processed,
      sent,
      skipped,
      skipReasons,
      cutoffIso,
    });
  } catch (err) {
    console.error('[cron-inactivity-reminders] unexpected error:', err);
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
