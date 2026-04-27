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

/** Quanto tempo (ms) tentamos detectar a assistant msg no banco antes de
 * desistir e limpar o stream local. Em condições normais, a edge function
 * termina de persistir em ~500ms-1s; usamos 6s pra ter folga em rede ruim. */
const POST_STREAM_POLL_MAX_MS = 6000;
/** Intervalo entre tentativas de fetch durante o polling pós-stream. */
const POST_STREAM_POLL_INTERVAL_MS = 400;
/** Tolerância (ms) pra clock skew entre client e servidor ao comparar
 * created_at do banco com startedAt do cliente. */
const CLOCK_SKEW_TOLERANCE_MS = 5000;

export function useChat() {
  const messagesQ = useChatMessages();
  const countQ = useDailyMessageCount();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();

  const [stream, setStream] = useState<StreamState>(null);
  const handleRef = useRef<StreamHandle | null>(null);
  /** Marca o stream "ativo" via startedAt. Usado pra detectar se um polling
   * pós-stream antigo deve abortar porque o user já mandou outra mensagem. */
  const activeStreamRef = useRef<number | null>(null);

  // Cancela qualquer stream em curso ao desmontar.
  useEffect(() => {
    return () => {
      handleRef.current?.cancel();
      handleRef.current = null;
      activeStreamRef.current = null;
    };
  }, []);

  // Quando o banco trouxer (via refetch ou setQueryData do polling) tanto a
  // user quanto a assistant msg do stream atual, podemos limpar o stream
  // local — a UI vai usar exclusivamente o `stored`. Isso elimina a janela
  // em que a resposta poderia "sumir" entre o setStream(null) e o cache
  // estar atualizado.
  useEffect(() => {
    if (!stream || stream.error || stream.finishedAt === null) return;
    const stored = messagesQ.data ?? [];
    const cutoff = stream.startedAt - CLOCK_SKEW_TOLERANCE_MS;
    const userInDb = stored.some(
      (m) =>
        m.role === 'user' && new Date(m.created_at).getTime() >= cutoff,
    );
    const assistantInDb = stored.some(
      (m) =>
        m.role === 'assistant' && new Date(m.created_at).getTime() >= cutoff,
    );
    if (userInDb && assistantInDb) {
      activeStreamRef.current = null;
      setStream(null);
    }
  }, [stream, messagesQ.data]);

  const dailyCount = countQ.data ?? 0;
  const remaining = Math.max(0, DAILY_USER_MESSAGE_LIMIT - dailyCount);
  const limitReached = remaining === 0;
  // isSending = true só enquanto o stream técnico está rodando (antes de
  // finishedAt). Depois disso, mesmo que o stream local ainda esteja visível
  // aguardando confirmação do banco, o user já pode enviar nova mensagem
  // (sendMessage substitui o stream).
  const isStreaming =
    stream !== null && stream.error === null && stream.finishedAt === null;
  const isSending = isStreaming;
  // Mostrar "digitando..." só até o primeiro chunk chegar.
  const isAwaitingFirstToken =
    isStreaming && stream !== null && stream.assistantText.length === 0;

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
      activeStreamRef.current = startedAt;

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
            onDone: async (fullText) => {
              handleRef.current = null;
              // Mostra texto completo + marca como finalizado. Importante:
              // NÃO limpamos o stream ainda — o useMemo já evita duplicar
              // com o stored quando o banco trouxer. Limpamos só via o
              // useEffect que monitora o cache (abaixo).
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
                queryKey: queryKeys.chatDailyCount(userId, day),
              });

              // Polling: refetcha periodicamente pra forçar o cache a ver
              // a assistant msg quando a edge function terminar de gravar.
              // Sem timeout de "limpa à força": se o servidor falhar em
              // persistir, o stream local fica visível pra sempre na sessão
              // atual. A nova mensagem do user vai substituí-lo.
              const pollStartMs = Date.now();
              while (
                Date.now() - pollStartMs < POST_STREAM_POLL_MAX_MS &&
                activeStreamRef.current === startedAt
              ) {
                try {
                  const fresh = await listChatMessages(userId);
                  qc.setQueryData(queryKeys.chatMessages(userId), fresh);
                  const hasFreshAssistant = fresh.some(
                    (m) =>
                      m.role === 'assistant' &&
                      new Date(m.created_at).getTime() >=
                        startedAt - CLOCK_SKEW_TOLERANCE_MS,
                  );
                  if (hasFreshAssistant) return; // useEffect cuida da limpeza
                } catch {
                  // Falha de rede momentânea: tenta no próximo tick.
                }
                await new Promise((r) =>
                  setTimeout(r, POST_STREAM_POLL_INTERVAL_MS),
                );
              }
              // Timeout sem confirmação: stream local fica visível.
              // Não limpamos — o user vê a resposta até enviar outra msg.
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
    if (!stream) return stored;

    // Detecta se a user msg e/ou assistant msg do stream atual já apareceram
    // no `stored` (= banco trouxe via refetch). Se sim, não duplicamos com
    // a versão local — usamos a do banco. A comparação é por timestamp:
    // qualquer msg criada depois do startedAt (com tolerância de skew) é
    // considerada "do stream atual".
    const cutoff = stream.startedAt - CLOCK_SKEW_TOLERANCE_MS;
    const userInDb = stored.some(
      (m) => m.role === 'user' && m.createdAt >= cutoff,
    );
    const assistantInDb = stored.some(
      (m) => m.role === 'assistant' && m.createdAt >= cutoff,
    );

    const local: ChatMessage[] = [];
    if (stream.error) {
      local.push({
        id: `error-${uid()}`,
        role: 'assistant',
        text: stream.error,
        createdAt: Date.now(),
        error: true,
      });
    } else if (stream.assistantText.length > 0 && !assistantInDb) {
      // Mostra a versão local da resposta APENAS enquanto o banco ainda
      // não trouxe a oficial. Quando trouxer, vem do `stored`.
      local.push({
        id: 'streaming',
        role: 'assistant',
        text: stream.assistantText,
        createdAt: Date.now(),
        streaming: stream.finishedAt === null,
      });
    }
    if (!userInDb) {
      local.push({
        id: 'pending-user',
        role: 'user',
        text: stream.userText,
        createdAt: Date.now() - 1,
        pending: true,
      });
    }
    return [...local, ...stored];
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
