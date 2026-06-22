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

**Validação pendente (não bloqueia fechar a branch; exige Supabase real):**
- Migration contra o schema **real** (com todas as migrations/triggers) via `db:push` em BD de teste.
- **RLS na prática** (usuário autenticado lê só a própria linha) — policy criada, não exercida localmente.
- **Runtime das 5 edge functions Deno** (import do helper, formato do `rpc`, 402 chegando no app) —
  sem Deno local e `tsconfig` exclui `supabase/`; validar via `functions serve`/deploy em BD de teste + e2e.
- Guia de verificação: `.specs/features/2026-06-22-billing-core/VERIFY.md`.

**Já validado (evidência fresca, 2026-06-22):**
- `resolve_entitlement` (lógica): ALL PASS nos 14 casos em Postgres 17 descartável (container).
- Migration aplica limpa (DDL/RLS/backfill/funções/grants) no stub; backfill = 1 grandfather/profile.
- `typecheck` do app: passa. Nenhum lint/type issue introduzido pelo billing-core.

## Dívida técnica conhecida (pré-existente, fora do escopo billing-core)

- **Lint do app:** `npm run lint` acusa **6 erros + 34 warnings** em arquivos `app/`/`src/`
  (ex: `app/(coach)/index.tsx`, `app/onboarding/resultado.tsx`, `src/services/auth.ts`),
  pré-existentes na develop. Decidido não tratar junto do billing-core (evitar scope creep).
  Candidato a um `chore(lint)` dedicado.
