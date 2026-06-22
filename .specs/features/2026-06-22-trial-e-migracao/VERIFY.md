# Como verificar o trial-e-migração

Lógica validada por mim (teste SQL `ALL PASS` + vitest 23/23 + typecheck). Abaixo o que falta
(UAT de runtime), com BD/projeto de teste — nunca a prod.

## 1. Teste da função (rápido, transacional)
```bash
npx supabase@latest start
docker exec -i supabase_db_nutrion psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/grant_server_trial.test.sql
```
Esperado: `NOTICE: GRANT_SERVER_TRIAL: ALL PASS`. (Cobre granted, anti-abuso, grandfather-safe,
loja, aluno, professor.)

## 2. UAT do trigger de onboarding (precisa usuário real)
No BD de teste, com um **comum novo** (auth.users real):
- Concluir o onboarding no app (seta `onboarding_completed_at`) → conferir que ganhou
  `subscriptions(source='server_trial', tier='pro', status='in_trial', trial_end≈now+7d, trial_consumed=true)`.
- Criar um **aluno via professor** (`coach-create-student`) → conferir que o aluno **NÃO** ganhou
  server_trial (ele é `role='aluno'` no update que conclui o onboarding; o trigger não dispara).
- `resolve_entitlement` do comum em trial → `ai_personal=true`. Após `trial_end` (forçar no passado) → `free`.

## 3. UAT do ex-aluno (`coach-unlink-student`)
- Desvincular um **aluno novo** (sem grandfather, sem trial consumido) → vira comum + ganha
  server_trial 7d + push `coach_unlinked` menciona os dias. Retorno da função traz `trial_granted:true`.
- Desvincular um **aluno grandfather** (pré-billing) → vira comum **sem** novo trial (mantém grandfather);
  `trial_granted:false`. Sem erro; desvínculo sempre conclui (grant é best-effort).

## 4. UAT do cliente
- Usuário em trial → `TrialBanner` no topo do dashboard mostra "Período de teste · X dias" e leva ao paywall.
- Fora de trial → banner some.

## 5. Caminho para a PROD
Junto da iniciativa: `npm run db:push` (migration + trigger) + `npm run fn:deploy`
(`coach-unlink-student`) + build. Aditivo, sem wipe. Grandfather (pré-billing) segue com IA pra sempre.
Nunca `supabase db reset --linked`.
