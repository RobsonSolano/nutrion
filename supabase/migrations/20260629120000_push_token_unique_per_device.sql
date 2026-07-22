-- =====================================================================
-- Persona Fit — Unicidade do Expo Push Token por dispositivo
--
-- O Expo Push Token identifica o APARELHO, não o usuário. Quando alguém
-- troca de conta no mesmo celular, o mesmo token acabava grudado em dois
-- perfis (o cliente só consegue gravar o token no próprio perfil, e a
-- RLS o impede de limpar o de outro). Resultado: o dono anterior
-- continuava recebendo push num aparelho que não é mais dele.
--
-- Este trigger garante o invariante "um token não-nulo pertence a no
-- máximo um perfil": ao gravar um token num perfil, ele é removido
-- (set null) de qualquer OUTRO perfil que o tenha. Auto-cura perfis já
-- duplicados no próximo registro. SECURITY DEFINER pra poder limpar a
-- linha de outro usuário (a RLS bloquearia o trigger rodando como o
-- usuário autenticado).
-- =====================================================================

create or replace function public.tg_push_token_unique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.expo_push_token is not null
     and new.expo_push_token is distinct from old.expo_push_token then
    update public.profiles
      set expo_push_token = null
      where expo_push_token = new.expo_push_token
        and id <> new.id;
  end if;
  return new;
end;
$$;

-- AFTER (não BEFORE): o token já está gravado em NEW; a limpeza nas
-- outras linhas dispara o trigger de novo nelas, mas com token = null
-- (não entra no if) — sem recursão infinita.
drop trigger if exists profiles_push_token_unique on public.profiles;
create trigger profiles_push_token_unique
  after insert or update of expo_push_token on public.profiles
  for each row
  execute function public.tg_push_token_unique();

comment on function public.tg_push_token_unique() is
  'Garante que um Expo Push Token não-nulo pertença a no máximo um perfil (o dono atual do aparelho). Ver migration 20260629120000.';
