import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { streamChatAi, type StreamHandle } from '@/services/chat';
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
 * IA construída chunk a chunk. Ao terminar (ou em erro), fazemos refetch e
 * limpamos o estado local — o histórico no banco vira a fonte canônica.
 *
 * Em erro guardamos `userText` pra permitir o user dar "Tentar novamente"
 * sem redigitar a mensagem.
 */
type StreamState = {
  userText: string;
  assistantText: string;
  error: string | null;
  retryable: boolean;
} | null;

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
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        setStream({
          userText: trimmed,
          assistantText: '',
          error: `Limite de ${MAX_MESSAGE_CHARS} caracteres por mensagem.`,
          retryable: false,
        });
        return;
      }

      setStream({
        userText: trimmed,
        assistantText: '',
        error: null,
        retryable: false,
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
            onDone: () => {
              handleRef.current = null;
              setStream(null);
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
                    }
                  : null,
              );
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
