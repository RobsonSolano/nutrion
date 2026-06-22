# Tasks — trial-e-migração

> Premissa zero-context. `[P]` = paralelizável. Comandos: `npm test` (vitest lógica),
> `npm run typecheck`, teste SQL via `npx supabase@latest` (ver VERIFY do billing-core).

## T1 — Migration: `grant_server_trial` + trigger de onboarding
- **What:** Função de concessão (elegibilidade + anti-abuso + grandfather-safe) + trigger que a
  dispara na conclusão/skip de onboarding de um `comum`. ([TRIAL]-01, [TRIAL]-02)
- **Where:** `supabase/migrations/20260622010000_server_trial.sql` (novo). Conforme design:
  `grant_server_trial(uuid) returns text` (definer, revoke public, grant service_role) +
  `tg_grant_trial_on_onboarding()` + `create trigger ... when (NEW.role='comum' and transições)`.
- **Depends:** —
- **Done-when:** migration aplica limpa e idempotente; concede 'granted' p/ comum elegível;
  no-op p/ consumed/grandfather/store/aluno.
- **Verify:** aplicar no banco de teste (`npx supabase@latest db reset` local) sem erro; T2 cobre a lógica.

## T2 — Teste SQL de `grant_server_trial`
- **What:** Teste transacional + ROLLBACK dos casos de elegibilidade. ([TRIAL]-01, [TRIAL]-04)
- **Where:** `supabase/tests/grant_server_trial.test.sql` (novo), padrão do
  `supabase/tests/resolve_entitlement.test.sql`.
- **Depends:** T1
- **Casos:** comum novo→'granted' (linha server_trial, trial_consumed=true, trial_end≈now+7d);
  2ª chamada→'skipped_consumed'; grandfather→'skipped_source' (linha intacta);
  store_play→'skipped_source'; aluno→'skipped_role'.
- **Done-when:** `NOTICE: GRANT_SERVER_TRIAL: ALL PASS`.
- **Verify:** rodar o .sql no banco de teste; colar o ALL PASS.

## T3 — `trialDaysLeft` (lógica pura, TDD) `[P]`
- **What:** Dias restantes do trial. ([TRIAL]-05)
- **Where:** `src/lib/trial.ts` + `src/lib/trial.test.ts`.
- **Depends:** —
- **TDD:** `(null, now)`→0; `(now+7d, now)`→7; `(now+1h, now)`→1 (ceil, último dia); `(now-1h, now)`→0.
- **Done-when:** testes verdes.
- **Verify:** `npm test src/lib/trial.test.ts` (colar saída).

## T4 — `useTrialStatus` + `TrialBanner` + montagem no dashboard
- **What:** Derivar `{inTrial, daysLeft}` e mostrar banner discreto. ([TRIAL]-05, [TRIAL]-06)
- **Where:** `src/hooks/useTrialStatus.ts` (usa `useEntitlement` + `trialDaysLeft(.., Date.now())`);
  `src/components/TrialBanner.tsx` (violet, ação → `openPaywall('chat')`); montar no topo de
  `app/(tabs)/index.tsx` (render condicional `inTrial`).
- **Depends:** T3
- **Done-when:** em trial → banner com dias; fora de trial → nada; typecheck verde.
- **Verify:** typecheck + UAT manual (usuário em trial).

## T5 — `coach-unlink-student`: concede trial + push
- **What:** Conceder `server_trial` ao ex-aluno (best-effort) e sinalizar no push. ([TRIAL]-03)
- **Where:** `supabase/functions/coach-unlink-student/index.ts`: após o passo 3, `rpc('grant_server_trial',
  { p_uid: student_id })` em try/catch; passar `trial_granted`/`trial_days` no contexto do
  `sendPushAi('coach_unlinked', ...)`. Ajustar a mensagem em `_shared/pushPrompts*` p/ mencionar
  os 7 dias quando concedido.
- **Depends:** T1
- **Done-when:** desvínculo concede trial p/ ex-aluno elegível; grandfather/consumed não recebe;
  falha no grant não reverte o unlink.
- **Verify:** typecheck/lint da função; UAT no deploy (desvincular aluno novo vs grandfather).

## Ordem
1. T1 → T2 (servidor + teste SQL).
2. T3 `[P]` → T4 (cliente).
3. T5 (edge, depende T1).

## Cobertura spec → tasks
| Req | Tasks |
|-----|-------|
| [TRIAL]-01 | T1, T2 |
| [TRIAL]-02 | T1 |
| [TRIAL]-03 | T5 |
| [TRIAL]-04 | T2 |
| [TRIAL]-05 | T3, T4 |
| [TRIAL]-06 | T4 |

## Pendência registrada (fora do #3, entregar ao final)
**Manual de configuração da loja + dúvidas do dev** (pedido explícito): (a) precisa publicar na
Play pra assinar? (b) valor mínimo de assinatura na Play; (c) cupom p/ assinar no valor mínimo.
É território da **spec #5**. Pesquisar fatos atuais (Web) + cruzar com `manual-2-billing-play-store.md`
e entregar como adendo ao final desta branch.
