# Contexto — revenuecat-integration (spec #5 — fatia server-first)

> Última spec da iniciativa. Fatiada (decisão do dev): **#5a server-first agora**
> (webhook + downgrade "escolhe quem fica"); **#5b SDK/compra real depois** (precisa
> Play Console + RevenueCat + dev build). Desenho em `.specs/features/billing/`
> (`manual-3` blueprint, `estrutura_assinatura.md` §3.2/§3.6, `manual-4` config da loja).

## O que já existe (specs #1–#4, em develop)

- `subscriptions` + `resolve_entitlement` (#1): o entitlement já lê `store_play`/`store_apple`/
  `stripe` com `status` e `period_end` (arestas de cancelamento §3.6 já no resolve).
- Paywall (#2): a CTA "Quero assinar" é placeholder ("em breve") — vira compra real na #5b.
- Trial de servidor + `coach-unlink-student` que concede trial ao ex-aluno (#3) — **reusado** pelo downgrade.
- Aceite legal (#4).

## Decisões

| # | Decisão | Razão / efeito |
|---|---------|----------------|
| R1 | **Server-first (#5a) agora; SDK (#5b) depois** | SDK `react-native-purchases` é dep nativa → exige dev build + config da loja/RevenueCat pra validar. Webhook + downgrade são server/UI, testáveis já. |
| R2 | **Webhook autentica por header secreto** | `Authorization: Bearer ${RC_WEBHOOK_SECRET}`; deploy `--no-verify-jwt` (RevenueCat não manda JWT do Supabase). Padrão do `manual-3` passo 7. |
| R3 | **Webhook mapeia evento → `subscriptions` (upsert por `app_user_id`)** | `app_user_id = profiles.id` (a #5b configura o SDK com esse id). Mapa evento→status/tier extraído como função **pura testável**. |
| R4 | **"Escolhe quem fica" dispara só em downgrade real** | Gatilho: professor com `student_count > student_limit` **E `source != 'grandfather'`**. Grandfather acima do limite continua **não-destrutivo** (D5 do #1) — só bloqueia adicionar novos, sem escolha forçada. |
| R5 | **Excedentes desvinculados via `coach-unlink-student`** | Reusa a edge do #3 (cada excedente vira comum + ganha trial). Os alunos que ficam **perdem a IA herdada** automaticamente (resolve_entitlement já trata coach free). |
| R6 | **Comunicado aos alunos que FICAM = follow-up** | Os desvinculados já recebem push `coach_unlinked` (#3). O aviso aos que permanecem (IA herdada cessou) fica como nota/optional pra não inflar o escopo (novo push type). |

## Fora de escopo (#5a)

- **SDK RevenueCat / compra real / offerings / restore / init no app / plugin no app.config** → #5b.
- Cupons/promo codes (config na Play; `manual-4`) → operacional do dev, não muda o webhook.
- Comunicado push aos alunos que permanecem (R6) → follow-up.
- iOS/Apple, Stripe-web → futuro (o webhook já aceita `source` genérico).

## Superfícies (#5a)

- **Edge nova:** `supabase/functions/revenuecat-webhook/`.
- **Lógica pura:** mapa de evento RC → `{tier, status, period_end}` (vitest).
- **Cliente:** detecção de downgrade over-limit (hook/derivado de `useEntitlement` + `useStudents`)
  + tela "escolhe quem fica" + loop de unlink (reusa `coach-unlink-student`).

## Dependências operacionais (do dev, p/ #5b — ver manual-4)

Publicação não exigida pra testar; License testers compram sem cobrança; valor mínimo ~R$1,90;
cupom = trial/desconto. Conta/produtos/Service Account/RTDN/RevenueCat = manuais 1–2.
