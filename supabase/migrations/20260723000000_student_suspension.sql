-- =====================================================================
-- Persona Fit — Suspensão de alunos excedentes (downgrade não-destrutivo)
-- Substitui a deleção forçada por suspensão reversível. Fonte da verdade:
-- profiles.suspended_at (null = ativo). Reconciliação determinística e
-- idempotente via sync_coach_student_access, disparada por webhook/edge/bootstrap.
-- =====================================================================

-- 1. Coluna de estado + índice parcial (consulta do painel do professor).
alter table public.profiles
  add column if not exists suspended_at timestamptz;

create index if not exists idx_profiles_coach_suspended
  on public.profiles (coach_id)
  where suspended_at is not null;

-- 2. Reconciliador. Determinístico + idempotente:
--    - premium (limit null) ou grandfather -> todos ativos
--    - senão: mantém até L ativos (preserva escolha atual), suspende os
--      ativos MAIS RECENTES além de L, e preenche vagas com os suspensos
--      MAIS ANTIGOS. Rodar de novo sem mudança externa não altera nada.
create or replace function public.sync_coach_student_access(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ent json;
  v_source text;
  v_limit int;
  v_active int;
begin
  if p_coach_id is null then
    return;
  end if;

  select role into v_role from public.profiles where id = p_coach_id;
  if v_role is distinct from 'professor' then
    return;
  end if;

  v_ent := public._resolve_entitlement(p_coach_id);
  v_source := v_ent ->> 'source';
  v_limit := nullif(v_ent ->> 'student_limit', '')::int;  -- null = ilimitado

  -- Premium (ilimitado) ou grandfather: todos ativos.
  if v_limit is null or v_source = 'grandfather' then
    update public.profiles
       set suspended_at = null
     where coach_id = p_coach_id
       and role = 'aluno'
       and suspended_at is not null;
    return;
  end if;

  -- 1. Ativos além do limite: suspende os MAIS RECENTES (preserva os L mais antigos ativos).
  update public.profiles
     set suspended_at = now()
   where id in (
     select id
       from public.profiles
      where coach_id = p_coach_id and role = 'aluno' and suspended_at is null
      order by created_at asc, id asc
      offset v_limit
   );

  -- 2. Vagas livres: reativa os suspensos MAIS ANTIGOS até preencher L.
  select count(*) into v_active
    from public.profiles
   where coach_id = p_coach_id and role = 'aluno' and suspended_at is null;

  update public.profiles
     set suspended_at = null
   where id in (
     select id
       from public.profiles
      where coach_id = p_coach_id and role = 'aluno' and suspended_at is not null
      order by created_at asc, id asc
      limit greatest(0, v_limit - v_active)
   );
end;
$$;

-- 3. Check + auto-cura para o aluno logado.
create or replace function public.check_and_sync_my_suspension()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_coach uuid;
  v_suspended timestamptz;
begin
  if v_uid is null then
    return false;
  end if;

  select role, coach_id into v_role, v_coach
    from public.profiles where id = v_uid;

  if v_role is distinct from 'aluno' then
    return false;
  end if;

  if v_coach is not null then
    perform public.sync_coach_student_access(v_coach);
  end if;

  select suspended_at into v_suspended
    from public.profiles where id = v_uid;

  return v_suspended is not null;
end;
$$;

grant execute on function public.sync_coach_student_access(uuid) to authenticated, service_role;
grant execute on function public.check_and_sync_my_suspension() to authenticated;
