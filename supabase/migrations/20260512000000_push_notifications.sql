-- =====================================================================
-- NutriOn — Push notifications (Expo Push)
-- Cada user pode opcionalmente registrar um Expo Push Token. Quando
-- preenchido, recebe notificações push (nova solicitação pro
-- professor, resposta do professor pro aluno, etc).
--
-- Token IS NULL = user desativou ou nunca habilitou notificações.
-- =====================================================================

alter table public.profiles
  add column if not exists expo_push_token text;

-- Index pra lookup rápido quando edge function precisar mandar push.
create index if not exists profiles_push_token_idx
  on public.profiles (expo_push_token)
  where expo_push_token is not null;

comment on column public.profiles.expo_push_token is
  'Expo Push Token registrado pelo client quando o user habilita notificações no perfil. Null = desabilitado.';
