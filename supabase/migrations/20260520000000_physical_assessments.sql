-- =====================================================================
-- NutriOn — Avaliação Física Estruturada
-- Tabela physical_assessments (perimetria + dobras + composição calculada)
-- Trigger compute: Jackson-Pollock 1978 + Siri 1961 (preenche % gordura,
--   massa magra/gorda, densidade, IMC).
-- Bucket posture-photos (privado, signed URLs).
-- RLS: coach lê/escreve dos seus alunos; aluno lê as próprias (read-only).
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.physical_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id   uuid not null references public.profiles(id) on delete restrict,
  assessed_at date not null default current_date,

  protocol text not null default 'pollock_3'
    check (protocol in ('pollock_3', 'pollock_7', 'none')),

  -- Antropometria
  weight_kg  numeric(5,2) check (weight_kg is null or weight_kg between 20 and 400),
  height_cm  numeric(5,1) check (height_cm is null or height_cm between 80 and 250),

  -- Perimetria (cm) — D = direita, L = esquerda quando aplicável
  perim_arm_r_cm     numeric(5,1),
  perim_arm_l_cm     numeric(5,1),
  perim_forearm_r_cm numeric(5,1),
  perim_forearm_l_cm numeric(5,1),
  perim_chest_cm     numeric(5,1),
  perim_waist_cm     numeric(5,1),
  perim_hip_cm       numeric(5,1),
  perim_thigh_r_cm   numeric(5,1),
  perim_thigh_l_cm   numeric(5,1),
  perim_calf_r_cm    numeric(5,1),
  perim_calf_l_cm    numeric(5,1),

  -- Dobras cutâneas (mm)
  -- pollock_3 homem: peitoral, abdominal, coxa
  -- pollock_3 mulher: tríceps, suprailíaca, coxa
  -- pollock_7 (ambos): peitoral, axilar, tríceps, subescapular, abdominal, suprailíaca, coxa
  skin_chest_mm       numeric(4,1),
  skin_midaxillary_mm numeric(4,1),
  skin_triceps_mm     numeric(4,1),
  skin_subscapular_mm numeric(4,1),
  skin_abdominal_mm   numeric(4,1),
  skin_suprailiac_mm  numeric(4,1),
  skin_thigh_mm       numeric(4,1),

  -- Composição calculada (preenchida pelo trigger)
  -- Densidade via Jackson-Pollock 1978; %G via Siri 1961: (495/D)-450
  body_density numeric(7,5),
  body_fat_pct numeric(5,2)
    check (body_fat_pct is null or body_fat_pct between 1 and 70),
  fat_mass_kg  numeric(6,2),
  lean_mass_kg numeric(6,2),
  bmi          numeric(5,2),

  -- Postural
  posture_notes  text
    check (posture_notes is null or char_length(posture_notes) <= 2000),
  posture_photos text[] not null default '{}',
  notes          text
    check (notes is null or char_length(notes) <= 2000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_assessments_student_idx
  on public.physical_assessments (student_id, assessed_at desc);

create index if not exists physical_assessments_coach_idx
  on public.physical_assessments (coach_id, assessed_at desc);

comment on table public.physical_assessments is
  'Avaliação física estruturada feita pelo coach. Antropometria + perimetria '
  '+ dobras + composição calculada (Jackson-Pollock 1978 / Siri 1961). '
  'RLS: coach lê/escreve dos seus alunos; aluno lê as próprias.';

-- ---------------------------------------------------------------------
-- 2. updated_at trigger
-- ---------------------------------------------------------------------
drop trigger if exists physical_assessments_set_updated_at
  on public.physical_assessments;
create trigger physical_assessments_set_updated_at
  before update on public.physical_assessments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Trigger compute — calcula densidade, %G, MG, MM, IMC
-- ---------------------------------------------------------------------
-- Lê profiles.birth_year (int) e profiles.sex ('m'|'f'|'o').
-- Pra %G precisa: idade + sexo (m|f) + dobras completas do protocolo.
-- IMC só precisa de peso + altura.
-- Sem dados suficientes, deixa null (não falha o INSERT).
create or replace function public.physical_assessments_compute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_age int;
  v_sex text;
  v_sum numeric;
  v_density numeric;
begin
  -- IMC
  if new.weight_kg is not null and new.height_cm is not null and new.height_cm > 0 then
    new.bmi := round((new.weight_kg / power(new.height_cm/100.0, 2))::numeric, 2);
  else
    new.bmi := null;
  end if;

  -- Idade + sexo do aluno
  select extract(year from now())::int - p.birth_year, p.sex
    into v_age, v_sex
    from public.profiles p
   where p.id = new.student_id;

  -- Sem idade/sexo, ou protocolo none, zera composição e retorna
  if v_age is null or v_sex not in ('m','f') or new.protocol = 'none' then
    new.body_density := null;
    new.body_fat_pct := null;
    new.fat_mass_kg  := null;
    new.lean_mass_kg := null;
    return new;
  end if;

  if new.protocol = 'pollock_3' then
    if v_sex = 'm' then
      if new.skin_chest_mm is null
         or new.skin_abdominal_mm is null
         or new.skin_thigh_mm is null then
        v_sum := null;
      else
        v_sum := new.skin_chest_mm + new.skin_abdominal_mm + new.skin_thigh_mm;
        v_density := 1.10938
                   - 0.0008267 * v_sum
                   + 0.0000016 * power(v_sum, 2)
                   - 0.0002574 * v_age;
      end if;
    else -- v_sex = 'f'
      if new.skin_triceps_mm is null
         or new.skin_suprailiac_mm is null
         or new.skin_thigh_mm is null then
        v_sum := null;
      else
        v_sum := new.skin_triceps_mm + new.skin_suprailiac_mm + new.skin_thigh_mm;
        v_density := 1.0994921
                   - 0.0009929 * v_sum
                   + 0.0000023 * power(v_sum, 2)
                   - 0.0001392 * v_age;
      end if;
    end if;
  elsif new.protocol = 'pollock_7' then
    if new.skin_chest_mm is null or new.skin_midaxillary_mm is null
       or new.skin_triceps_mm is null or new.skin_subscapular_mm is null
       or new.skin_abdominal_mm is null or new.skin_suprailiac_mm is null
       or new.skin_thigh_mm is null then
      v_sum := null;
    else
      v_sum := new.skin_chest_mm + new.skin_midaxillary_mm
             + new.skin_triceps_mm + new.skin_subscapular_mm
             + new.skin_abdominal_mm + new.skin_suprailiac_mm
             + new.skin_thigh_mm;
      if v_sex = 'm' then
        v_density := 1.112
                   - 0.00043499 * v_sum
                   + 0.00000055 * power(v_sum, 2)
                   - 0.00028826 * v_age;
      else
        v_density := 1.097
                   - 0.00046971 * v_sum
                   + 0.00000056 * power(v_sum, 2)
                   - 0.00012828 * v_age;
      end if;
    end if;
  end if;

  if v_density is not null and v_density > 0 then
    new.body_density := round(v_density::numeric, 5);
    new.body_fat_pct := round(((495 / v_density) - 450)::numeric, 2);
    if new.weight_kg is not null then
      new.fat_mass_kg  := round((new.weight_kg * new.body_fat_pct / 100)::numeric, 2);
      new.lean_mass_kg := round((new.weight_kg - new.fat_mass_kg)::numeric, 2);
    end if;
  else
    new.body_density := null;
    new.body_fat_pct := null;
    new.fat_mass_kg  := null;
    new.lean_mass_kg := null;
  end if;

  return new;
end;
$$;

drop trigger if exists physical_assessments_compute_trg
  on public.physical_assessments;
create trigger physical_assessments_compute_trg
  before insert or update on public.physical_assessments
  for each row execute function public.physical_assessments_compute();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.physical_assessments enable row level security;

drop policy if exists "pa_select_own_or_coach" on public.physical_assessments;
create policy "pa_select_own_or_coach" on public.physical_assessments
  for select using (
    auth.uid() = student_id or auth.uid() = coach_id
  );

-- INSERT: precisa ser o coach atual do aluno
drop policy if exists "pa_insert_coach" on public.physical_assessments;
create policy "pa_insert_coach" on public.physical_assessments
  for insert with check (
    auth.uid() = coach_id
    and student_id in (
      select id from public.profiles
       where coach_id = auth.uid() and role = 'aluno'
    )
  );

-- UPDATE/DELETE: coach atual do aluno (não autor original — aluno pode
-- ter mudado de coach; novo coach assume o histórico).
drop policy if exists "pa_update_coach" on public.physical_assessments;
create policy "pa_update_coach" on public.physical_assessments
  for update using (
    auth.uid() in (
      select coach_id from public.profiles
       where id = physical_assessments.student_id
         and coach_id is not null
    )
  ) with check (
    auth.uid() in (
      select coach_id from public.profiles
       where id = physical_assessments.student_id
         and coach_id is not null
    )
  );

drop policy if exists "pa_delete_coach" on public.physical_assessments;
create policy "pa_delete_coach" on public.physical_assessments
  for delete using (
    auth.uid() in (
      select coach_id from public.profiles
       where id = physical_assessments.student_id
         and coach_id is not null
    )
  );

-- ---------------------------------------------------------------------
-- 5. Bucket posture-photos (privado, signed URLs)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posture-photos',
  'posture-photos',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage policies: caminho `<student_id>/<assessment_id>/<n>.jpg`
-- Lê splitting via storage.foldername(name).

drop policy if exists "posture_photos_select_own_or_coach" on storage.objects;
create policy "posture_photos_select_own_or_coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'posture-photos'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.uid() in (
        select coach_id from public.profiles
         where id::text = (storage.foldername(name))[1]
           and coach_id is not null
      )
    )
  );

drop policy if exists "posture_photos_insert_coach" on storage.objects;
create policy "posture_photos_insert_coach" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'posture-photos'
    and auth.uid() in (
      select coach_id from public.profiles
       where id::text = (storage.foldername(name))[1]
         and coach_id is not null
    )
  );

drop policy if exists "posture_photos_update_coach" on storage.objects;
create policy "posture_photos_update_coach" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'posture-photos'
    and auth.uid() in (
      select coach_id from public.profiles
       where id::text = (storage.foldername(name))[1]
         and coach_id is not null
    )
  );

drop policy if exists "posture_photos_delete_coach" on storage.objects;
create policy "posture_photos_delete_coach" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'posture-photos'
    and auth.uid() in (
      select coach_id from public.profiles
       where id::text = (storage.foldername(name))[1]
         and coach_id is not null
    )
  );
