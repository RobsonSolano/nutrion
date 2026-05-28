// NutriOn — Edge Function cron-streak-warning
// Roda à noite (21h30 BRT = 00h30 UTC do dia seguinte). Avisa o
// aluno que está prestes a quebrar uma sequência de registros:
// se o streak terminado ONTEM é >= 2 dias E ainda não houve
// nenhum registro hoje (food/water/workout), envia push.
//
// Como agendar (painel Supabase → Database → Cron Jobs):
//   schedule '30 0 * * *'   (00h30 UTC = 21h30 BRT)
//   POST https://<project>.supabase.co/functions/v1/cron-streak-warning
//   header X-Cron-Secret: <CRON_SECRET>

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const THROTTLE_MS = 100;
const LOOKBACK_DAYS = 30;
const MIN_STREAK = 2;

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
    const yesterday = dayBeforeBrt(today);
    const sinceDate = nDaysBeforeBrt(today, LOOKBACK_DAYS);

    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name, goal_type')
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

      const activeDays = await fetchActiveDays(
        supabase,
        userId,
        sinceDate,
      );

      // Já registrou algo hoje? streak warning não se aplica
      if (activeDays.has(today)) {
        skipped++;
        skipReasons.active_today = (skipReasons.active_today ?? 0) + 1;
        continue;
      }

      const streak = streakEndingAt(activeDays, yesterday);
      if (streak < MIN_STREAK) {
        skipped++;
        skipReasons.streak_too_short =
          (skipReasons.streak_too_short ?? 0) + 1;
        continue;
      }

      const result = await sendPushAi(supabase, userId, 'streak_warning', {
        full_name: s.full_name,
        goal_type: s.goal_type,
        current_streak: streak,
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
    });
  } catch (err) {
    console.error('[cron-streak-warning] unexpected error:', err);
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
// Helpers (mesma lógica de cron-streak-celebrations, ajustada pra
// terminar em ONTEM em vez de HOJE)
// =====================================================================

function todayBrtIso(): string {
  const brt = new Date(Date.now() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

function dayBeforeBrt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nDaysBeforeBrt(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchActiveDays(
  // deno-lint-ignore no-explicit-any
  supa: ReturnType<typeof createClient<any, 'public', any>>,
  userId: string,
  sinceDate: string,
): Promise<Set<string>> {
  const sinceIso = `${sinceDate}T00:00:00Z`;
  const days = new Set<string>();

  const [foods, waters, sessions] = await Promise.all([
    supa
      .from('food_logs')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso),
    supa
      .from('water_logs')
      .select('day')
      .eq('user_id', userId)
      .gte('day', sinceDate),
    supa
      .from('workout_sessions')
      .select('day')
      .eq('user_id', userId)
      .gte('day', sinceDate),
  ]);

  for (const r of foods.data ?? []) {
    if (r.created_at) days.add(brtDayFromIso(r.created_at as string));
  }
  for (const r of waters.data ?? []) {
    if (r.day) days.add(r.day as string);
  }
  for (const r of sessions.data ?? []) {
    if (r.day) days.add(r.day as string);
  }
  return days;
}

function brtDayFromIso(iso: string): string {
  const d = new Date(iso);
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

function streakEndingAt(activeDays: Set<string>, endDay: string): number {
  if (!activeDays.has(endDay)) return 0;
  let streak = 0;
  let cursor = endDay;
  while (activeDays.has(cursor)) {
    streak++;
    cursor = dayBeforeBrt(cursor);
    if (streak > 200) break; // sanity
  }
  return streak;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
