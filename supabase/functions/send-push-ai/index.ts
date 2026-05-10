// NutriOn — Edge Function send-push-ai
// Endpoint server-to-server pra disparar um push gerado por IA.
//
// Auth: X-Cron-Secret header (mesmo padrão de cron-inactivity-reminders).
// Não exposto pra clientes — só edge functions e crons.
//
// Body esperado:
//   { user_id: uuid, type: PushType, context?: object, dry_run?: boolean }
//
// Resposta:
//   { ok: true, status: 'sent' | 'skipped', title?, body?, reason? }
//   { ok: false, error: string }

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendPushAi } from '../_shared/pushAi.ts';
import type { PushType } from '../_shared/pushPrompts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const VALID_TYPES: PushType[] = [
  'inactivity_reminder',
  'streak_celebration',
  'daily_workout_reminder',
  'water_reminder',
  'weekly_summary',
  'coach_adherence_alert',
  'coach_plan_update',
  'goal_achieved',
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
    return json(
      { error: 'missing_cron_secret', detail: 'CRON_SECRET nao configurada.' },
      500,
    );
  }
  if (req.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  let payload: {
    user_id?: string;
    type?: string;
    context?: Record<string, unknown>;
    dry_run?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!payload.user_id || typeof payload.user_id !== 'string') {
    return json({ error: 'user_id required' }, 400);
  }
  if (!payload.type || !VALID_TYPES.includes(payload.type as PushType)) {
    return json({ error: 'invalid_type', valid: VALID_TYPES }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await sendPushAi(
      supabase,
      payload.user_id,
      payload.type as PushType,
      payload.context ?? {},
      { dryRun: payload.dry_run === true },
    );
    return json(result);
  } catch (err) {
    console.error('[send-push-ai] unexpected:', err);
    return json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
