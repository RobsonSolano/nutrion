# Spec — legal-docs

> Spec #4 da iniciativa de assinatura. Infra de **aceite de documentos legais no cadastro**
> + URL de privacidade. **Não** escreve texto jurídico nem hospeda o hotsite (separado).
>
> Status: **especificação** · Branch: a criar (`feature/billing-legal-docs`)
> · Escopo: **Large** · Idioma: PT-BR. Decisões em `context.md` (L1–L7).

## Objetivo

Registrar, de forma versionada e auditável, o **aceite dos Termos de Uso e Termos de Contrato**
por novos usuários (normal, professor e via Google), linkando às páginas públicas do hotsite
(fonte única do texto) e configurar a **URL de privacidade** exigida pela loja.

## Fora de escopo

- Conteúdo jurídico dos 3 documentos + hospedagem do hotsite (separado; advogado).
- Re-aceite forçado por mudança de versão (futuro).
- URL pública de exclusão de conta (relacionado, mas fora das 3 páginas — tratar na publicação).
- Aceite no momento da **compra** (a compra é #5).

## Requisitos

### Dados

- **[LEGAL]-01** — Migration cria `legal_documents` (PK `doc_type`; `version`, `url`, `title`,
  `requires_acceptance`, `updated_at`) e faz **seed** dos 3 tipos (privacidade,
  termos_uso, termos_contrato) com URLs **placeholder**.
  - QUANDO a migration roda ENTÃO existem as 3 linhas; `termos_uso`/`termos_contrato` com
    `requires_acceptance=true` e `privacidade` com `false`.
  - QUANDO roda 2x ENTÃO é idempotente (sem erro, sem duplicar).

- **[LEGAL]-02** — Migration cria `legal_acceptances` (PK composta `user_id, doc_type, version`;
  `accepted_at`) + RLS: dono lê/insere o próprio; sem update/delete pelo client.
  - QUANDO um usuário autenticado faz `select`/`insert` da própria linha ENTÃO é permitido
    (`auth.uid()=user_id`).
  - QUANDO tenta ler/escrever linha de outro usuário ENTÃO é negado por RLS.
  - QUANDO insere a mesma `(user_id, doc_type, version)` 2x ENTÃO não duplica (PK/`on conflict`).

### Leitura & registro

- **[LEGAL]-03** — Service `legal.ts` + hook: lê os documentos atuais (URLs/títulos/versões) e
  registra aceite de forma idempotente.
  - QUANDO o cadastro monta ENTÃO os links e versões vêm de `legal_documents` (não hardcoded).
  - QUANDO `recordLegalAcceptance()` roda após cadastro ENTÃO grava 1 linha por doc
    `requires_acceptance=true` na versão atual; chamar de novo é no-op (idempotente).

### Aceite no cadastro (UI)

- **[LEGAL]-04** — Cadastro de **usuário normal** (`login.tsx`, modo signup): checkbox de aceite
  com links pros termos; bloqueia "Criar conta" até marcar; registra após sucesso.
  - QUANDO o checkbox está desmarcado ENTÃO "Criar conta" fica desabilitado.
  - QUANDO o cadastro conclui ENTÃO o aceite é registrado (Uso + Contrato, versão atual).
  - QUANDO o usuário toca num termo ENTÃO abre a URL pública do hotsite.

- **[LEGAL]-05** — Cadastro de **professor** (`signup-professor.tsx`): mesmo checkbox + gate + registro.
  - QUANDO o checkbox está desmarcado ENTÃO o botão de criar conta de professor fica desabilitado.
  - QUANDO conclui ENTÃO o aceite é registrado.

- **[LEGAL]-06** — **"Continuar com Google"** (`login.tsx`): bloqueado até o checkbox de aceite
  marcado; registra após o sign-in (L5/L6).
  - QUANDO o checkbox está desmarcado ENTÃO o botão do Google não dispara o fluxo (mostra aviso/desabilitado).
  - QUANDO o sign-in com Google conclui ENTÃO o aceite é registrado (idempotente — no-op se já existia).
  - QUANDO o usuário faz **login por email** (modo login) ENTÃO o aceite **não** é exigido (grandfather).

### Config

- **[LEGAL]-07** — `app.config.ts`: define a **URL de Política de Privacidade** (placeholder do
  hotsite), exigida pelo Google.
  - QUANDO o build é gerado ENTÃO há uma URL de privacidade disponível (a apontar na ficha da loja).

## Restrições de implementação

- Migration idempotente em `supabase/migrations/` (seed via `on conflict do nothing`).
- RLS por `auth.uid()=user_id` em `legal_acceptances`; `legal_documents` é leitura pra
  `authenticated` (catálogo), escrita só service_role.
- Reusar componentes de `src/components/ui` (checkbox/links). Sem deps novas.
- URLs placeholder claramente marcadas (TODO: hotsite real). Não inventar domínio definitivo.
- Lógica testável (ex: "quais docs exigem aceite", "aceite completo?") com vitest. UI: manual + typecheck.
- PT-BR com acentuação.

## Rastreabilidade

| ID | Descrição | Status |
|----|-----------|--------|
| [LEGAL]-01 | `legal_documents` + seed | Verified (migration aplica; 3 docs seedados no schema real local) |
| [LEGAL]-02 | `legal_acceptances` + RLS | Verified (RLS habilitada; idempotente) / enforcement RLS no UAT |
| [LEGAL]-03 | Service/hook ler + registrar (idempotente) | Implemented (typecheck; runtime no UAT) |
| [LEGAL]-04 | Aceite no cadastro normal | Implemented (typecheck; UAT manual) |
| [LEGAL]-05 | Aceite no cadastro professor | Implemented (typecheck; UAT manual) |
| [LEGAL]-06 | Aceite travando Google | Implemented (typecheck; UAT manual) |
| [LEGAL]-07 | URL de privacidade no `app.config.ts` | Verified (config presente) |

> **Validado (evidência fresca, 2026-06-22):** migration aplica limpa/idempotente, **3 docs
> seedados** (privacidade=false, uso/contrato=true), **RLS habilitada** nas 2 tabelas (schema real
> local via `npx supabase@latest`); `requiredAcceptanceDocs` 3 testes vitest (suíte 26/26);
> typecheck verde; lint sem warning novo. **Pendente (UAT):** runtime do aceite (signup email,
> Google, professor → grava `legal_acceptances`) + enforcement RLS, com auth real/deploy.
> **TODO publicação:** trocar as URLs placeholder pelas reais do hotsite (em `legal_documents` e
> `app.config.ts`) — pré-requisito de loja.

## Nota de deploy

`db:push` (tabelas + seed) + build do app com o aceite. Aditivo, sem wipe. As **URLs reais** do
hotsite devem ser atualizadas em `legal_documents` (sem release) e a de privacidade no
`app.config.ts` (release) quando as páginas existirem — pré-requisito de publicação.
