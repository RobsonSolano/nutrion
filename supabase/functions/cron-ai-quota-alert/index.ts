// NutriOn — Edge Function cron-ai-quota-alert
// Roda de hora em hora. Conta rate_limits da última hora em
// ai_usage_log. Se passar de THRESHOLD, dispara push pra todos
// os admins (admin_users + profile com expo_push_token).
//
// Anti-spam: só envia se NÃO existir alerta enviado na última 1h
// em push_history com data->>kind = 'ai_quota_alert'.
//
// Como agendar:
//   schedule '0 * * * *'  (a cada hora cheia, UTC)

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { sendExpoPush } from '../_shared/expoPush.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const THRESHOLD = 10; // rate_limits/hora a partir do qual alertamos

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!CRON_SECRET) return json({ error: 'missing_cron_secret' }, 500);
  if (req.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!SERVICE_ROLE_KEY) return json({ error: 'missing_service_role' }, 500);

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sinceIso = new Date(Date.now() - 3600 * 1000).toISOString();

    // 1. Conta rate_limits e os principais erros da última hora
    const { count: rateLimitCount, error: rlErr } = await supa
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('error_code', 'rate_limit')
      .gte('created_at', sinceIso);
    if (rlErr) {
      return json({ error: 'count_failed', detail: rlErr.message }, 500);
    }

    const rateLimits = rateLimitCount ?? 0;
    if (rateLimits < THRESHOLD) {
      return json({ ok: true, rateLimits, threshold: THRESHOLD, sent: false });
    }

    // 2. Verifica se já alertamos na última hora (anti-spam)
    const { data: recentAlerts } = await supa
      .from('push_history')
      .select('id')
      .gte('sent_at', sinceIso)
      .contains('data', { kind: 'ai_quota_alert' })
      .limit(1);
    if (recentAlerts && recentAlerts.length > 0) {
      return json({
        ok: true,
        rateLimits,
        threshold: THRESHOLD,
        sent: false,
        reason: 'already_alerted_in_last_hour',
      });
    }

    // 3. Lista admins com push_token. NÃO existe FK direta entre
    //    admin_users e profiles (ambas referenciam auth.users) — então
    //    PostgREST não consegue inferir o join, e a sintaxe `!inner`
    //    falha. Faz em 2 etapas: pega IDs dos admins, depois cruza
    //    com profiles.
    const { data: adminRows, error: admErr } = await supa
      .from('admin_users')
      .select('id');
    if (admErr) {
      return json({ error: 'admins_fetch_failed', detail: admErr.message }, 500);
    }
    const adminIds = (adminRows ?? [])
      .map((a: { id: string }) => a.id as string)
      .filter(Boolean);
    if (adminIds.length === 0) {
      return json({
        ok: true,
        rateLimits,
        threshold: THRESHOLD,
        sent: false,
        reason: 'no_admins',
      });
    }

    const { data: adminsWithToken, error: profErr } = await supa
      .from('profiles')
      .select('id')
      .in('id', adminIds)
      .not('expo_push_token', 'is', null);
    if (profErr) {
      return json(
        { error: 'admin_profiles_fetch_failed', detail: profErr.message },
        500,
      );
    }

    const targets = (adminsWithToken ?? [])
      .map((p: { id: string }) => p.id as string)
      .filter(Boolean);
    if (targets.length === 0) {
      return json({
        ok: true,
        rateLimits,
        threshold: THRESHOLD,
        sent: false,
        reason: 'no_admin_with_token',
      });
    }

    // 4. Dispara push direto (sem passar por sendPushAi pq é alerta crítico,
    //    sem opt-out, sem cooldown, sem IA).
    const title = 'NutriOn: cota IA em risco';
    const body = `${rateLimits} rate_limits na última hora. Verifique Groq.`;
    let sent = 0;
    for (const userId of targets) {
      const result = await sendExpoPush(supa, userId, {
        title,
        body,
        data: { kind: 'ai_quota_alert', rateLimits, threshold: THRESHOLD },
      });
      if (result.ok && !('skipped' in result)) sent++;
      // Registra em push_history pra anti-spam funcionar
      await supa.from('push_history').insert({
        user_id: userId,
        type: 'coach_adherence_alert', // reuso de tipo existente
        title,
        body,
        data: { kind: 'ai_quota_alert', rateLimits, threshold: THRESHOLD },
        ai_generated: false,
        status: result.ok && !('skipped' in result) ? 'sent' : 'failed',
        skip_reason:
          result.ok && 'skipped' in result ? 'no_token' : null,
      });
    }

    return json({
      ok: true,
      rateLimits,
      threshold: THRESHOLD,
      sent: true,
      targets: targets.length,
      delivered: sent,
    });
  } catch (err) {
    console.error('[cron-ai-quota-alert] unexpected:', err);
    return json(
      { error: 'internal', detail: err instanceof Error ? err.message : String(err) },
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
