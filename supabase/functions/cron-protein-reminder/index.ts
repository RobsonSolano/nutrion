// NutriOn — Edge Function cron-protein-reminder
// Roda no fim do dia (21h BRT = 00h UTC do dia seguinte) e envia
// push pra alunos que estão abaixo de 70% da meta de proteína.
// Conteúdo gerado por IA (Groq) via sendPushAi.
//
// Como agendar (painel Supabase → Database → Cron Jobs):
//   schedule '0 0 * * *'   (00h UTC = 21h BRT)
//   POST https://<project>.supabase.co/functions/v1/cron-protein-reminder
//   header X-Cron-Secret: <CRON_SECRET>

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const THROTTLE_MS = 100;
const GOAL_PCT_THRESHOLD = 0.7;

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
    const todayStartUtc = `${today}T03:00:00Z`; // 00h BRT = 03h UTC
    const tomorrowStartUtc = nextDayUtcIso(today);

    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name, goal_type, protein_goal_g')
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
      const goalG = (s.protein_goal_g ?? 0) as number;

      if (!goalG || goalG <= 0) {
        skipped++;
        skipReasons.no_goal = (skipReasons.no_goal ?? 0) + 1;
        continue;
      }

      const { data: foods } = await supabase
        .from('food_logs')
        .select('protein_g')
        .eq('user_id', userId)
        .gte('created_at', todayStartUtc)
        .lt('created_at', tomorrowStartUtc);

      const consumedG = (foods ?? []).reduce(
        (acc, row) => acc + ((row.protein_g as number | null) ?? 0),
        0,
      );
      const pct = consumedG / goalG;

      if (pct >= GOAL_PCT_THRESHOLD) {
        skipped++;
        skipReasons.goal_met = (skipReasons.goal_met ?? 0) + 1;
        continue;
      }

      const gapG = Math.max(0, goalG - consumedG);

      const result = await sendPushAi(supabase, userId, 'protein_reminder', {
        full_name: s.full_name,
        goal_type: s.goal_type,
        protein_consumed_g: consumedG,
        protein_goal_g: goalG,
        gap_g: gapG,
        meals_logged_today: foods?.length ?? 0,
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
    console.error('[cron-protein-reminder] unexpected error:', err);
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
  const brt = new Date(Date.now() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

function nextDayUtcIso(brtDate: string): string {
  const d = new Date(`${brtDate}T03:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
