// NutriOn — Edge Function cron-daily-workout-check
// Roda à noite (20h30 BRT = 23h30 UTC). Infere o padrão semanal de
// treino do aluno olhando 28 dias de workout_sessions: se hoje
// (BRT) é um dia em que ele costuma treinar (>= 2 das 4 últimas
// semanas) E hoje ainda não houve sessão, envia push.
//
// NÃO depende de workout_routines.day_of_week (que não existe).
//
// Como agendar (painel Supabase → Database → Cron Jobs):
//   schedule '30 23 * * *'   (23h30 UTC = 20h30 BRT)
//   POST https://<project>.supabase.co/functions/v1/cron-daily-workout-check
//   header X-Cron-Secret: <CRON_SECRET>

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const THROTTLE_MS = 100;
const LOOKBACK_DAYS = 28;
const TYPICAL_THRESHOLD = 2; // >= 2 das últimas 4 semanas no mesmo dia da semana

const WEEKDAY_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

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
    const sinceDate = nDaysBeforeBrt(today, LOOKBACK_DAYS);
    const todayWeekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0..6

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

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('day')
        .eq('user_id', userId)
        .gte('day', sinceDate);

      const sessionDays = (sessions ?? [])
        .map((r) => r.day as string)
        .filter(Boolean);

      // Sem histórico suficiente?
      const uniqueDays = new Set(sessionDays).size;
      if (uniqueDays < 4) {
        skipped++;
        skipReasons.not_enough_history =
          (skipReasons.not_enough_history ?? 0) + 1;
        continue;
      }

      // Já treinou hoje?
      const trainedToday = sessionDays.includes(today);
      if (trainedToday) {
        skipped++;
        skipReasons.already_trained =
          (skipReasons.already_trained ?? 0) + 1;
        continue;
      }

      // Conta quantas vezes treinou em cada dia da semana
      const byWeekday = [0, 0, 0, 0, 0, 0, 0];
      for (const d of sessionDays) {
        const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
        byWeekday[wd]++;
      }
      const typicalToday = byWeekday[todayWeekday] >= TYPICAL_THRESHOLD;
      if (!typicalToday) {
        skipped++;
        skipReasons.rest_day = (skipReasons.rest_day ?? 0) + 1;
        continue;
      }

      const typicalWeekdays = byWeekday
        .map((n, i) => ({ n, i }))
        .filter((x) => x.n >= TYPICAL_THRESHOLD)
        .map((x) => WEEKDAY_PT[x.i])
        .join(', ');

      // Treinos esta semana ISO (segunda → hoje)
      const weekStart = isoWeekStartBrt(today);
      const weeklyDone = sessionDays.filter((d) => d >= weekStart).length;

      const result = await sendPushAi(
        supabase,
        userId,
        'daily_workout_check',
        {
          full_name: s.full_name,
          goal_type: s.goal_type,
          weekday_pt: WEEKDAY_PT[todayWeekday],
          date_brt: today,
          weekly_workouts_done: weeklyDone,
          typical_weekdays_pt: typicalWeekdays,
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
    console.error('[cron-daily-workout-check] unexpected error:', err);
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

function nDaysBeforeBrt(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoWeekStartBrt(iso: string): string {
  // Segunda-feira da semana ISO contendo `iso`
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDay(); // 0=domingo
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
