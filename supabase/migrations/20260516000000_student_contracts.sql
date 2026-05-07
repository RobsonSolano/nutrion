-- =====================================================================
-- NutriOn — Contratos do aluno (Área do Professor)
--
-- Permite que o professor registre o contrato de cada aluno com tipo
-- (mensal/treino/semanal/parceria), datas, valor, dia de pagamento.
-- Mantém histórico (renovações, mudanças de plano).
--
-- Cria:
--   student_contracts          — 0..N por aluno, max 1 'active' por par
--   contracts_auto_end_previous() — trigger encerra contrato anterior
--                                    quando novo 'active' é inserido
--   student_contracts_view     — view com effective_status (active vira
--                                ended quando end_date < current_date)
--
-- Aluno NÃO acessa contratos no MVP (info financeira privada do coach).
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. student_contracts
-- ---------------------------------------------------------------------
create table if not exists public.student_contracts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  type text not null,
  start_date date not null,
  end_date date,
  value_cents int,
  payment_day int,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_type_check'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_type_check
      check (type in ('mensal','treino','semanal','parceria'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_status_check'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_status_check
      check (status in ('active','ended','cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_value_check'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_value_check
      check (value_cents is null or value_cents >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_payment_day_check'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_payment_day_check
      check (payment_day is null or (payment_day between 1 and 31));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_notes_check'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_notes_check
      check (notes is null or char_length(notes) <= 1000);
  end if;

  -- Parceria não tem valor nem dia de pagamento; demais tipos exigem valor.
  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_parceria_no_value'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_parceria_no_value
      check (
        (type = 'parceria' and value_cents is null and payment_day is null)
        or (type <> 'parceria' and value_cents is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'student_contracts_dates_consistent'
  ) then
    alter table public.student_contracts
      add constraint student_contracts_dates_consistent
      check (end_date is null or end_date >= start_date);
  end if;
end $$;

-- Apenas 1 contrato 'active' por par (student, coach).
create unique index if not exists student_contracts_one_active_per_pair_idx
  on public.student_contracts (student_id, coach_id)
  where status = 'active';

create index if not exists student_contracts_coach_idx
  on public.student_contracts (coach_id, status, start_date desc);
create index if not exists student_contracts_student_idx
  on public.student_contracts (student_id, status);

drop trigger if exists student_contracts_set_updated_at on public.student_contracts;
create trigger student_contracts_set_updated_at
  before update on public.student_contracts
  for each row execute function public.set_updated_at();

comment on table public.student_contracts is
  'Contratos entre aluno e coach (mensal/treino/semanal/parceria). 1 ativo por par; histórico mantido.';

-- ---------------------------------------------------------------------
-- 2. Trigger: ao inserir 'active', encerra o anterior do mesmo par
-- ---------------------------------------------------------------------
create or replace function public.contracts_auto_end_previous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    update public.student_contracts
       set status = 'ended',
           end_date = least(coalesce(end_date, current_date), current_date)
     where student_id = new.student_id
       and coach_id   = new.coach_id
       and id <> new.id
       and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists student_contracts_auto_end_previous on public.student_contracts;
create trigger student_contracts_auto_end_previous
  before insert on public.student_contracts
  for each row execute function public.contracts_auto_end_previous();

-- ---------------------------------------------------------------------
-- 3. View com effective_status
-- ---------------------------------------------------------------------
create or replace view public.student_contracts_view as
select
  c.*,
  case
    when c.status = 'active' and c.end_date is not null and c.end_date < current_date
      then 'ended'
    else c.status
  end as effective_status
from public.student_contracts c;

comment on view public.student_contracts_view is
  'Contratos com effective_status: active vira ended automaticamente quando end_date < hoje (sem precisar cron).';

-- ---------------------------------------------------------------------
-- 4. RLS — só o coach acessa contratos do aluno (privacidade financeira)
-- ---------------------------------------------------------------------
alter table public.student_contracts enable row level security;

drop policy if exists "contracts_select_coach" on public.student_contracts;
create policy "contracts_select_coach" on public.student_contracts
  for select using ((select auth.uid()) = coach_id);

drop policy if exists "contracts_insert_coach" on public.student_contracts;
create policy "contracts_insert_coach" on public.student_contracts
  for insert with check (
    (select auth.uid()) = coach_id
    and exists (
      select 1 from public.profiles p
      where p.id = student_contracts.student_id
        and p.coach_id = (select auth.uid())
        and p.role = 'aluno'
    )
  );

drop policy if exists "contracts_update_coach" on public.student_contracts;
create policy "contracts_update_coach" on public.student_contracts
  for update using ((select auth.uid()) = coach_id);

drop policy if exists "contracts_delete_coach" on public.student_contracts;
create policy "contracts_delete_coach" on public.student_contracts
  for delete using ((select auth.uid()) = coach_id);
