# Design — legal-docs

> Arquitetura da spec #4. Servidor (tabelas) + cliente (aceite no cadastro). Decisões L1–L7.

## Camada 1 — Migration (tabelas + seed + RLS)

`supabase/migrations/<ts>_legal_docs.sql` (idempotente):

```sql
create table if not exists public.legal_documents (
  doc_type text primary key check (doc_type in ('privacidade','termos_uso','termos_contrato')),
  version text not null,
  url text not null,
  title text not null,
  requires_acceptance boolean not null default false,
  updated_at timestamptz not null default now()
);
-- seed (on conflict do nothing) — URLs PLACEHOLDER (TODO hotsite real)
insert into public.legal_documents (doc_type, version, url, title, requires_acceptance) values
  ('privacidade','2026-06-22','https://personafit.app/legal/privacidade','Política de Privacidade', false),
  ('termos_uso','2026-06-22','https://personafit.app/legal/termos-de-uso','Termos de Uso', true),
  ('termos_contrato','2026-06-22','https://personafit.app/legal/contrato','Termos de Contrato', true)
on conflict (doc_type) do nothing;

create table if not exists public.legal_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, doc_type, version)
);
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;
-- legal_documents: catálogo legível por autenticados; escrita só service_role.
create policy "legal_documents_read" on public.legal_documents for select to authenticated using (true);
-- legal_acceptances: dono lê/insere o próprio; sem update/delete.
create policy "legal_acceptances_select_own" on public.legal_acceptances for select using (auth.uid()=user_id);
create policy "legal_acceptances_insert_own" on public.legal_acceptances for insert with check (auth.uid()=user_id);
```
- **Sem backfill** (L2/L7): existentes não passam por cadastro → nunca prompted.

## Camada 2 — Cliente: tipos, service, hook, lógica pura

- `src/types/legal.ts`: `LegalDocType = 'privacidade'|'termos_uso'|'termos_contrato'`;
  `LegalDocument = { doc_type, version, url, title, requires_acceptance }`.
- `src/lib/legal.ts` (puro, testável): `requiredAcceptanceDocs(docs: LegalDocument[]): LegalDocument[]`
  = `docs.filter(d => d.requires_acceptance)`. (Base pra gate e registro.)
- `src/services/legal.ts`:
  - `fetchLegalDocuments(): Promise<LegalDocument[]>` — `from('legal_documents').select()`.
  - `recordLegalAcceptance(): Promise<void>` — lê docs atuais, monta linhas dos `requires_acceptance`
    com `auth.uid()`, `insert ... ` (idempotente — ignora duplicados via try/`onConflict`/ignore).
- `src/hooks/useLegalDocs.ts`: React Query (catálogo; `staleTime` alto). Expõe `documents` +
  `byType(doc_type)` pra montar os links.

## Camada 3 — UI de aceite (reusável)

- `src/components/ui/Checkbox.tsx` (novo): `Pressable` + ícone `Check`/`Square` (lucide), `checked`/`onChange`.
- `src/components/TermsAcceptance.tsx` (novo): encapsula o `Checkbox` + texto "Li e aceito os
  [Termos de Uso] e o [Termos de Contrato]" com links abrindo as URLs (via `Linking.openURL` ou
  `expo-web-browser` se presente) + link discreto à Privacidade. Props: `accepted`, `onChange`.
  Lê URLs de `useLegalDocs`.

### `app/(auth)/login.tsx` — [LEGAL]-04, [LEGAL]-06
- Estado `accepted`. Renderizar `<TermsAcceptance accepted onChange/>` acima do bloco Google
  (ele gate Google) e visível também no modo signup.
- `handleGoogle`: `if (!accepted) { aviso; return; }` antes de `loginWithGoogle`; após sucesso →
  `recordLegalAcceptance()`.
- `canSubmit` (modo signup) passa a exigir `accepted`. Após `signUp` sucesso → `recordLegalAcceptance()`.
- Modo **login por email**: NÃO exige `accepted` (grandfather — L5).
- Remover/ajustar o disclaimer estático atual (linhas 315-319) se redundante com o aceite.

### `app/(auth)/signup-professor.tsx` — [LEGAL]-05
- Mesmo `<TermsAcceptance>`; `canSubmit` exige `accepted`; após `signUpWithPassword` sucesso →
  `recordLegalAcceptance()`.

## Camada 4 — Config — [LEGAL]-07

- `app.config.ts`: adicionar a URL de privacidade. Onde a loja/Expo espera — em `extra`
  (`extra.privacyPolicyUrl`) e/ou no campo apropriado. Valor = placeholder do hotsite (mesma URL
  do seed `privacidade`). Comentário TODO pra trocar quando o hotsite existir.

## Registro do aceite — fluxo

```
signUp/professor sucesso  → recordLegalAcceptance()   (autenticado; insere Uso+Contrato vAtual)
Google sucesso (accepted) → recordLegalAcceptance()   (idempotente: no-op p/ quem já tinha)
```
- Idempotência: PK `(user_id,doc_type,version)` + insert tolerante a conflito → seguro chamar sempre.
- Falha no registro: logar; não derrubar o cadastro (aceite já foi dado na UI; registro é auditoria).
  (Ou: surfaçar erro — decidir no execute; preferir não bloquear entrada do usuário recém-criado.)

## Teste

- `src/lib/legal.test.ts` (vitest): `requiredAcceptanceDocs` filtra só `requires_acceptance=true`
  (uso+contrato; exclui privacidade); lista vazia → vazio.
- RLS de `legal_acceptances` + idempotência: validar no UAT/deploy (precisa auth real).
- UI: typecheck + manual.

## Arquivos

**Novos:** migration `*_legal_docs.sql`, `src/types/legal.ts`, `src/lib/legal.ts`,
`src/lib/legal.test.ts`, `src/services/legal.ts`, `src/hooks/useLegalDocs.ts`,
`src/components/ui/Checkbox.tsx`, `src/components/TermsAcceptance.tsx`.
**Tocados:** `app/(auth)/login.tsx`, `app/(auth)/signup-professor.tsx`, `app.config.ts`.

## Riscos / arestas

- **Google compartilhado login/signup:** o checkbox trava o botão Google sempre; login por email
  não. Existente que usa Google marca 1x por visita à tela de login (raro — sessão persiste).
- **URLs placeholder:** o app linka URLs que ainda não existem até o hotsite ser publicado —
  documentado; trocar em `legal_documents` (sem release) quando existir.
- **Registro pós-criação:** o usuário é criado antes do registro do aceite; se o insert falhar, o
  aceite (consentimento UI) ocorreu mas não foi auditado — logar e, idealmente, retry leve.
