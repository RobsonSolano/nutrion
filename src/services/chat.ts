import { supabase } from './supabase';
import type { ChatAiRequest, ChatAiResponse } from '@/types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FN_URL = `${SUPABASE_URL}/functions/v1/chat-ai`;

/**
 * Chama a edge function chat-ai via fetch direto.
 * Motivo de não usar supabase.functions.invoke: em caso de 4xx/5xx, o invoke
 * engole o body da resposta. Com fetch manual conseguimos exibir o detalhe
 * real do Gemini (status, finishReason, etc.) pro usuário/dev.
 */
export async function invokeChatAi(payload: ChatAiRequest): Promise<ChatAiResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada. Faça login de novo.');
  }

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    let code: string | null = null;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail ?? parsed?.error ?? text;
      code = parsed?.error ?? null;
    } catch {
      // mantém texto cru
    }
    // Cota diária ou rate-limit do Groq → mensagem direta sem prefixo
    if (res.status === 429) {
      throw new Error(String(detail));
    }
    if (res.status === 400 && code === 'message_too_long') {
      throw new Error(String(detail));
    }
    throw new Error(
      'Falha ao interagir com a IA. Tenta de novo mais tarde.',
    );
  }

  const data = (await res.json()) as ChatAiResponse;
  if (!data?.text) {
    throw new Error('Resposta vazia da função chat-ai');
  }
  return data;
}
