-- =====================================================================
-- Teste — Unicidade do Expo Push Token por dispositivo
-- Reproduz o bug: usuário recebe push de outra conta após trocar de
-- conta no mesmo aparelho (o token do device fica grudado em 2 perfis).
--
-- Rodar contra o schema real local:
--   npx supabase@latest start
--   psql "$(npx supabase@latest status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
--     -f supabase/tests/push_token_uniqueness.test.sql
--
-- Transacional (begin/rollback) — não suja o banco. Sucesso imprime
-- "PUSH_TOKEN_UNIQUENESS: ALL PASS". Sem o trigger, falha no caso 1.
-- =====================================================================

begin;

-- Dois usuários no MESMO aparelho (mesmo token de device).
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_super_admin)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'luciano_pushtest@test.local', '', now(), now(), now(), '{}', '{}', false),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'harrison_pushtest@test.local', '', now(), now(), now(), '{}', '{}', false);
-- handle_new_user cria os profiles automaticamente.

-- 1) Luciano loga e registra o token do aparelho.
update public.profiles
  set expo_push_token = 'ExponentPushToken[DEVICE_COMPARTILHADO]'
  where id = '11111111-1111-1111-1111-111111111111';

-- 2) Harrison loga no MESMO aparelho e registra o MESMO token.
update public.profiles
  set expo_push_token = 'ExponentPushToken[DEVICE_COMPARTILHADO]'
  where id = '22222222-2222-2222-2222-222222222222';

do $$
declare
  luciano_token text;
  harrison_token text;
begin
  select expo_push_token into luciano_token
    from public.profiles where id = '11111111-1111-1111-1111-111111111111';
  select expo_push_token into harrison_token
    from public.profiles where id = '22222222-2222-2222-2222-222222222222';

  -- CASO 1 (o bug): após Harrison registrar, Luciano NÃO pode mais
  -- ter o token do aparelho — senão recebe push que não é dele.
  if luciano_token is not null then
    raise exception
      'FAIL caso 1: Luciano ainda tem o token (=%) — receberia push do aparelho do Harrison',
      luciano_token;
  end if;

  -- CASO 2: o dono atual do aparelho (Harrison) mantém o token.
  if harrison_token is distinct from 'ExponentPushToken[DEVICE_COMPARTILHADO]' then
    raise exception
      'FAIL caso 2: Harrison deveria manter o token, mas está = %', harrison_token;
  end if;

  raise notice 'PUSH_TOKEN_UNIQUENESS: ALL PASS';
end $$;

rollback;
