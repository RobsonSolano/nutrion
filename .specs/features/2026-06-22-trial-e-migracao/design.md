# Design — trial-e-migração

> Arquitetura da spec #3. Servidor (migration + edge) concede; cliente só mostra.
> Decisões em `context.md` (T1–T7). Não altera `resolve_entitlement` (#1).

## Camada 1 — Concessão no banco (migration nova)

Arquivo: `supabase/migrations/<ts>_server_trial.sql` (idempotente).

### `grant_server_trial(p_uid uuid) returns text` — [TRIAL]-01
SECURITY DEFINER, `search_path=public`. Fonte única da regra de concessão.
```
-- lê role atual + (source, trial_consumed) da subscription
-- guarda-chuvas de elegibilidade (retorna rótulo, idempotente):
if role <> 'comum'                              -> return 'skipped_role';
if trial_consumed                               -> return 'skipped_consumed';
if source in ('grandfather','store_play','store_apple','stripe') -> return 'skipped_source';
-- elegível: upsert do trial
insert into subscriptions(user_id,tier,source,status,trial_end,trial_consumed)
  values(p_uid,'pro','server_trial','in_trial',now()+interval '7 days',true)
  on conflict (user_id) do update set
    tier='pro', source='server_trial', status='in_trial',
    trial_end=now()+interval '7 days', trial_consumed=true, updated_at=now();
return 'granted';
```
- `revoke all ... from public`; `grant execute to service_role` (a edge chama via RPC).
  O trigger roda como definer (não precisa de grant ao authenticated).
- **Grandfather-safe (T3):** nunca toca linha grandfather/loja. **Anti-abuso (T3/T4):**
  `trial_consumed` barra repetição.

### Trigger de onboarding — [TRIAL]-02 / T1b
```
create or replace function tg_grant_trial_on_onboarding() returns trigger
  language plpgsql security definer set search_path=public as $$
begin perform public.grant_server_trial(NEW.id); return NEW; end $$;

drop trigger if exists trg_grant_trial_on_onboarding on public.profiles;
create trigger trg_grant_trial_on_onboarding
  after update on public.profiles for each row
  when (
    NEW.role = 'comum' and (
      (NEW.onboarding_completed_at is not null and OLD.onboarding_completed_at is null) or
      (NEW.onboarding_skipped_at  is not null and OLD.onboarding_skipped_at  is null)
    )
  )
  execute function tg_grant_trial_on_onboarding();
```
- **Por que UPDATE-on-onboarding e não INSERT:** `coach-create-student` cria o aluno via
  `handle_new_user` (role='comum' no insert) e no mesmo update seta `role='aluno'` +
  `onboarding_completed_at`. Com a `WHEN (NEW.role='comum' ...)`, esse update (NEW.role='aluno')
  **não** dispara → aluno não consome trial. Self-signup conclui onboarding como `comum` → dispara.

## Camada 2 — Edge `coach-unlink-student` — [TRIAL]-03

Após o passo 3 (role='comum' OK), antes/junto do push:
```ts
let trialGranted = false;
try {
  const { data: r } = await supaService.rpc('grant_server_trial', { p_uid: body.student_id });
  trialGranted = r === 'granted';
} catch (e) { console.error('[coach-unlink] grant_server_trial:', e); } // best-effort
...
void sendPushAi(supaService, body.student_id, 'coach_unlinked', {
  coach_name, days_with_coach, trial_granted: trialGranted, trial_days: trialGranted ? 7 : 0,
});
```
- Best-effort: falha no grant **não** reverte o desvínculo (igual ao push).
- Push: passa `trial_granted`/`trial_days` no contexto. Tocar o prompt de `coach_unlinked`
  (em `_shared/pushPrompts`) pra mencionar os 7 dias **quando** concedido (ajuste pequeno).

## Camada 3 — Cliente (mínimo) — [TRIAL]-05/06

- `src/lib/trial.ts` (puro, testável):
  ```ts
  export function trialDaysLeft(trialEnd: string | null, now: number): number {
    if (!trialEnd) return 0;
    const ms = new Date(trialEnd).getTime() - now;
    return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
  }
  ```
- `src/hooks/useTrialStatus.ts`: usa `useEntitlement`; `inTrial = source==='server_trial' &&
  daysLeft>0`; retorna `{ inTrial, daysLeft }`. (Date.now() lido no hook — `trialDaysLeft` é puro.)
- `src/components/TrialBanner.tsx`: se `inTrial`, mostra "✨ Período de teste · {daysLeft} dia(s)
  restante(s)" + ação discreta → `openPaywall('chat')`. Estilo do tema (violet), reusa padrão.
- Montar o banner no topo do dashboard `app/(tabs)/index.tsx` (uma linha condicional).

## Camada 4 — Teste SQL — restrição

`supabase/tests/grant_server_trial.test.sql` (transacional + ROLLBACK, padrão do `resolve_entitlement.test.sql`):
casos → comum novo (granted), 2ª chamada (skipped_consumed), grandfather (skipped_source, linha intacta),
store_play (skipped_source), aluno (skipped_role). Asserts no estado de `subscriptions` + `NOTICE ALL PASS`.

## Arquivos

**Novos:** migration `*_server_trial.sql`, `supabase/tests/grant_server_trial.test.sql`,
`src/lib/trial.ts`, `src/lib/trial.test.ts`, `src/hooks/useTrialStatus.ts`, `src/components/TrialBanner.tsx`.
**Tocados:** `supabase/functions/coach-unlink-student/index.ts`,
`supabase/functions/_shared/pushPrompts*` (mensagem coach_unlinked), `app/(tabs)/index.tsx`.

## Riscos / arestas

- **Trigger e RLS:** o update de onboarding do próprio usuário dispara o trigger (definer) que
  escreve em `subscriptions` — ok (definer ignora RLS). Confirmar no teste de runtime.
- **Comum→professor no trial (T4):** server_trial tier=pro dá ai_coach/20 alunos até expirar.
  Aceito (bounded, 1/vida).
- **Skip de onboarding:** também concede (transição de `onboarding_skipped_at`). Intencional.
- **`now()` no cliente:** `Date.now()` fica no hook; `trialDaysLeft` puro recebe `now` (testável,
  sem violar a restrição de Date no ambiente de teste — vitest passa `now` explícito).
