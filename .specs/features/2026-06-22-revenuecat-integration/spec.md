# Spec — revenuecat-integration (fatia #5a server-first)

> Última spec da iniciativa, fatiada: **#5a (esta)** = webhook + downgrade "escolhe quem fica".
> **#5b** (SDK/compra real) fica pra quando houver Play Console + RevenueCat + dev build.
>
> Status: **especificação** · Branch: a criar (`feature/billing-revenuecat-webhook`)
> · Escopo: **Large** · Idioma: PT-BR. Decisões em `context.md` (R1–R6).

## Objetivo

Fechar o laço servidor da assinatura: o **webhook** do RevenueCat escreve a verdade da loja em
`subscriptions` (que o `resolve_entitlement` já lê), e o app resolve o **downgrade do professor**
(cancelou/expirou e ficou acima do limite free) com a tela "escolhe quem fica".

## Fora de escopo (#5a)

- SDK `react-native-purchases`, compra real, offerings, restore, init no app, plugin no config (#5b).
- Cupons (config operacional na Play; `manual-4`).
- Comunicado push aos alunos que **permanecem** (IA herdada cessou) — follow-up (R6).
- iOS/Apple/Stripe (o `source` já é genérico).

## Requisitos

### Webhook

- **[RC]-01** — Edge `revenuecat-webhook`: autentica por header secreto e faz upsert em
  `subscriptions` a partir do evento. Deploy `--no-verify-jwt`.
  - QUANDO o header `Authorization` ≠ `Bearer <RC_WEBHOOK_SECRET>` ENTÃO responde `401` sem tocar dados.
  - QUANDO chega um evento válido ENTÃO faz `upsert` em `subscriptions` por `user_id`
    (= `event.app_user_id`) com `source='store_play'`, `tier`, `status` e `period_end` derivados.
  - QUANDO o `app_user_id` não corresponde a um profile ENTÃO responde `200` (ack) sem quebrar
    (evento ignorado; RevenueCat não re-tenta indefinidamente por erro nosso).

- **[RC]-02** — Mapa de evento → estado (função **pura, testável**).
  - QUANDO `type ∈ {INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, UNCANCELLATION}` ENTÃO
    `status='active'` (ou `in_trial` se o evento indica período de teste da loja) e `tier` pela entitlement.
  - QUANDO `type=CANCELLATION` ENTÃO `status='canceled'` (acesso mantido até `period_end`).
  - QUANDO `type=EXPIRATION` ENTÃO `status='expired'` e `tier='free'`.
  - QUANDO `type=BILLING_ISSUE` ENTÃO mantém ativo até `period_end` (grace), sem derrubar na hora.
  - `tier`: `premium` se o entitlement/produto for premium; senão `pro`; `free` em expiração.
  - `period_end` = `expiration_at_ms` do evento (quando houver).

### Downgrade "escolhe quem fica" (o adiado do #3)

- **[RC]-03** — Detecção: o app identifica o professor que precisa resolver downgrade.
  - QUANDO `role='professor'`, `student_limit` não-nulo, `student_count > student_limit` **e**
    `source != 'grandfather'` ENTÃO o estado "precisa escolher quem fica" é verdadeiro.
  - QUANDO `source='grandfather'` (acima do limite) ENTÃO **não** força escolha (D5 não-destrutivo).
  - QUANDO `student_count <= student_limit` ENTÃO nada a resolver.

- **[RC]-04** — Tela "escolhe quem fica": o professor seleciona até `student_limit` alunos pra manter;
  os demais são desvinculados.
  - QUANDO o professor confirma com `≤ student_limit` selecionados ENTÃO cada **não-selecionado**
    passa por `coach-unlink-student` (vira comum + ganha trial, via #3).
  - QUANDO tenta confirmar com mais que o limite ENTÃO o botão fica bloqueado.
  - QUANDO todos os excedentes foram desvinculados ENTÃO `student_count <= student_limit` e o
    estado de [RC]-03 deixa de ser verdadeiro (resolvido).
  - QUANDO um unlink falha ENTÃO informa e permite re-tentar (não deixa estado meio-resolvido silencioso).

## Restrições de implementação

- Webhook segue o padrão Deno das edges (`Deno.serve`, service_role p/ upsert, CORS/JSON helper).
- Não alterar `resolve_entitlement` nem `subscriptions` (schema #1). Só **escrever** via service_role.
- `coach-unlink-student` é reusada (não reimplementar unlink).
- Mapa de evento puro em módulo testável (sem Deno) — vitest no app OU teste Deno; preferir extrair
  a lógica pura pra `src/lib` reaproveitável + testar com vitest.
- A tela reusa `useStudents`, `useEntitlement`, componentes `ui`. Sem deps novas.
- Segredo `RC_WEBHOOK_SECRET` via `supabase secrets` (não commitar).

## Rastreabilidade

| ID | Descrição | Status |
|----|-----------|--------|
| [RC]-01 | Edge `revenuecat-webhook` (auth + upsert) | Implemented (typecheck; runtime no UAT por simulação curl) |
| [RC]-02 | Mapa evento → estado (puro) | Verified (10 testes vitest) |
| [RC]-03 | Detecção de downgrade over-limit | Verified (`needsStudentChoice` 5 testes) / hook Implemented |
| [RC]-04 | Tela "escolhe quem fica" + unlink | Implemented (typecheck; UAT manual) |

> **Validado (evidência fresca, 2026-06-22):** `mapEvent` 10 testes + `downgrade` 5 testes
> (suíte 41/41); typecheck verde; lint sem issue novo. **Pendente (UAT):** runtime do webhook
> (simular evento via curl com o header secreto → upsert em `subscriptions`) e da tela de downgrade
> (professor com >limite + sub expirada). **#5b** (SDK/compra real) liga a CTA do paywall e o
> `appUserID`; até lá o webhook é validado por simulação.

## Nota de deploy / #5b

`fn:deploy` da `revenuecat-webhook` (`--no-verify-jwt`) + `supabase secrets set RC_WEBHOOK_SECRET`.
A URL do webhook é configurada no RevenueCat (operacional, manual-2). **#5b** (SDK/compra) liga a
CTA do paywall à compra real e configura `appUserID = profiles.id` — só então o webhook recebe
eventos reais. Até lá, testável por **simulação de evento** (curl com o header secreto).
