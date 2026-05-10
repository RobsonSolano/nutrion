// NutriOn — Edge Function cron-streak-celebrations
// Roda diariamente. Detecta alunos que bateram um marco de constância
// HOJE (3, 7, 14, 30, 60 ou 100 dias seguidos com pelo menos 1 log).
// Conteúdo gerado por IA via sendPushAi.
//
// Definição de "dia ativo": ao menos 1 registro em food_logs,
// water_logs ou workout_sessions.
// Streak conta dias consecutivos terminando em HOJE (BRT).
//
// Como agendar:
//   schedule '30 23 * * *' (23:30 UTC = 20:30 BRT) — fim de noite.
//   POST pra https://<project>.supabase.co/functions/v1/cron-streak-celebrations
//   com header X-Cron-Secret.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const LOOKBACK_DAYS = 110; // cobre streak máximo (100) com folga
const THROTTLE_MS = 100;

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
    const lookbackDate = new Date(
      Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    const { data: students, error: stErr } = await supabase
      .from('profiles')
      .select('id, full_name')
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
    let noMilestone = 0;
    const milestoneHits: Record<number, number> = {};
    const skipReasons: Record<string, number> = {};

    for (const s of students ?? []) {
      processed++;
      const userId = s.id as string;

      const activeDays = await fetchActiveDays(
        supabase,
        userId,
        lookbackDate,
      );
      const streak = currentStreak(activeDays, today);

      if (!STREAK_MILESTONES.includes(streak)) {
        noMilestone++;
        continue;
      }
      milestoneHits[streak] = (milestoneHits[streak] ?? 0) + 1;

      const dominant = await dominantLogType(supabase, userId);

      const result = await sendPushAi(
        supabase,
        userId,
        'streak_celebration',
        {
          full_name: s.full_name,
          streak_days: streak,
          dominant_log_type: dominant,
        },
      );

      if (result.ok && result.status === 'sent') {
        sent++;
      } else {
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
      noMilestone,
      milestoneHits,
      skipReasons,
      today,
    });
  } catch (err) {
    console.error('[cron-streak-celebrations] unexpected error:', err);
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
function todayBrtIso(): string {
  const now = new Date();
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

function dayBeforeBrt(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
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

function currentStreak(activeDays: Set<string>, today: string): number {
  // Streak = sequência de dias consecutivos com atividade,
  // CONTANDO HOJE (não enviamos push se streak terminou ontem).
  if (!activeDays.has(today)) return 0;
  let streak = 0;
  let cursor = today;
  while (activeDays.has(cursor)) {
    streak++;
    cursor = dayBeforeBrt(cursor);
    if (streak > 200) break; // sanity
  }
  return streak;
}

async function dominantLogType(
  // deno-lint-ignore no-explicit-any
  supa: ReturnType<typeof createClient<any, 'public', any>>,
  userId: string,
): Promise<'refeição' | 'treino' | 'água'> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const sinceDate = since.slice(0, 10);
  const [foods, waters, sessions] = await Promise.all([
    supa
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since),
    supa
      .from('water_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('day', sinceDate),
    supa
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('day', sinceDate),
  ]);
  const counts: { type: 'refeição' | 'água' | 'treino'; n: number }[] = [
    { type: 'refeição', n: foods.count ?? 0 },
    { type: 'água', n: waters.count ?? 0 },
    { type: 'treino', n: sessions.count ?? 0 },
  ];
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].type : 'treino';
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
