# STATE — memória de decisões, blockers e pendências

> Atualizado conforme as features avançam. Carregado no contexto base do nano-spec.

## Billing (iniciativa de assinatura)

### billing-core (spec #1) — implementado em 2026-06-22 (branch `feature/implementacao-assinatura-paginas-auxiliares`)

**Decisões (D1–D5):** ver `.specs/features/2026-06-22-billing-core/spec.md`.

**CONCERN — ordem de deploy (bloqueante para prod):**
- O gating server-side (`402 needs_upgrade`) e a migration `20260622000000_billing_core.sql`
  **só podem ir pra produção junto do build do app que trata o 402** (spec #2 `paywall-ui`).
- Grandfather cobre todos os usuários atuais, então o risco é só pra **novos cadastros**
  pós-deploy sem UI de upsell. **Não fazer `db:push`/`fn:deploy` isolado em prod antes da #2.**

**Validação pendente (não bloqueia fechar a branch):**
- **Runtime das 5 edge functions Deno** (import do helper, formato do `rpc`, 402 chegando no app) —
  sem Deno local e `tsconfig` exclui `supabase/`; validar via `functions serve`/deploy + e2e.
- **RLS direta**: a policy de select existe, mas o acesso real é via RPC `resolve_entitlement`
  (SECURITY DEFINER) — não há grant de select direto a `authenticated`, então leitura direta da
  tabela já fica bloqueada por grant (defesa em profundidade). Sem teste direto necessário.
- Guia de verificação: `.specs/features/2026-06-22-billing-core/VERIFY.md`.

**Já validado (evidência fresca, 2026-06-22):**
- `resolve_entitlement` (lógica): **ALL PASS nos 14 casos contra o SCHEMA REAL local** (supabase start
  via `npx supabase@latest` — o CLI pinado 2.92.1 falha no sync de vector buckets) + também no container stub.
- Migration aplica limpa (DDL/RLS/backfill/funções/grants) no schema real; backfill = 1 grandfather/profile.
- `typecheck` do app: passa. Nenhum lint/type issue introduzido pelo billing-core.

**Nota de tooling:** `supabase start`/`db reset` com o CLI pinado (`supabase@^2.92.1`) aborta no
`Updating vector buckets` (409 FeatureNotEnabled) — incompatibilidade do CLI no local. Workaround:
`npx supabase@latest start`. Considerar bumpar o pin do CLI (afeta `npm run db:push`/`fn:deploy`).

### paywall-ui (spec #2) — implementado em 2026-06-22 (mesma branch)

**Decisões (C1–C7):** ver `.specs/features/2026-06-22-paywall-ui/context.md`.

- **Entrega:** leitura de entitlement (`useEntitlement` + hooks derivados `useAiPersonalLocked`/
  `useAiCoachLocked`), detecção tipada do `402 needs_upgrade` (`NeedsUpgradeError` em **4** call
  sites — incluindo `sanityCheck.ts`, achado no execute), rota modal `app/paywall.tsx` por
  `feature`, helper `handleNeedsUpgrade`, e gating proativo híbrido (componente `PaywallNotice`)
  nas 5 superfícies (chat, sanity, gerar plano, import treino, limite de alunos).
- **CTA "Assinar" = placeholder "em breve" (C1):** compra real (RevenueCat/IAP) é a spec #5.
  Aluno não vê CTA (C4): IA herdada do coach.
- **CONCERN de deploy do billing-core RESOLVIDO:** esta é a UI que trata o `402`. Agora o
  deploy conjunto pode acontecer (`db:push` + `fn:deploy`, ver billing-core VERIFY.md §4) ao
  fechar a branch. **Ainda não deployado** — fazer no fechamento da branch.

**Tooling:** introduzido **vitest** (`npm test`, `vitest.config.ts`) escopado a `src/lib/**`
(lógica pura, sem JSX/RN) — primeira base de testes unitários JS do projeto. 19 testes GREEN
(needsUpgrade, paywall, paywallContent, studentLimit).

**Validado (evidência fresca, 2026-06-22):** `typecheck` verde; `npm test` 19/19; lint dos
arquivos tocados sem warning/erro **novo**. **Pendente (UAT manual):** runtime das 5 superfícies
com usuário sem/com direito (guia em `.specs/features/2026-06-22-paywall-ui/VERIFY.md`).

### trial-e-migração (spec #3) — implementado em 2026-06-22 (branch `feature/billing-trial-e-migracao`)

**Decisões (T1–T7):** ver `.specs/features/2026-06-22-trial-e-migracao/context.md`.

- **Entrega:** `grant_server_trial(uuid)` (concessão única, grandfather-safe + anti-abuso) +
  **trigger** que concede ao **comum** que conclui/pula onboarding (keyed no onboarding, não no
  insert — exclui alunos criados pelo coach, T1b) + `coach-unlink-student` concede ao **ex-aluno**
  (best-effort) e o push `coach_unlinked` menciona o trial. Cliente: `trialDaysLeft` (puro) +
  `useTrialStatus` + `TrialBanner` discreto no dashboard.
- **ADIADO pro #5 (T2):** "escolhe quem fica" / downgrade de professor — gatilho real
  (cancelamento via webhook) mora no #5. **Sem cron de expiração (T5):** `resolve_entitlement`
  já trata `trial_end<now` ao vivo.
- **Validado (evidência fresca):** `grant_server_trial.test.sql` → **ALL PASS** (6 casos, schema
  real local via `npx supabase@latest`); migration limpa/idempotente; `npm test` 23/23; typecheck ok.
- **Pendente (UAT/deploy):** runtime do trigger + do unlink (precisa `auth.users` real / deploy).

**Estado da iniciativa:** specs #1 (billing-core) e #2 (paywall-ui) em `develop`; #3 nesta branch.
Próxima: **#4 legal-docs** e **#5 revenuecat-integration** (deploy conjunto + loja).

**Pendência cross-spec registrada (pedido do dev):** manual de configuração da loja respondendo
(a) se precisa publicar na Play pra assinar, (b) valor mínimo de assinatura, (c) cupom p/ assinar
no valor mínimo. É território do #5; entregar como adendo (pesquisa web + `manual-2-billing-play-store.md`).

## Dívida técnica conhecida (pré-existente, fora do escopo billing-core)

- **Lint do app:** `npm run lint` acusa **6 erros + 34 warnings** em arquivos `app/`/`src/`
  (ex: `app/(coach)/index.tsx`, `app/onboarding/resultado.tsx`, `src/services/auth.ts`),
  pré-existentes na develop. Decidido não tratar junto do billing-core (evitar scope creep).
  Candidato a um `chore(lint)` dedicado.
