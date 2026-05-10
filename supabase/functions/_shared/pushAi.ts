// Helper que orquestra:
//  1) verifica opt-out + cooldown + hora silenciosa
//  2) gera título/corpo via Groq (ou template fixo no fallback)
//  3) envia via Expo Push
//  4) loga em push_history + ai_usage_log

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendExpoPush } from './expoPush.ts';
import {
  aiUsageFeature,
  buildUserPrompt,
  PERSONA_SYSTEM,
  staticTemplate,
  type PushType,
} from './pushPrompts.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const TEXT_MODEL =
  Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const QUIET_START_BRT = 22; // 22h
const QUIET_END_BRT = 7; // 7h
// Tipos críticos ignoram quiet hours e cooldowns globais
const CRITICAL_TYPES: PushType[] = [
  'coach_plan_update',
  'goal_achieved',
];

// Cooldown por tipo (em horas) — entre 2 envios do MESMO tipo pro MESMO user
const COOLDOWN_HOURS_BY_TYPE: Record<PushType, number> = {
  inactivity_reminder: 24,
  streak_celebration: 24, // marco é único; 24h evita refazer
  daily_workout_reminder: 12,
  water_reminder: 4,
  weekly_summary: 6 * 24,
  coach_adherence_alert: 48,
  coach_plan_update: 0,
  goal_achieved: 0,
};

const GLOBAL_DAILY_MAX = 3; // máx 3 pushes/dia
const GLOBAL_MIN_GAP_MIN = 30; // 30 min entre 2 pushes consecutivos

export type SendPushAiResult =
  | { ok: true; status: 'sent'; title: string; body: string }
  | { ok: true; status: 'skipped'; reason: string }
  | { ok: false; error: string };

export async function sendPushAi(
  // deno-lint-ignore no-explicit-any
  supa: SupabaseClient<any, 'public', any>,
  recipientUserId: string,
  type: PushType,
  context: Record<string, unknown>,
  options?: { dryRun?: boolean },
): Promise<SendPushAiResult> {
  // 1. Opt-out
  const { data: pref } = await supa
    .from('push_preferences')
    .select('enabled')
    .eq('user_id', recipientUserId)
    .eq('type', type)
    .maybeSingle();
  if (pref?.enabled === false) {
    await logSkip(supa, recipientUserId, type, 'opted_out');
    return { ok: true, status: 'skipped', reason: 'opted_out' };
  }

  // 2. Quiet hours (exceto críticos)
  if (!CRITICAL_TYPES.includes(type) && isQuietHourBrt()) {
    await logSkip(supa, recipientUserId, type, 'quiet_hours');
    return { ok: true, status: 'skipped', reason: 'quiet_hours' };
  }

  // 3. Cooldown global e por tipo
  if (!CRITICAL_TYPES.includes(type)) {
    const last24h = await countSentInLastHours(supa, recipientUserId, 24);
    if (last24h >= GLOBAL_DAILY_MAX) {
      await logSkip(supa, recipientUserId, type, 'rate_limit');
      return { ok: true, status: 'skipped', reason: 'rate_limit' };
    }
    const minutesSinceLast = await minutesSinceLastSent(
      supa,
      recipientUserId,
    );
    if (
      minutesSinceLast != null
      && minutesSinceLast < GLOBAL_MIN_GAP_MIN
    ) {
      await logSkip(supa, recipientUserId, type, 'rate_limit');
      return { ok: true, status: 'skipped', reason: 'rate_limit' };
    }
  }
  const cooldownHrs = COOLDOWN_HOURS_BY_TYPE[type];
  if (cooldownHrs > 0) {
    const lastOfTypeHrs = await hoursSinceLastSentOfType(
      supa,
      recipientUserId,
      type,
    );
    if (lastOfTypeHrs != null && lastOfTypeHrs < cooldownHrs) {
      await logSkip(supa, recipientUserId, type, 'cooldown');
      return { ok: true, status: 'skipped', reason: 'cooldown' };
    }
  }

  // 4. Gera título/corpo via Groq (ou template fixo)
  let title = '';
  let body = '';
  let aiTokens: number | null = null;
  let aiGenerated = false;

  const useTemplate = type === 'water_reminder' || !GROQ_API_KEY;
  if (useTemplate) {
    const t = staticTemplate(type, context);
    title = t.title;
    body = t.body;
  } else {
    try {
      const result = await callGroq(type, context);
      title = clampTitle(result.title);
      body = clampBody(result.body);
      aiTokens = result.tokens;
      aiGenerated = true;
      // log de uso de IA
      await supa.from('ai_usage_log').insert({
        user_id: recipientUserId,
        feature: aiUsageFeature(type),
        model: TEXT_MODEL,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      });
    } catch (err) {
      console.error('[pushAi] groq failed, falling back to template:', err);
      const t = staticTemplate(type, context);
      title = t.title;
      body = t.body;
      // continua o fluxo — não bloquear push por falha de IA
    }
  }

  if (options?.dryRun) {
    return { ok: true, status: 'sent', title, body };
  }

  // 5. Envia via Expo
  const expoResult = await sendExpoPush(supa, recipientUserId, {
    title,
    body,
    data: { type, ...((context.data as Record<string, unknown>) ?? {}) },
  });

  if (!expoResult.ok) {
    await supa.from('push_history').insert({
      user_id: recipientUserId,
      type,
      title,
      body,
      ai_generated: aiGenerated,
      ai_tokens: aiTokens,
      status: 'failed',
      skip_reason: 'expo_failed',
      expo_response: { error: expoResult.error },
    });
    return { ok: false, error: expoResult.error };
  }

  if ('skipped' in expoResult && expoResult.skipped === 'no_token') {
    await logSkip(supa, recipientUserId, type, 'no_token');
    return { ok: true, status: 'skipped', reason: 'no_token' };
  }

  await supa.from('push_history').insert({
    user_id: recipientUserId,
    type,
    title,
    body,
    ai_generated: aiGenerated,
    ai_tokens: aiTokens,
    status: 'sent',
    expo_response: (expoResult as { expo: unknown }).expo,
  });

  return { ok: true, status: 'sent', title, body };
}

// =====================================================================
// Helpers internos
// =====================================================================

async function callGroq(
  type: PushType,
  context: Record<string, unknown>,
): Promise<{
  title: string;
  body: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
}> {
  const userPrompt = buildUserPrompt(type, context);

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: PERSONA_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content);
  return {
    title: String(parsed.title ?? ''),
    body: String(parsed.body ?? ''),
    inputTokens: json.usage?.prompt_tokens ?? 0,
    outputTokens: json.usage?.completion_tokens ?? 0,
    tokens: json.usage?.total_tokens ?? 0,
  };
}

function clampTitle(s: string): string {
  const trimmed = s.trim().replace(/^["']|["']$/g, '');
  return trimmed.length > 50 ? trimmed.slice(0, 50) : trimmed;
}

function clampBody(s: string): string {
  const trimmed = s.trim().replace(/^["']|["']$/g, '');
  return trimmed.length > 120 ? trimmed.slice(0, 120) : trimmed;
}

function isQuietHourBrt(): boolean {
  // BRT = UTC-3 (Brasil sem horário de verão desde 2019)
  const utcHour = new Date().getUTCHours();
  const brtHour = (utcHour - 3 + 24) % 24;
  // Janela 22h–7h cobre fim de noite (22, 23) + madrugada (0..6)
  return brtHour >= QUIET_START_BRT || brtHour < QUIET_END_BRT;
}

async function countSentInLastHours(
  // deno-lint-ignore no-explicit-any
  supa: SupabaseClient<any, 'public', any>,
  userId: string,
  hours: number,
): Promise<number> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { count, error } = await supa
    .from('push_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'sent')
    .gte('sent_at', since);
  if (error) {
    console.error('[pushAi] countSentInLastHours error', error);
    return 0;
  }
  return count ?? 0;
}

async function minutesSinceLastSent(
  // deno-lint-ignore no-explicit-any
  supa: SupabaseClient<any, 'public', any>,
  userId: string,
): Promise<number | null> {
  const { data } = await supa
    .from('push_history')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.sent_at) return null;
  return (Date.now() - new Date(data.sent_at).getTime()) / 60000;
}

async function hoursSinceLastSentOfType(
  // deno-lint-ignore no-explicit-any
  supa: SupabaseClient<any, 'public', any>,
  userId: string,
  type: PushType,
): Promise<number | null> {
  const { data } = await supa
    .from('push_history')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.sent_at) return null;
  return (Date.now() - new Date(data.sent_at).getTime()) / 3600000;
}

async function logSkip(
  // deno-lint-ignore no-explicit-any
  supa: SupabaseClient<any, 'public', any>,
  userId: string,
  type: PushType,
  reason: string,
): Promise<void> {
  await supa.from('push_history').insert({
    user_id: userId,
    type,
    title: '',
    body: '',
    status: 'skipped',
    skip_reason: reason,
  });
}
