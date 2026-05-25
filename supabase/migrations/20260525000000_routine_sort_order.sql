-- =====================================================================
-- NutriOn — Reordenação de rotinas do aluno
--
-- Adiciona sort_order em workout_routines pra permitir reordenação
-- manual via drag-and-drop. Importação de treinos por IA não controla
-- ordem (vem por timestamp), então o coach reordena pelo painel.
--
-- Idempotente: a coluna usa IF NOT EXISTS, o seed só toca em
-- sort_order = 0 (default), e a RPC usa CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Coluna sort_order + índice de leitura
-- ---------------------------------------------------------------------
alter table public.workout_routines
  add column if not exists sort_order int not null default 0;

comment on column public.workout_routines.sort_order is
  'Ordem manual definida pelo coach (ou aluno). Atualizada via RPC reorder_routines. Default 0 = recém-criada, vai pro topo da próxima reordenação.';

create index if not exists workout_routines_user_sort_idx
  on public.workout_routines (user_id, sort_order)
  where is_archived = false;

-- ---------------------------------------------------------------------
-- 2. Seed: numera rotinas existentes por created_at ascendente.
-- Mais antiga = 1. Só toca em sort_order = 0 (default) — assim re-rodar
-- a migration não embaralha rotinas já reordenadas manualmente.
-- ---------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by created_at asc
         ) as rn
    from public.workout_routines
   where is_archived = false
     and sort_order = 0
)
update public.workout_routines wr
   set sort_order = ranked.rn
  from ranked
 where wr.id = ranked.id;

-- ---------------------------------------------------------------------
-- 3. RPC reorder_routines — atualiza sort_order em batch atômico.
--
-- security invoker: respeita as RLS policies do caller. O coach já tem
-- policy de update em workout_routines do aluno (migration
-- 20260508000000), e o próprio aluno tb (workout_routines_update_own).
--
-- Usa unnest with ordinality pra mapear cada ID ao seu novo índice
-- (1-based) numa única query.
-- ---------------------------------------------------------------------
create or replace function public.reorder_routines(
  p_user_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.workout_routines wr
     set sort_order = arr.idx,
         updated_at = now()
    from unnest(p_ordered_ids) with ordinality as arr(id, idx)
   where wr.id = arr.id
     and wr.user_id = p_user_id;
end;
$$;

comment on function public.reorder_routines(uuid, uuid[]) is
  'Atualiza sort_order de várias rotinas em uma transação. RLS do caller é respeitada (security invoker).';
