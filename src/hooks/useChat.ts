import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invokeChatAi } from '@/services/chat';
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
 * Envia mensagem com optimistic update: a msg do user aparece imediatamente
 * (status pending), depois é substituída pelos registros reais do banco.
 * Em caso de erro, injeta uma "msg da IA" de erro no histórico local mas
 * continua persistindo a tentativa do user no banco (a edge function já
 * persiste antes de chamar o Groq).
 */
export function useSendChatMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const day = todayKey();

  return useMutation({
    mutationFn: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Mensagem vazia.');
      if (trimmed.length > MAX_MESSAGE_CHARS) {
        throw new Error(`Limite de ${MAX_MESSAGE_CHARS} caracteres.`);
      }
      return invokeChatAi({ message: trimmed, mode: 'chat' });
    },
    onSuccess: () => {
      if (!userId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.chatMessages(userId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.chatDailyCount(userId, day),
      });
    },
    onError: () => {
      // A edge function persiste a msg do user antes de chamar Groq, então
      // mesmo em erro a msg dela está no banco. Re-fetch pra refletir.
      if (!userId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.chatMessages(userId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.chatDailyCount(userId, day),
      });
    },
  });
}

/**
 * Hook composto pra UI: junta histórico + cota + mutation + estado pending.
 */
export function useChat() {
  const messagesQ = useChatMessages();
  const countQ = useDailyMessageCount();
  const send = useSendChatMessage();

  const messages = useMemo<ChatMessage[]>(() => {
    const stored = (messagesQ.data ?? []).map(toUiMessage);
    if (send.isPending && send.variables) {
      const text = String(send.variables).trim();
      if (text) {
        stored.unshift({
          id: `pending-${uid()}`,
          role: 'user',
          text,
          createdAt: Date.now(),
          pending: true,
        });
      }
    }
    if (send.isError) {
      const message =
        send.error instanceof Error
          ? send.error.message
          : 'Falha ao interagir com a IA. Tenta de novo mais tarde.';
      stored.unshift({
        id: `error-${uid()}`,
        role: 'assistant',
        text: message,
        createdAt: Date.now(),
        error: true,
      });
    }
    return stored;
  }, [messagesQ.data, send.isPending, send.variables, send.isError, send.error]);

  const dailyCount = countQ.data ?? 0;
  const remaining = Math.max(0, DAILY_USER_MESSAGE_LIMIT - dailyCount);
  const limitReached = remaining === 0;

  const sendMessage = useCallback(
    (text: string) => {
      if (limitReached) return;
      send.mutate(text);
    },
    [limitReached, send],
  );

  return {
    messages,
    isSending: send.isPending,
    isLoading: messagesQ.isLoading,
    sendMessage,
    dailyCount,
    dailyLimit: DAILY_USER_MESSAGE_LIMIT,
    remaining,
    limitReached,
    maxChars: MAX_MESSAGE_CHARS,
  };
}
