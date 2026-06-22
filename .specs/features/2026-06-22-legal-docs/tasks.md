# Tasks — legal-docs

> Premissa zero-context. `[P]` = paralelizável. `npm test` (vitest), `npm run typecheck`.

## T1 — Migration: `legal_documents` + `legal_acceptances` + RLS + seed
- **What:** Tabelas, RLS e seed dos 3 docs (URLs placeholder). ([LEGAL]-01, [LEGAL]-02)
- **Where:** `supabase/migrations/20260622020000_legal_docs.sql` conforme design (idempotente,
  seed `on conflict do nothing`, RLS: legal_documents read autenticado / legal_acceptances own).
- **Depends:** —
- **Done-when:** aplica limpa e idempotente; 3 docs seedados; RLS criada.
- **Verify:** aplicar no banco de teste (`npx supabase@latest`); `select` retorna 3 docs.

## T2 — Tipos + lógica pura (TDD) `[P]`
- **What:** `LegalDocType`/`LegalDocument` + `requiredAcceptanceDocs`. ([LEGAL]-03)
- **Where:** `src/types/legal.ts`; `src/lib/legal.ts` + `src/lib/legal.test.ts`.
- **Depends:** —
- **TDD:** `requiredAcceptanceDocs([uso(true),contrato(true),priv(false)])` → [uso, contrato];
  `([])`→[]; só privacidade→[].
- **Done-when:** testes verdes.
- **Verify:** `npm test src/lib/legal.test.ts`.

## T3 — Service + hook (ler docs + registrar aceite)
- **What:** `fetchLegalDocuments`, `recordLegalAcceptance` (idempotente), `useLegalDocs`. ([LEGAL]-03)
- **Where:** `src/services/legal.ts` (`from('legal_documents')`; insert tolerante a conflito em
  `legal_acceptances` p/ docs requires_acceptance); `src/hooks/useLegalDocs.ts` (React Query, staleTime alto).
- **Depends:** T1, T2
- **Done-when:** hook retorna os docs; `recordLegalAcceptance` insere Uso+Contrato e é no-op em 2ª chamada.
- **Verify:** typecheck; runtime no UAT.

## T4 — `Checkbox` + `TermsAcceptance` (componentes)
- **What:** Checkbox reutilizável + bloco de aceite com termos linkados. ([LEGAL]-04..06)
- **Where:** `src/components/ui/Checkbox.tsx` (Pressable + Check/Square, checked/onChange);
  `src/components/TermsAcceptance.tsx` (checkbox + "Li e aceito os [Termos de Uso] e o
  [Termos de Contrato]" lendo URLs de `useLegalDocs`, abre via Linking/web-browser; link Privacidade).
- **Depends:** T3
- **Done-when:** componente renderiza com props `accepted`/`onChange`; links abrem as URLs.
- **Verify:** typecheck; render manual.

## T5 — Aceite no cadastro normal + Google (`login.tsx`)
- **What:** Checkbox gate em "Criar conta" (signup) e em "Continuar com Google"; registra após
  sucesso; login por email não exige. ([LEGAL]-04, [LEGAL]-06)
- **Where:** `app/(auth)/login.tsx`: estado `accepted`, `<TermsAcceptance>` acima do bloco Google;
  `handleGoogle` early-return se `!accepted` + `recordLegalAcceptance()` no sucesso; `canSubmit`
  (signup) exige `accepted`; `recordLegalAcceptance()` após signUp; ajustar disclaimer estático.
- **Depends:** T4
- **Done-when:** sem aceite, Google e "Criar conta" bloqueados; com aceite, fluxo normal + registro;
  "Entrar" (email login) não exige.
- **Verify:** typecheck; UAT manual (signup email, Google, login email).

## T6 — Aceite no cadastro de professor (`signup-professor.tsx`)
- **What:** Mesmo aceite + gate + registro. ([LEGAL]-05)
- **Where:** `app/(auth)/signup-professor.tsx`: `<TermsAcceptance>`, `canSubmit` exige `accepted`,
  `recordLegalAcceptance()` após `signUpWithPassword`.
- **Depends:** T4
- **Done-when:** botão criar professor bloqueado sem aceite; registra ao concluir.
- **Verify:** typecheck; UAT manual.

## T7 — URL de privacidade no `app.config.ts` `[P]`
- **What:** Configurar URL de privacidade (placeholder hotsite). ([LEGAL]-07)
- **Where:** `app.config.ts` (`extra.privacyPolicyUrl` + comentário TODO).
- **Depends:** —
- **Done-when:** URL presente no config; typecheck/prebuild ok.
- **Verify:** typecheck.

## Ordem
1. T1, T2, T7 `[P]`.
2. T3 (após T1,T2) → T4 (após T3).
3. T5, T6 (após T4).

## Cobertura spec → tasks
| Req | Tasks |
|-----|-------|
| [LEGAL]-01 | T1 |
| [LEGAL]-02 | T1 |
| [LEGAL]-03 | T2, T3 |
| [LEGAL]-04 | T5 |
| [LEGAL]-05 | T6 |
| [LEGAL]-06 | T5 |
| [LEGAL]-07 | T7 |
