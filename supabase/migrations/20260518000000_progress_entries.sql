-- =====================================================================
-- NutriOn — Linha do tempo de evolução
--
-- Permite que qualquer user registre marcos da própria evolução
-- (ganho/perda de peso, recordes, sensações, mudanças de hábitos).
-- Coach vinculado ao aluno também enxerga (read-only) via RLS.
--
-- Cria:
--   progress_entries — texto livre 1-1000 chars, ordenado por created_at
--
-- Idempotente.
-- =====================================================================

create table if not exists public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'progress_entries_content_len_check'
  ) then
    alter table public.progress_entries
      add constraint progress_entries_content_len_check
      check (char_length(content) between 1 and 1000);
  end if;
end $$;

create index if not exists progress_entries_user_idx
  on public.progress_entries (user_id, created_at desc);

drop trigger if exists progress_entries_set_updated_at on public.progress_entries;
create trigger progress_entries_set_updated_at
  before update on public.progress_entries
  for each row execute function public.set_updated_at();

comment on table public.progress_entries is
  'Marcos de evolução em texto livre (timeline). Aluno vinculado é visível pro coach via RLS.';

-- ---------------------------------------------------------------------
-- RLS — dono lê/escreve; coach lê os do aluno (não escreve no nome)
-- ---------------------------------------------------------------------
alter table public.progress_entries enable row level security;

drop policy if exists "progress_entries_select_own_or_coach" on public.progress_entries;
create policy "progress_entries_select_own_or_coach" on public.progress_entries
  for select using (
    (select auth.uid()) = user_id
    or user_id in (
      select id from public.profiles
       where coach_id = (select auth.uid())
    )
  );

drop policy if exists "progress_entries_insert_own" on public.progress_entries;
create policy "progress_entries_insert_own" on public.progress_entries
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "progress_entries_update_own" on public.progress_entries;
create policy "progress_entries_update_own" on public.progress_entries
  for update using ((select auth.uid()) = user_id);

drop policy if exists "progress_entries_delete_own" on public.progress_entries;
create policy "progress_entries_delete_own" on public.progress_entries
  for delete using ((select auth.uid()) = user_id);
