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

## Dívida técnica conhecida (pré-existente, fora do escopo billing-core)

- **Lint do app:** `npm run lint` acusa **6 erros + 34 warnings** em arquivos `app/`/`src/`
  (ex: `app/(coach)/index.tsx`, `app/onboarding/resultado.tsx`, `src/services/auth.ts`),
  pré-existentes na develop. Decidido não tratar junto do billing-core (evitar scope creep).
  Candidato a um `chore(lint)` dedicado.
