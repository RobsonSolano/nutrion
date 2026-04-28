-- =====================================================================
-- chat_messages: aumenta o limite de content de 1024 → 8192 chars.
-- Motivo: respostas da IA com max_tokens=700 chegam a ~3500 chars em
-- português. Limite anterior estourava silenciosamente na edge function
-- (INSERT falhava, mas a resposta era retornada pro cliente assim mesmo,
-- aparecendo na UI sem ficar persistida).
-- =====================================================================

alter table public.chat_messages
  drop constraint if exists chat_messages_content_check;

alter table public.chat_messages
  add constraint chat_messages_content_check
  check (char_length(content) <= 8192);
