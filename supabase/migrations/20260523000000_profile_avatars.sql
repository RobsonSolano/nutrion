-- =====================================================================
-- NutriOn — Avatares de perfil (aluno/comum/professor)
-- Coluna profiles.avatar_url + bucket profile-photos publico.
--
-- Decisao: bucket PUBLICO (sem signed URL). Foto de perfil e dado nao
-- sensivel — padrao em apps sociais. Policies de INSERT/UPDATE/DELETE
-- garantem que so o dono escreve no proprio prefixo.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Coluna avatar_url em profiles
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'URL publica da foto de perfil no bucket profile-photos. Null quando nao definida.';

-- ---------------------------------------------------------------------
-- 2. Bucket profile-photos (publico, 2MB, jpg/png/webp)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ---------------------------------------------------------------------
-- 3. Storage policies
-- Path layout: <user_id>/<filename>.<ext>
-- ---------------------------------------------------------------------

-- SELECT: bucket publico ja permite leitura sem auth — mas explicito
-- no caso de virar privado no futuro.
drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read" on storage.objects
  for select using (bucket_id = 'profile-photos');

-- INSERT: so o dono do prefixo pode subir
drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- UPDATE: idem
drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: idem
drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
