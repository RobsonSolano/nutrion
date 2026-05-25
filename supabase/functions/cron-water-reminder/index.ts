// NutriOn — Edge Function cron-water-reminder
// Roda no fim do dia (20h BRT = 23h UTC) e envia push pra alunos
// que ainda estão abaixo de 50% da meta diária de água.
//
// Template fixo (sem IA): tipo conscientemente barato — frase de
// "ainda dá tempo" não muda nada com IA.
//
// Como agendar (painel Supabase → Database → Cron Jobs):
//   schedule '0 23 * * *'
//   POST https://<project>.supabase.co/functions/v1/cron-water-reminder
//   header X-Cron-Secret: <CRON_SECRET>

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const THROTTLE_MS = 100;
// Threshold a partir do qual NÃO mandamos lembrete (já está perto da meta)
const GOAL_PCT_THRESHOLD = 0.5;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!CRON_SECRET) {
    return json({ error: 'missing_cron_secret' }, 500);
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

    const today = todayBrtIso();

    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name, water_goal_ml')
      .in('role', ['aluno', 'comum'])
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
      const userId = s.id as string;
      const goalMl = (s.water_goal_ml ?? 0) as number;

      if (!goalMl || goalMl <= 0) {
        skipped++;
        skipReasons.no_goal = (skipReasons.no_goal ?? 0) + 1;
        continue;
      }

      const { data: water } = await supabase
        .from('water_logs')
        .select('volume_ml')
        .eq('user_id', userId)
        .eq('day', today)
        .maybeSingle();
      const nowMl = (water?.volume_ml ?? 0) as number;
      const pct = nowMl / goalMl;

      if (pct >= GOAL_PCT_THRESHOLD) {
        skipped++;
        skipReasons.goal_met = (skipReasons.goal_met ?? 0) + 1;
        continue;
      }

      const result = await sendPushAi(supabase, userId, 'water_reminder', {
        full_name: s.full_name,
        water_now_ml: nowMl,
        water_goal_ml: goalMl,
      });

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

      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }

    return json({
      ok: true,
      processed,
      sent,
      skipped,
      skipReasons,
      today,
      cutoff_pct: GOAL_PCT_THRESHOLD,
    });
  } catch (err) {
    console.error('[cron-water-reminder] unexpected error:', err);
    return json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

function todayBrtIso(): string {
  // BRT = UTC-3
  const brt = new Date(Date.now() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
