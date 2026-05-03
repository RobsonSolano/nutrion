// NutriOn — Edge Function cron-inactivity-reminders
// Roda agendada (diária) e envia push pra alunos que estão sem
// registrar nada (food, water, workout_session) há 2+ dias.
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
import { sendExpoPush } from '../_shared/expoPush.ts';

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

    // Limites usados no NOT EXISTS (timestamp pra logs com created_at,
    // date pra colunas day).
    const cutoffIso = new Date(
      Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const cutoffDate = cutoffIso.slice(0, 10);

    // Lista alunos com push habilitado.
    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'aluno')
      .not('expo_push_token', 'is', null);
    if (stErr) {
      return json(
        { error: 'students_fetch_failed', detail: stErr.message },
        500,
      );
    }

    let processed = 0;
    let notified = 0;
    let skippedNoToken = 0;
    let skippedActive = 0;

    for (const s of students ?? []) {
      processed++;
      const studentId = s.id as string;

      // Tem food_log nos últimos 2 dias?
      const [foodCount, sessionCount, waterCount] = await Promise.all([
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
      ]);

      const totalActivity =
        (foodCount.count ?? 0) +
        (sessionCount.count ?? 0) +
        (waterCount.count ?? 0);

      if (totalActivity > 0) {
        skippedActive++;
        continue;
      }

      const result = await sendExpoPush(supabase, studentId, {
        title: 'Sentimos sua falta!',
        body: 'Como foi seu dia? Registre uma refeição, água ou treino pra manter a constância.',
        data: { event: 'inactivity_reminder' },
      });

      if (result.ok && result.skipped === 'no_token') {
        skippedNoToken++;
      } else if (result.ok) {
        notified++;
      }
    }

    return json({
      ok: true,
      processed,
      notified,
      skippedActive,
      skippedNoToken,
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
