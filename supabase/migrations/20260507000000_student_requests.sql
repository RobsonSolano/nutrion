-- =====================================================================
-- NutriOn — Área do Professor (sub-feature 4: fila de solicitações)
-- Aluno abre solicitações em texto livre (até 500 chars). Professor vê
-- na sua área e responde mudando o status (open → in_progress → done)
-- ou cancela. Aluno também pode cancelar.
-- =====================================================================

create table if not exists public.student_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  message text not null check (char_length(message) > 0 and char_length(message) <= 500),
  status text not null default 'open'
    check (status in ('open','in_progress','done','cancelled')),
  coach_response text check (coach_response is null or char_length(coach_response) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_requests_student_idx
  on public.student_requests (student_id, created_at desc);
create index if not exists student_requests_coach_status_idx
  on public.student_requests (coach_id, status, created_at desc);

drop trigger if exists student_requests_set_updated_at on public.student_requests;
create trigger student_requests_set_updated_at
  before update on public.student_requests
  for each row execute function public.set_updated_at();

comment on table public.student_requests is
  'Solicitações livres do aluno pro professor (mudanças de treino, dúvidas, alergias, etc).';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.student_requests enable row level security;

-- SELECT: aluno lê suas próprias; professor lê as dos seus alunos.
drop policy if exists "student_requests_select" on public.student_requests;
create policy "student_requests_select" on public.student_requests
  for select using (
    auth.uid() = student_id
    or auth.uid() = coach_id
  );

-- INSERT: aluno cria pra si com seu coach atual.
drop policy if exists "student_requests_insert_student" on public.student_requests;
create policy "student_requests_insert_student" on public.student_requests
  for insert with check (
    auth.uid() = student_id
    and (select role from public.profiles where id = auth.uid()) = 'aluno'
    and coach_id = (select coach_id from public.profiles where id = auth.uid())
  );

-- UPDATE pelo aluno: só pode cancelar (mudar pra 'cancelled') quando
-- ainda está 'open'. Não pode editar message nem mexer em coach_response.
drop policy if exists "student_requests_update_student" on public.student_requests;
create policy "student_requests_update_student" on public.student_requests
  for update using (
    auth.uid() = student_id
  ) with check (
    auth.uid() = student_id
  );

-- UPDATE pelo professor: pode mudar status e adicionar coach_response.
drop policy if exists "student_requests_update_coach" on public.student_requests;
create policy "student_requests_update_coach" on public.student_requests
  for update using (
    auth.uid() = coach_id
  ) with check (
    auth.uid() = coach_id
  );

-- DELETE: bloqueado. Histórico é preservado.
