# Consentimento de dados de saúde (LGPD art. 11, I)

> Escopo: Medium. Branch: `feature/assinatura` (iniciativa billing/legal, commit dividido).
> Data: 2026-07-21.

## Contexto

A Política de Privacidade afirma que o tratamento de **dado sensível de saúde** se dá com base em
**consentimento (LGPD art. 11, I)**. A LGPD exige que esse consentimento seja **específico e destacado**.
Hoje o cadastro (`TermsAcceptance` + `recordLegalAcceptance`) só capta o aceite de **Termos de Uso +
Contrato**; a Privacidade é só link de divulgação. **Falta o consentimento de saúde** — lacuna de
adequação LGPD (não é bloqueador de aprovação da Play).

## Requisitos

- **[HEALTH-01]** No cadastro de usuário comum (`app/(auth)/login.tsx`) e de professor
  (`app/(auth)/signup-professor.tsx`), exibir um **2º checkbox, separado e destacado** do aceite de
  Termos, com a redação aprovada:
  > "Autorizo o tratamento dos meus dados de saúde (medidas, registros de alimentação e treino, fotos
  > e conversas com a IA) para gerar metas, planos e recomendações personalizadas, conforme a Política
  > de Privacidade." (com "Política de Privacidade" linkada à URL do hotsite)

- **[HEALTH-02]** O cadastro só prossegue com **ambos** os consentimentos dados:
  - `login.tsx`: `canSubmit` (cadastro por e-mail) e `handleGoogle` (conta via Google) exigem
    `acceptedTerms && healthConsent`.
  - `signup-professor.tsx`: `canSubmit` exige `acceptedTerms && healthConsent`.
  - Login puro (não-cadastro) **não** é afetado.

- **[HEALTH-03]** O consentimento é **registrado para auditoria** (user_id + versão + data), idempotente,
  pela mesma via dos Termos (`recordLegalAcceptance`), via novo `doc_type='consentimento_saude'` em
  `legal_documents` (requires_acceptance=true, version `2026-07-21`, url = Política de Privacidade).

## Decisões

- **D1 — Storage:** reusar `legal_documents`/`legal_acceptances` (novo `doc_type`) em vez de coluna em
  `profiles`, pra manter uma via única de auditoria versionada (consistente com spec #4 legal-docs).
- **D2 — Grandfather:** sem backfill — usuários existentes não recadastram, logo não são re-perguntados
  (mesma regra L2/L7 do legal-docs). Consentimento vale para cadastros novos.
- **D3 — Alunos:** fora de escopo. O aluno criado por `coach-create-student` não se auto-cadastra; o dado
  entra sob responsabilidade do profissional (papel de controlador, per a política).

## Verificação

- `typecheck` limpo (fora o erro pré-existente de `paywall.ts`, ver STATE.md override).
- `npm test` (vitest) verde, incluindo teste-guarda em `legal.test.ts` de que `consentimento_saude`
  (requires_acceptance=true) flui por `requiredAcceptanceDocs`.
- Migration aplica no `db:push` (Fase 3) — expande o CHECK e faz seed idempotente.
- Verificação manual (UAT): checkbox aparece nos 2 cadastros, botão trava sem ele, aceite grava linha
  em `legal_acceptances` com `doc_type='consentimento_saude'`.
