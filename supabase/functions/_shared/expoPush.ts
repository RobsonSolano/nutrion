// Helper compartilhado para envio de push via Expo Push API.
// Usado por send-push-notification (caller-driven) e diretamente
// por outras edge functions quando o evento dispara server-to-server
// (ex: coach-save-student-plan → push pro aluno).

import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type SendPushResult =
  | { ok: true; skipped?: 'no_token'; expo?: unknown }
  | { ok: false; error: string };

/**
 * Busca o expo_push_token do user e dispara push via Expo. Falha
 * silenciosa quando não há token (skipped='no_token') — push é
 * opcional e nunca deve quebrar a operação principal.
 */
export async function sendExpoPush(
  // deno-lint-ignore no-explicit-any
  supabaseService: SupabaseClient<any, 'public', any>,
  recipientUserId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<SendPushResult> {
  const { data: recipient, error: rErr } = await supabaseService
    .from('profiles')
    .select('expo_push_token')
    .eq('id', recipientUserId)
    .single();

  if (rErr || !recipient?.expo_push_token) {
    return { ok: true, skipped: 'no_token' };
  }

  try {
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: recipient.expo_push_token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        data: payload.data ?? {},
      }),
    });

    if (!pushRes.ok) {
      const text = await pushRes.text();
      console.error('[expoPush] error:', pushRes.status, text);
      return { ok: false, error: `${pushRes.status}: ${text}` };
    }

    const json = await pushRes.json();
    return { ok: true, expo: json };
  } catch (err) {
    console.error('[expoPush] unexpected:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
