-- =====================================================================
-- NutriOn — Persistência do chat com IA
-- Chat único por usuário (sem threads), com cota diária de 20 msgs do
-- usuário e limite de 255 caracteres por mensagem.
-- =====================================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 1024),
  day date not null default current_date,
  created_at timestamptz not null default now()
);

comment on table public.chat_messages is
  'Histórico de chat do usuário com a IA. day permite contar cota diária sem date_trunc.';

-- Índice principal: histórico do user em ordem cronológica (asc) e ranges por dia.
create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at desc);

create index if not exists chat_messages_user_day_role_idx
  on public.chat_messages (user_id, day, role);

-- ---------------------------------------------------------------------
-- RLS — owner-only
-- ---------------------------------------------------------------------
alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (auth.uid() = user_id);
