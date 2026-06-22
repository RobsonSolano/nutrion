# Contexto — legal-docs (spec #4 da iniciativa de billing)

> Infra de aceite de documentos legais no cadastro. Desenho aprovado em
> `.specs/features/billing/estrutura_assinatura.md` §7, §7.0–7.3, §8.

## O que o app precisa (e o que NÃO é deste repo)

- **Neste repo (app):** tabelas `legal_documents` + `legal_acceptances`, **aceite inline no
  cadastro** linkando pras URLs do hotsite, e a **URL de privacidade** no `app.config.ts`.
- **Fora do repo (separado):** as **3 páginas públicas** do hotsite (Privacidade/Uso/Contrato)
  com URLs estáveis + o **conteúdo jurídico** (precisa de advogado — §7 é só checklist). Não há
  hotsite neste repositório.

## Decisões (discovery 2026-06-22)

| # | Decisão | Razão / efeito |
|---|---------|----------------|
| L1 | **Só a infra no app** | Não escrevo texto jurídico (advogado). URLs ficam como placeholders configuráveis. |
| L2 | **Só novos cadastros** | Existentes seguem grandfathered. **Sem backfill nem gate** — usuários existentes nunca mais passam por uma tela de cadastro, logo nunca são re-perguntados (grandfather por ausência). |
| L3 | **URLs/versões em `legal_documents` (DB)** | Atualizável sem release. O cadastro lê do banco. Fonte única; flexível pra quando o hotsite existir. |
| L4 | **Aceite inline nas telas de cadastro** (correção do dev) | Checkbox no cadastro de **usuário normal** (`login.tsx` modo signup) e de **professor** (`signup-professor.tsx`). NÃO usar gate pós-login. |
| L5 | **Checkbox também trava "Continuar com Google"** (dev) | Cobre o cadastro via Google (que não tem formulário). Usuário existente que entra com Google também marca uma vez (atrito mínimo, juridicamente seguro). Login por **email** (modo login) NÃO é travado. |
| L6 | **`recordLegalAcceptance` idempotente** | Insert `on conflict do nothing` (unique `user_id,doc_type,version`). Chamado após signUp (email/professor) e após Google sign-in. Pra Google existente, vira no-op/dup-safe. |
| L7 | **Aceite por TIPO (não por versão) no MVP** | Grava a versão aceita, mas o MVP não força re-aceite quando a versão muda (re-aceite por versão = futuro, alinhado a L2). |

## Modelo de dados

```
legal_documents (doc_type text pk: 'privacidade'|'termos_uso'|'termos_contrato')
  version            text not null          -- ex: '2026-06-22'
  url                text not null          -- URL pública do hotsite (placeholder até existir)
  title              text not null
  requires_acceptance boolean not null      -- uso/contrato=true; privacidade=false (disclosure)
  updated_at         timestamptz

legal_acceptances (user_id uuid, doc_type text, version text)  -- pk composta
  accepted_at        timestamptz default now()
  -- RLS: dono lê/insere o próprio (auth.uid()=user_id). Sem update/delete pelo client.
```

- **Privacidade:** `requires_acceptance=false` — linkada/divulgada no cadastro (exigência da loja),
  mas o checkbox de aceite é "Termos de Uso + Termos de Contrato" (§7.0).
- Seed inicial: 3 linhas com URLs **placeholder** (TODO: trocar pelas URLs reais do hotsite).

## Fluxo de aceite

1. Tela de cadastro (email normal / professor) e botão Google mostram checkbox "Li e aceito os
   **Termos de Uso** e o **Termos de Contrato**", cada termo com **link** pra URL do hotsite
   (lida de `legal_documents`). Privacidade aparece como link de divulgação.
2. Ação de criar conta / continuar com Google fica **bloqueada** até marcar.
3. Após sucesso (autenticado), `recordLegalAcceptance` grava 1 linha por doc `requires_acceptance`
   (versão atual). Idempotente.

## Fora de escopo (#4)

- Conteúdo jurídico dos documentos + hospedagem do hotsite (separado; advogado).
- Re-aceite forçado por mudança de versão (futuro).
- URL pública de exclusão de conta (exigência Google relacionada, mas fora das 3 páginas — §7.0;
  tratar na publicação/#5).
- Aceite de **contrato no momento da compra** (a compra é #5; aqui o contrato é aceito no cadastro
  conforme §7.0).

## Superfícies tocadas

- **Migration nova:** `legal_documents` + `legal_acceptances` (+ RLS + seed).
- **Cliente:** `src/services/legal.ts` + `src/hooks/useLegalDocs.ts`; `app/(auth)/login.tsx`
  (checkbox + trava signup/Google) e `app/(auth)/signup-professor.tsx` (checkbox).
- **Config:** `app.config.ts` (URL de privacidade placeholder).
- Componente de checkbox reutilizável se não houver (verificar `src/components/ui`).
