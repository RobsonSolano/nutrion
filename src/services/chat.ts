import EventSource from 'react-native-sse';
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

export type StreamHandle = {
  /** Encerra o stream antes do término natural (ex: navegação). */
  cancel: () => void;
};

export type StreamCallbacks = {
  onDelta: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
};

/**
 * Abre stream SSE com a edge function chat-ai. A edge faz proxy do formato
 * OpenAI/Groq (cada `data: { choices: [{ delta: { content } }] }`), e este
 * service extrai o `delta.content` e chama `onDelta` por chunk. Ao receber
 * `[DONE]`, chama `onDone(textoCompleto)`. A persistência da assistant msg
 * é feita server-side ao final do stream — após `onDone` o caller deve
 * fazer refetch das mensagens pra refletir o estado canônico.
 */
export async function streamChatAi(
  payload: Omit<ChatAiRequest, 'imageBase64' | 'imageMime'>,
  cb: StreamCallbacks,
): Promise<StreamHandle> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    cb.onError(new Error('Sessão expirada. Faça login de novo.'));
    return { cancel: () => {} };
  }

  let fullText = '';
  let closed = false;

  const es = new EventSource(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ ...payload, stream: true }),
    pollingInterval: 0,
    timeout: 60_000,
  });

  function close() {
    if (closed) return;
    closed = true;
    es.removeAllEventListeners();
    es.close();
  }

  es.addEventListener('message', (ev) => {
    const data = ev.data?.trim();
    if (!data) return;
    if (data === '[DONE]') {
      close();
      cb.onDone(fullText);
      return;
    }
    try {
      const json = JSON.parse(data);
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        fullText += delta;
        cb.onDelta(delta);
      }
    } catch {
      // chunk parcial ou keepalive
    }
  });

  es.addEventListener('error', (ev) => {
    if (closed) return;
    close();
    const status = 'xhrStatus' in ev ? ev.xhrStatus : 0;
    if (status === 429) {
      cb.onError(
        new Error(
          'Você atingiu o limite de mensagens hoje (ou a IA está sobrecarregada). Tenta mais tarde.',
        ),
      );
      return;
    }
    cb.onError(
      new Error('Falha ao interagir com a IA. Tenta de novo mais tarde.'),
    );
  });

  return { cancel: close };
}
