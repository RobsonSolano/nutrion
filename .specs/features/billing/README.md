# Billing & Assinaturas — visão geral

> Status: **planejamento aprovado** (brainstorming 2026-06-02). Implementação ainda
> não iniciada. Esta pasta reúne o desenho aprovado + os manuais passo a passo.

## O que é

Monetização do NutriOn via **assinatura recorrente mensal** para usuário comum e
professor, usando **billing das lojas** (Google Play agora, Apple depois) com
**RevenueCat** como camada unificadora e **Supabase como fonte de verdade** do
*entitlement* ("o que esse usuário pode fazer agora?").

O `PROJECT.md` listava `premium/pagamento` como fora de escopo — esta iniciativa
abre esse escopo. A migration `20260425120000_ai_quotas.sql` já deixou a fundação:
`profiles.user_number`, `profiles.is_early_adopter` (100 primeiros = grátis pra
sempre quando IA virar premium) e `ai_usage_log`.

## Planos (definições aprovadas — prevalecem sobre rascunhos antigos)

| Quem | Plano | Preço/mês | Libera |
|------|-------|-----------|--------|
| Comum | Free | R$0 | Tudo, **exceto** Chat IA e Sanity Check (mostra "seja Pro") |
| Comum | Pro | R$19,90 | Chat IA + Sanity Check |
| Professor | Free | R$0 | Até **5** alunos · **sem** IA de coach (gerar treino com IA) · alunos **sem** IA |
| Professor | Pro | R$19,90 | Até **20** alunos · IA de coach · alunos com Chat+Sanity |
| Professor | Premium | R$39,90 | Alunos **ilimitados** + tudo do Pro |

- **Trial de 7 dias**: todo **comum novo**, todo **ex-aluno desvinculado**, e
  professor nos planos pagos. 1 trial de servidor por vida (`trial_consumed`).
- **Aluno não paga**: a IA do aluno é **herdada do plano do professor**
  (coach Pro/Premium → aluno tem Chat+Sanity; coach Free → aluno sem IA).
- **Gating de IA pro comum free**: só **Chat IA** e **Sanity Check**. Onboarding
  com IA e push contextual continuam **grátis** (preserva ativação dos 60s).
- **"IA do professor"** = `coach-generate-plan` e `coach-import-workout-ai`
  (gerar/importar treino com IA ao cadastrar/editar aluno).

## Modelo de entitlement (fonte de verdade no Supabase)

```
subscriptions (user_id PK → profiles.id)
  tier            free | pro | premium          -- premium só pra professor
  source          store_play | store_apple | stripe | server_trial | grandfather
  status          active | in_trial | canceled | expired
  trial_end       timestamptz   -- só pra source = server_trial
  period_end      timestamptz   -- vem da loja via RevenueCat
  rc_app_user_id  text          -- id no RevenueCat (= profiles.id)
  trial_consumed  boolean       -- anti-abuso: 1 trial de servidor por vida
```

Função `resolve_entitlement(user)` decide:

| Role | IA pessoal (chat+sanity) | IA de coach (gerar treino) | Limite de alunos |
|------|--------------------------|----------------------------|------------------|
| `comum` | `pro` OU trial ativo OU grandfather | — | — |
| `aluno` | **herdado do coach** | — | — |
| `professor` | tier (pro/premium) OU grandfather | `pro`/`premium` | free=5 · pro=20 · premium=∞ |

## Onde o gating acontece (dupla camada)

1. **Servidor (autoritativo)**: cada edge function de IA (`chat-ai`, sanity check,
   `coach-generate-plan`, `coach-import-workout-ai`) chama `resolve_entitlement`
   **antes** de gastar token. Sem direito → `402 needs_upgrade`.
2. **UI (experiência)**: app lê o entitlement e troca o botão de IA pelo
   "✨ seja Pro". É o "aviso de seja premium".

## Fluxos especiais

- **Trial de servidor**: grava `source=server_trial`, `trial_end=now+7d`,
  `trial_consumed=true`. Expira → vira `free`. Não passa por loja nem RevenueCat.
- **Ex-aluno desvinculado**: `coach-unlink-student` (já existe) passa a também
  conceder o trial e disparar o comunicado "sua conta virou individual + ganhou
  7 dias".
- **Downgrade do professor com excedente**: tela "escolha quem fica" (até o novo
  limite); não-escolhidos passam pelo `coach-unlink-student` → cada um vira comum
  com trial.

## RevenueCat ↔ Supabase (uma porta só)

```
App (RevenueCat SDK) → compra na Play/Apple
RevenueCat ─webhook→ edge function `revenuecat-webhook` → upsert em subscriptions
Trial de servidor → edge grava source=server_trial direto (sem loja)
```

Gating escrito **uma vez**. Android hoje, Apple depois, Stripe-web no futuro:
todos viram só linhas em `subscriptions`. Zero refator.

## Nomes / recebedor (decisão registrada)

- **Fatura do cliente**: aparece "Google Play" / "APPLE.COM/BILL" — **nunca** o
  nome pessoal (loja é o *merchant of record*).
- **Vendedor público na loja**:
  - **Google Play**: conta individual pode exibir nome de marca ("NutriOn").
  - **Apple App Store**: conta **individual exibe nome legal pessoal**. Pra ocultar
    e usar nome de empresa → conta **Organization** (exige D-U-N-S ≈ CNPJ).
- **Decisão**: começa PF/Android com a marca. CNPJ vira pré-requisito só quando
  for pra App Store sem expor o nome pessoal — sem refatorar código, só conta de
  loja. (Até lá, exibir o nome pessoal como dev na Apple também é aceitável.)

## Decomposição (ordem de implementação)

Cada item é uma spec/ciclo próprio (spec → seed → commits → db:push → fn:deploy →
eas preview → merge → docs). Só **um** depende da Play Console:

| # | Spec | Depende da Play Console? |
|---|------|--------------------------|
| 1 | `billing-core` — `subscriptions` + `resolve_entitlement` + gating server-side + grandfather | ❌ Não |
| 2 | `paywall-ui` — leitura de entitlement + telas "seja Pro" + matriz de planos | ❌ Não |
| 3 | `trial-e-migracao` — trial de servidor + fluxo ex-aluno + downgrade "escolhe quem fica" | ❌ Não (trial não passa pela loja) |
| 4 | `legal-docs` — aceite + versionamento no cadastro | ❌ Não |
| 5 | `revenuecat-integration` — SDK + webhook + compra real | ✅ Sim (teste interno basta) |

## Manuais passo a passo

1. [`manual-1-conta-play-console.md`](./manual-1-conta-play-console.md) — criar e verificar a conta de desenvolvedor.
2. [`manual-2-billing-play-store.md`](./manual-2-billing-play-store.md) — produtos, Service Account, RTDN, RevenueCat.
3. [`manual-3-implementacao-assinatura-app.md`](./manual-3-implementacao-assinatura-app.md) — SDK no app, webhook, gating.

## Pendências (fora de código)

- **Conteúdo jurídico** dos termos/contrato/cancelamento (validar com advogado).
  A infra (`legal_documents` + `legal_acceptances`) entra na spec `legal-docs`;
  o texto fica como placeholder.
- **Burocracia fiscal** do recebimento (PF agora, MEI/CNPJ quando escalar / for Apple).
