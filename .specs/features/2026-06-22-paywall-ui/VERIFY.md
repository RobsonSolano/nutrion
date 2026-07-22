# Como verificar o paywall-ui

Lógica pura já validada por mim (vitest 19/19 + typecheck). Abaixo, o **UAT manual** das
superfícies — precisa rodar o app com usuários de tier diferente. Use um **BD/projeto de teste**.

## 0. Pré-requisito (gating server-side)

O paywall só dispara se o servidor devolver `402 needs_upgrade`. Isso exige a migration +
edge functions do **billing-core (#1)** aplicadas no ambiente de teste:
```bash
npm run db:push      # subscriptions + resolve_entitlement + backfill grandfather
npm run fn:deploy    # edge functions com o gating 402
```
(Em prod, isso vai junto do build deste paywall — ver billing-core VERIFY.md §4 / CONCERN no STATE.)

## 1. Testes de lógica (rápido, sem app)
```bash
npm test     # vitest: needsUpgrade, paywall, paywallContent, studentLimit → 19/19
```

## 2. UAT por superfície

Crie/use usuários sem o direito (novo comum/professor pós-deploy, **sem** grandfather) e com o
direito (grandfather, ou linha `subscriptions` tier=pro/premium via service_role no BD de teste).

| Superfície | Sem direito (free) | Com direito |
|---|---|---|
| **Chat IA** (`(tabs)/chat`) | input vira card "Chat IA é Pro" → toca → paywall `feature=chat` | chat normal |
| **Sanity check** (`sanity-check`) | banner Pro + tocar "Analisar" → paywall `sanity_check` | analisa normal |
| **Gerar plano IA** (`(coach)/aluno-novo`) | prof sem `ai_coach`: banner → paywall `coach_generate_plan`; cria aluno só se sob o limite | gera plano normal |
| **Import treino IA** (`(coach)/import-workout`) | banner → paywall `coach_import_workout` | importa normal |
| **Limite de alunos** (`(coach)/aluno-novo`) | nº alunos ≥ `student_limit`: banner "Limite atingido" → paywall `student_limit` | premium (limit=null) nunca bloqueia |

**Rede de segurança (reativo):** force o 402 sem o gating proativo (ex: entitlement em cache
desatualizado) e confirme que cai no paywall em vez de erro técnico cru.

## 3. Arestas
- **Aluno** (`role='aluno'`) com coach free: ao bater num bloqueio, o paywall abre **sem** CTA
  "Assinar", com a copy "fale com seu professor" (C4).
- **CTA "Quero assinar"** (comum/professor): mostra alerta "Em breve" — **não** há fluxo de
  compra no #2 (é a #5).
- **Load do entitlement:** durante o carregamento, os CTAs aparecem normais (sem flash de
  cadeado) — C6.

## 4. Caminho para a PROD
Junto do billing-core (deploy conjunto destrava o CONCERN): `npm run db:push` + `npm run fn:deploy`
+ build/OTA do app com este paywall. Nunca `supabase db reset --linked`.
