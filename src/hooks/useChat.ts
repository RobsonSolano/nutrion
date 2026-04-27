import { useCallback, useRef, useState } from 'react';
import { invokeChatAi } from '@/services/chat';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  error?: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const inFlight = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    if (inFlight.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      text: trimmed,
      createdAt: Date.now(),
    };
    setMessages((prev) => [userMsg, ...prev]);

    inFlight.current = true;
    setIsSending(true);
    try {
      const res = await invokeChatAi({ message: trimmed, mode: 'chat' });
      setMessages((prev) => [
        {
          id: uid(),
          role: 'assistant',
          text: res.text,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setMessages((prev) => [
        {
          id: uid(),
          role: 'assistant',
          text:
            err instanceof Error
              ? `Ops, não consegui responder: ${err.message}`
              : 'Ops, não consegui responder agora.',
          createdAt: Date.now(),
          error: true,
        },
        ...prev,
      ]);
    } finally {
      inFlight.current = false;
      setIsSending(false);
    }
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  return { messages, isSending, sendMessage, clear };
}
