-- =====================================================================
-- NutriOn — Anotações privadas do professor sobre o aluno
-- O professor escreve observações no acompanhamento (peso medido na
-- consulta, técnica de execução, evolução, etc) que ficam VISÍVEIS
-- APENAS pra ele. O aluno NUNCA vê — RLS estrita.
-- =====================================================================

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_notes_student_idx
  on public.coach_notes (coach_id, student_id, created_at desc);

drop trigger if exists coach_notes_set_updated_at on public.coach_notes;
create trigger coach_notes_set_updated_at
  before update on public.coach_notes
  for each row execute function public.set_updated_at();

comment on table public.coach_notes is
  'Anotações privadas do professor sobre o aluno. Aluno NUNCA vê (RLS bloqueia).';

-- ---------------------------------------------------------------------
-- RLS — só o coach_id vê/edita as próprias notas. Não há policy pro
-- aluno propositadamente.
-- ---------------------------------------------------------------------
alter table public.coach_notes enable row level security;

drop policy if exists "coach_notes_select_own" on public.coach_notes;
create policy "coach_notes_select_own" on public.coach_notes
  for select using (auth.uid() = coach_id);

drop policy if exists "coach_notes_insert_own" on public.coach_notes;
create policy "coach_notes_insert_own" on public.coach_notes
  for insert with check (
    auth.uid() = coach_id
    and student_id in (
      select id from public.profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "coach_notes_update_own" on public.coach_notes;
create policy "coach_notes_update_own" on public.coach_notes
  for update using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

drop policy if exists "coach_notes_delete_own" on public.coach_notes;
create policy "coach_notes_delete_own" on public.coach_notes
  for delete using (auth.uid() = coach_id);
