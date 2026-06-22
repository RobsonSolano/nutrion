# Manual 4 — Testar assinatura, valor mínimo e cupom (Play)

> Responde direto às 3 dúvidas do dev e dá o roteiro pra **testar uma assinatura real
> gastando pouco/nada**. Complementa os manuais 1–3 (conta, billing/RevenueCat, app).
> Pesquisado em 2026-06 (Play muda com frequência — confirmar no console na hora).

---

## TL;DR (respostas diretas)

1. **Precisa publicar na Play pra assinar?** **Não pra testar.** App em **faixa de teste
   interno** + **License testers** já compram assinatura **sem cobrança real**. Publicar em
   **produção** (com o 12 testers/14 dias da conta pessoal nova) só é exigido pra liberar ao
   **público**, não pra você validar o fluxo.
2. **Valor mínimo na Play (BRL)?** Não existe mais "tabela de tiers" (Google removeu os
   *Pricing Templates* em **27/out/2025**) — preço é **livre por produto/país**. O **piso prático
   é ~R$ 1,00** (mínimo de processamento). O próprio console **recusa** abaixo do permitido ao
   digitar o preço. Use ~**R$ 1,90** (ou o menor que o console aceitar) pro produto de teste.
3. **Cupom pra "assinar no valor mínimo"?** Atenção à semântica: cupom de **assinatura** na Play
   dá **teste grátis** ou **desconto** — **não** "pagar um valor arbitrário". Pra validar
   gastando pouco, veja as 2 opções abaixo (license tester = grátis; ou base plan barato + compra real).

---

## 1. Precisa publicar pra assinar? (detalhe)

| Cenário | Precisa produção? | Como |
|---|---|---|
| **Testar a integração** (você/QA) | ❌ Não | App na faixa **internal testing** + **License testing** (Play Console → Settings → License testing). Testers licenciados compram com **cartões de teste** (`Test instrument, always approves`) — **sem dinheiro real**. |
| **Cobrança real de cliente** | ✅ Sim (produção) | Conta **pessoal nova**: exige **12 testers / 14 dias** em teste fechado antes de liberar produção (começar cedo — Manual 1). |

**Pré-requisitos pra compra (mesmo em teste):**
- Produtos de **assinatura criados e ATIVOS** no console (base plan publicado).
- App **assinado** subido numa faixa (internal serve), com o mesmo `applicationId` (`br.com.nutrion`).
- **RevenueCat** ligado (Manual 2): Service Account + RTDN/Pub-Sub + entitlements.
- ⚠️ **Spend limits:** apps em rascunho/teste interno têm limite de gasto. Pra testar valores
  maiores, suba pra faixa fechada/aberta/produção.

> RevenueCat exige **dev build** (não roda no Expo Go) — Manual 3 / `eas build`.

## 2. Valor mínimo (BRL) — como definir

- Sem tier ladder: digita o preço em BRL direto no base plan. O console valida o mínimo.
- **Piso prático ~R$ 1,00** (mínimo de processamento; e-wallet mínimo R$ 1,00).
- **Recomendado pro teste:** criar um base plan de **R$ 1,90** (id de produto `nutrion_*`, padrão
  do Manual 2) — barato o suficiente pra um teste de cobrança real ser irrisório.

## 3. Cupom (o que dá e o que não dá)

| Tipo | Onde | O que faz | Limite |
|---|---|---|---|
| **Promo code one-time** | Monetize → Promo codes | Para assinatura = **teste grátis** (não desconto arbitrário) | 10.000/trimestre por produto |
| **Custom code** (multi-uso) | Monetize → Promo codes | Só assinaturas, só quem **nunca assinou** = teste grátis | configurável |
| **Offer / oferta promocional** | No **base plan** (via RevenueCat) | **Desconto** sobre o preço | — |

**Importante:** cupom **não** faz a assinatura custar um "valor mínimo arbitrário". Ele dá **trial
grátis** ou **% de desconto**. Então, pro seu objetivo:

### Como testar uma assinatura "barata/sem custo" — 2 opções

- **Opção A — License tester (recomendada, custo ZERO).** Adiciona seu e-mail em License testing →
  instala da faixa interna → assina com **cartão de teste** → **nada é cobrado**. Valida
  **webhook → `subscriptions` → `resolve_entitlement` → app libera IA** de ponta a ponta. É o
  caminho certo pra testar a #5.
- **Opção B — Compra real barata.** Cria base plan de **R$ 1,90**, assina com **conta real** (não
  tester) → cobrança real de R$ 1,90 → valida cobrança/repasse/impostos. Depois **cancela pela
  loja** (acesso até o fim do ciclo) e, se quiser, pede reembolso. Um **promo code** aqui daria
  *trial grátis* (não cobraria) — então, pra testar **cobrança real**, compre **sem** cupom.

> Resumindo: cupom é pra **trial/desconto a clientes**; pra **testar o sistema**, License tester
> (grátis) é o caminho. Se o objetivo é ver dinheiro entrando de fato, base plan mínimo + compra real.

---

## 4. Checklist de configuração (ordem) — aponta pros manuais

1. **Conta & app** (Manual 1): conta de dev verificada, perfil de pagamentos, app `br.com.nutrion`.
2. **Produtos & billing** (Manual 2): base plan de assinatura (`nutrion_pro` etc.), Service Account,
   RTDN/Pub-Sub, RevenueCat (entitlements = `ai_personal`/`ai_coach`), testers.
3. **App** (Manual 3 + spec #5): SDK `react-native-purchases`, dev build (EAS), edge
   `revenuecat-webhook` → upsert em `subscriptions`.
4. **License testing**: adicionar seu e-mail (compra de teste sem cobrança).
5. **Já pronto no backend** (specs #1–#3): `subscriptions` + `resolve_entitlement` (#1), paywall +
   tratamento do 402 (#2), trial de servidor (#3). O webhook da #5 só **escreve** em `subscriptions`;
   o entitlement já está resolvido.

## 5. Roteiro de teste (end-to-end, custo zero)

1. Subir dev build com RevenueCat na faixa **internal testing**.
2. Adicionar e-mail em **License testing**.
3. Abrir o app logado como esse usuário → tocar no upsell (paywall #2) → **Assinar**.
4. Completar a compra com **cartão de teste** (sem cobrança).
5. Conferir: RevenueCat recebeu o evento → webhook gravou `subscriptions(tier=pro, source=store_play)`
   → `resolve_entitlement` retorna `ai_personal=true` → **chat/sanity liberados** (sem 402).
6. **Cancelar** pelo Play → `status=canceled` (acesso até `period_end`) → após o ciclo, `expired` →
   volta a `free` (paywall reaparece). Valida a aresta §3.6.

---

## Fontes (2026-06)

- [Test in-app billing with application licensing — Play Console Help](https://support.google.com/googleplay/android-developer/answer/6062777)
- [Test your Google Play Billing Library integration — Android Developers](https://developer.android.com/google/play/billing/test)
- [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Promo codes — Play Billing](https://developer.android.com/google/play/billing/promo)
- [Create promotions — Play Console Help](https://support.google.com/googleplay/android-developer/answer/6321495)
- [Google Play IAP pricing by country](https://pricepush.app/blog/google-play-iap-pricing-by-country)
- [Google Play offers — RevenueCat](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/google-play-offers)
