# Contexto — trial-e-migração (spec #3 da iniciativa de billing)

> Concessão do trial de servidor + fluxo de ex-aluno. Consome o modelo do `billing-core`
> (#1), que já **lê** `server_trial` em `resolve_entitlement` (D4) mas não concede.
> Desenho aprovado em `.specs/features/billing/estrutura_assinatura.md` §2, §3.3, §3.5, §3.6.

## O que já existe (do #1)

- `subscriptions(tier, source, status, trial_end, trial_consumed, ...)`. `source='server_trial'`,
  `status='in_trial'`, `tier='pro'`, `trial_end>now` ⇒ `resolve_entitlement` dá acesso (durante o trial).
- `resolve_entitlement` trata `trial_end < now()` como **sem acesso** ao vivo (a expiração não
  precisa de cron — ver T5).
- `trial_consumed boolean` (anti-abuso, default false) — **a concessão é esta spec**.
- `coach-unlink-student` já: apaga notas, anula coach_id em revisions, faz `role='comum' + coach_id=null`,
  dispara push `coach_unlinked`. **Falta conceder o trial.**

## Decisões (discovery 2026-06-22)

| # | Decisão | Razão / efeito |
|---|---------|----------------|
| T1 | **Concessão via trigger no banco** | Automático, server-side, sem depender do app nem da loja. |
| T1b | **Trigger keyed em CONCLUSÃO de onboarding com `role='comum'`** (não no INSERT) | `coach-create-student` cria o aluno passando por `role='comum'` (default do `handle_new_user`) e **depois** seta `role='aluno'` + `onboarding_completed_at` **no mesmo update**. Um trigger no INSERT concederia/consumiria trial indevido pro aluno (roubando o trial futuro de ex-aluno). Keyed em "comum concluiu/pulou onboarding" (`onboarding_completed_at`/`onboarding_skipped_at` null→não-null com `NEW.role='comum'`), o aluno criado pelo coach (já `role='aluno'` nesse update) **nunca dispara**. |
| T2 | **"Escolhe quem fica" (downgrade) ADIADO pro #5** | O gatilho real (cancelamento → webhook) mora no #5. #3 entrega trial + ex-aluno (100% testáveis/deployáveis agora) sem construir UI sem trigger. O `coach-unlink-student` (reusado pelo downgrade) fica pronto. |
| T3 | **`grant_server_trial(uuid)` grandfather-safe + anti-abuso** | Concede só se `trial_consumed=false` E `source ∉ {grandfather, store_*}` (nunca sobrescreve grandfather — que é IA pra sempre — nem assinatura de loja). Idempotente. Marca `trial_consumed=true`. |
| T4 | **Trial é por-pessoa (1/vida), independente de transição de role** | Se um comum em trial vira professor durante os 7 dias, aproveita pro/coach até `trial_end` (server_trial tier=pro). Bounded e não-repetível. Aceito. |
| T5 | **Sem cron de expiração** | `resolve_entitlement` já trata `trial_end<now` como sem acesso ao vivo. `status='in_trial'` é cosmético. Flipar status→expired fica **fora de escopo** (analytics futuro). |
| T6 | **"Não quero continuar o trial" (informativo) ADIADO** | §3.6 diz "a UI **pode** oferecer" (opcional, só esconde lembretes, não zera `trial_consumed`). Sem custo em adiar. |
| T7 | **Ex-aluno reusa `grant_server_trial`** | `coach-unlink-student` chama o RPC após virar comum. Mantém o push `coach_unlinked` (mencionar o trial na mensagem). |

## Fora de escopo (#3)

- "Escolhe quem fica" / downgrade de professor (→ #5, junto do gatilho de cancelamento).
- Trial de professor via **loja** (free-trial offer) — é #5.
- Webhook RevenueCat, compra, `period_end`, cancelamento real (→ #5).
- Cron de expiração / flip de `status` (T5).
- UI "não quero continuar o trial" (T6).

## Superfícies tocadas

- **Migration nova:** `grant_server_trial(uuid)` + trigger em `profiles`.
- **Edge:** `coach-unlink-student/index.ts` (concede trial via RPC + push).
- **Client (mínimo):** `trialDaysLeft` (puro), `useTrialStatus`, banner discreto de trial.
- **Teste SQL:** `supabase/tests/grant_server_trial.test.sql` (padrão do billing-core).
