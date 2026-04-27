import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { streamChatAi, type StreamHandle } from '@/services/chat';
import { captureError } from '@/lib/sentry';
import {
  countTodayUserMessages,
  DAILY_USER_MESSAGE_LIMIT,
  listChatMessages,
  MAX_MESSAGE_CHARS,
  type StoredChatMessage,
} from '@/services/chatMessages';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  error?: boolean;
  pending?: boolean;
  streaming?: boolean;
};

export { DAILY_USER_MESSAGE_LIMIT, MAX_MESSAGE_CHARS };

function toUiMessage(m: StoredChatMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.content,
    createdAt: new Date(m.created_at).getTime(),
  };
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatMessages() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId
      ? queryKeys.chatMessages(userId)
      : ['chat-messages', 'none'],
    queryFn: () => listChatMessages(userId!),
    enabled: !!userId,
    staleTime: 5_000,
  });
}

export function useDailyMessageCount() {
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();
  return useQuery({
    queryKey: userId
      ? queryKeys.chatDailyCount(userId, day)
      : ['chat-daily-count', 'none'],
    queryFn: () => countTodayUserMessages(userId!),
    enabled: !!userId,
    staleTime: 5_000,
  });
}

/**
 * Estado local do streaming: a msg do usuário enviada agora + a resposta da
 * IA construída chunk a chunk. Ao terminar, mantemos o estado local visível
 * até o refetch confirmar que o banco tem a assistant msg — só então
 * limpamos e a UI passa a usar `stored` (fonte canônica).
 *
 * `finishedAt` (epoch ms) marca quando o stream técnico terminou. Enquanto
 * for null, está streamando. Quando setar, é o momento de procurar a msg
 * correspondente no banco.
 */
type StreamState = {
  userText: string;
  assistantText: string;
  error: string | null;
  retryable: boolean;
  finishedAt: number | null;
  startedAt: number;
} | null;

/** Fallback: tempo máximo (ms) que o stream local fica visível depois de
 * finishedAt antes de ser limpo à força. Cobre casos raros em que o refetch
 * nunca traz a msg (rede caiu, write no banco falhou silenciosamente, etc). */
const STREAM_GRACE_MS = 8000;

export function useChat() {
  const messagesQ = useChatMessages();
  const countQ = useDailyMessageCount();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();

  const [stream, setStream] = useState<StreamState>(null);
  const handleRef = useRef<StreamHandle | null>(null);

  // Cancela qualquer stream em curso ao desmontar.
  useEffect(() => {
    return () => {
      handleRef.current?.cancel();
      handleRef.current = null;
    };
  }, []);

  // Quando o stream terminou (finishedAt setado), monitoramos o cache
  // de mensagens e limpamos o stream local APENAS quando o banco trouxer
  // a assistant msg correspondente. Isso elimina a race condition entre
  // [DONE] do Groq e o INSERT da edge function.
  useEffect(() => {
    if (!stream?.finishedAt) return;
    if (stream.error) {
      // Erro fica visível até user enviar próxima msg ou retry. Mas tem
      // fallback de tempo abaixo pra não travar pra sempre.
      return;
    }
    const stored = messagesQ.data ?? [];
    const latest = stored[0]; // banco vem em DESC
    if (
      latest &&
      latest.role === 'assistant' &&
      new Date(latest.created_at).getTime() >= stream.startedAt
    ) {
      // Banco tem uma assistant msg criada DEPOIS do stream iniciar →
      // é a nossa resposta, podemos confiar no cache.
      setStream(null);
    }
  }, [messagesQ.data, stream]);

  // Fallback: se passou STREAM_GRACE_MS e o cache ainda não trouxe a
  // msg, limpa à força pra UI não ficar travada. Não deve acontecer em
  // condição normal — só cobre falhas de rede ou DB.
  useEffect(() => {
    if (!stream?.finishedAt) return;
    if (stream.error) return;
    const elapsed = Date.now() - stream.finishedAt;
    const remaining = STREAM_GRACE_MS - elapsed;
    if (remaining <= 0) {
      setStream(null);
      return;
    }
    const t = setTimeout(() => {
      setStream(null);
    }, remaining);
    return () => clearTimeout(t);
  }, [stream]);

  const dailyCount = countQ.data ?? 0;
  const remaining = Math.max(0, DAILY_USER_MESSAGE_LIMIT - dailyCount);
  const limitReached = remaining === 0;
  const isSending = stream !== null && stream.error === null;
  // Mostrar "digitando..." só até o primeiro chunk chegar.
  const isAwaitingFirstToken =
    isSending && stream !== null && stream.assistantText.length === 0;

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (limitReached || isSending) return;
      const startedAt = Date.now();
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        setStream({
          userText: trimmed,
          assistantText: '',
          error: `Limite de ${MAX_MESSAGE_CHARS} caracteres por mensagem.`,
          retryable: false,
          finishedAt: Date.now(),
          startedAt,
        });
        return;
      }

      setStream({
        userText: trimmed,
        assistantText: '',
        error: null,
        retryable: false,
        finishedAt: null,
        startedAt,
      });

      try {
        handleRef.current = await streamChatAi(
          { message: trimmed, mode: 'chat' },
          {
            onDelta: (chunk) => {
              setStream((prev) =>
                prev
                  ? { ...prev, assistantText: prev.assistantText + chunk }
                  : prev,
              );
            },
            onDone: (fullText) => {
              handleRef.current = null;
              // Marca o stream como finalizado mas mantém visível.
              // Um useEffect vai monitorar o cache e limpar quando o banco
              // confirmar que tem a assistant msg correspondente.
              setStream((prev) =>
                prev
                  ? {
                      ...prev,
                      assistantText: fullText,
                      finishedAt: Date.now(),
                    }
                  : prev,
              );
              if (!userId) return;
              void qc.invalidateQueries({
                queryKey: queryKeys.chatMessages(userId),
              });
              void qc.invalidateQueries({
                queryKey: queryKeys.chatDailyCount(userId, day),
              });
            },
            onError: (err) => {
              handleRef.current = null;
              setStream((prev) =>
                prev
                  ? {
                      ...prev,
                      error: err.message,
                      // Cota esgotada não é retryable; demais erros sim.
                      retryable: !/limite/i.test(err.message),
                      finishedAt: Date.now(),
                    }
                  : null,
              );
              captureError(err, { feature: 'chat' });
              if (!userId) return;
              // Refetch mesmo em erro: a edge function persiste a user msg
              // antes de chamar Groq, então a cota foi consumida.
              void qc.invalidateQueries({
                queryKey: queryKeys.chatMessages(userId),
              });
              void qc.invalidateQueries({
                queryKey: queryKeys.chatDailyCount(userId, day),
              });
            },
          },
        );
      } catch (err) {
        handleRef.current = null;
        setStream({
          userText: trimmed,
          assistantText: '',
          error:
            err instanceof Error
              ? err.message
              : 'Falha ao interagir com a IA. Tenta de novo mais tarde.',
          retryable: true,
          finishedAt: Date.now(),
          startedAt,
        });
      }
    },
    [limitReached, isSending, userId, qc, day],
  );

  const retryLastMessage = useCallback(() => {
    if (!stream?.retryable) return;
    const text = stream.userText;
    setStream(null);
    void sendMessage(text);
  }, [stream, sendMessage]);

  const messages = useMemo<ChatMessage[]>(() => {
    const stored = (messagesQ.data ?? []).map(toUiMessage);

    // Stream em curso: msgs locais aparecem no topo (FlatList inverted),
    // antes do histórico do banco.
    if (stream) {
      const local: ChatMessage[] = [];
      if (stream.error) {
        local.push({
          id: `error-${uid()}`,
          role: 'assistant',
          text: stream.error,
          createdAt: Date.now(),
          error: true,
        });
      } else if (stream.assistantText.length > 0) {
        local.push({
          id: 'streaming',
          role: 'assistant',
          text: stream.assistantText,
          createdAt: Date.now(),
          streaming: true,
        });
      }
      // user msg só fica visível enquanto não foi persistida no banco —
      // após onDone o refetch traz a versão real e o stream é limpo.
      local.push({
        id: 'pending-user',
        role: 'user',
        text: stream.userText,
        createdAt: Date.now() - 1,
        pending: true,
      });
      return [...local, ...stored];
    }

    return stored;
  }, [messagesQ.data, stream]);

  return {
    messages,
    isSending,
    isAwaitingFirstToken,
    isLoading: messagesQ.isLoading,
    sendMessage,
    retryLastMessage,
    canRetry: !!stream?.retryable && !!stream.error,
    dailyCount,
    dailyLimit: DAILY_USER_MESSAGE_LIMIT,
    remaining,
    limitReached,
    maxChars: MAX_MESSAGE_CHARS,
  };
}
