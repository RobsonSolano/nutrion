# Plano — #5b SDK / compra real (revenuecat-integration)

> Fatia 2 da spec #5. **Execução-ready, mas BLOQUEADA** por setup operacional (Play Console +
> RevenueCat + dev build). Não executar/mergear a dep nativa antes do pipeline de build pronto.
> API do `react-native-purchases` confirmada na doc oficial (2026-06) — bate com `manual-3`.

## Objetivo

Ligar a **compra real**: SDK RevenueCat no app, identificado com `appUserID = profiles.id`,
buscar offerings, transformar a CTA "Quero assinar" do paywall (#2, hoje placeholder "em breve")
numa compra de verdade, e atualizar o entitlement após. O **webhook (#5a)** já reflete a compra em
`subscriptions` → `resolve_entitlement` libera. **Restore** pra reinstalações.

## Pré-requisitos operacionais (do dev — BLOQUEIAM o #5b)

Ver `manual-1` (conta/app), `manual-2` (produtos/Service Account/RTDN/RevenueCat), `manual-4`
(teste/valor/cupom). Checklist:
- [ ] App `br.com.nutrion` na Play + faixa de teste interno.
- [ ] Produtos de assinatura **ativos** + base plans (ex: `nutrion_pro` ~R$ 1,90 p/ teste, `nutrion_premium`).
- [ ] RevenueCat: projeto + app Android + **API key pública** `goog_...`.
- [ ] **⚠️ Entitlements no RevenueCat nomeados `pro` e `premium`** — o `mapEvent.ts` (#5a) decide o
      tier por `entitlement_ids.includes('premium') ? 'premium' : 'pro'`. Os identifiers PRECISAM bater.
- [ ] Offerings configuradas (packages por plano).
- [ ] Webhook do #5a: URL no RevenueCat + `RC_WEBHOOK_SECRET` setado (`supabase secrets`).
- [ ] **Dev build EAS** com `react-native-purchases` + License testers.

## Requisitos

- **[RC5B]-01** — Instalar `react-native-purchases` (`npx expo install`) + novo **dev build EAS**.
  Adicionar o config plugin em `app.config.ts` **se** a versão exigir (confirmar no install).
  - QUANDO o dev build roda ENTÃO o módulo nativo carrega sem crash.

- **[RC5B]-02** — Env `EXPO_PUBLIC_RC_API_KEY_ANDROID` (key `goog_...`).

- **[RC5B]-03** — `src/services/billing.ts`: wrapper **defensivo** do SDK.
  - `initBilling(userId)`, `getOfferings()`, `purchasePackage(pkg)`, `restore()`, `logoutBilling()`.
  - QUANDO `EXPO_PUBLIC_RC_API_KEY_ANDROID` ausente **ou** Expo Go ENTÃO vira **no-op seguro**
    (offerings vazias, `purchase` lança erro amigável) — o app não quebra antes do setup/sem dev build.
  - `configure({ apiKey, appUserID: userId })` uma vez; `logIn(userId)` em trocas.

- **[RC5B]-04** — Init no provider de auth: `initBilling(user.id)` após resolver a sessão;
  `logoutBilling()` no logout. (`appUserID = profiles.id` — o webhook depende disso.)

- **[RC5B]-05** — `src/hooks/useOfferings.ts` (React Query, `staleTime` alto).

- **[RC5B]-06** — Ligar a CTA do paywall (`app/paywall.tsx`) à compra real.
  - QUANDO o usuário toca "Quero assinar" ENTÃO seleciona o package (comum→`pro`;
    professor→`pro`/`premium`) e chama `purchasePackage`.
  - QUANDO a compra conclui ENTÃO invalida `queryKeys.entitlement(userId)` **com retry/delay**
    (o webhook é assíncrono — o entitlement só vira pro depois do upsert) e fecha o paywall ao liberar.
  - QUANDO o usuário cancela a compra ENTÃO volta ao paywall sem erro técnico.
  - Remover o placeholder "em breve" (#2/C1).

- **[RC5B]-07** — Restore: botão "Já assinei / restaurar" (paywall ou perfil) → `restore()` →
  invalida entitlement.

- **[RC5B]-08** — Tratamento de erro de compra (cancelado, pendente, billing indisponível) com
  mensagens amigáveis (reusar `useAlert`).

## Design (resumo)

```
src/services/billing.ts   # wrapper defensivo (configure/offerings/purchase/restore/logOut)
src/hooks/useOfferings.ts # React Query
app/_layout.tsx ou auth provider  # initBilling(user.id) / logoutBilling()
app/paywall.tsx           # CTA real + restore + refresh de entitlement pós-compra
app.config.ts             # plugin react-native-purchases (se a versão exigir)
```
- **Verdade do acesso = `resolve_entitlement`** (já existe), **não** o `customerInfo` (que é só
  feedback imediato e burlável). Pós-compra: `customerInfo` ok → invalida entitlement → poll curto
  até refletir (webhook). Helper de "poll até liberar" (ex: 3 tentativas com backoff).
- Defensivo (Expo Go / sem key): `initBilling`/`getOfferings` no-op → paywall mostra "indisponível
  agora" em vez de quebrar. Permite o app rodar em dev/preview sem o SDK configurado.

## Tasks (quando os pré-requisitos estiverem prontos)

| # | Task | Verify |
|---|------|--------|
| T1 | Instalar SDK + dev build + env (+plugin se preciso) | Build roda; `Purchases` importável |
| T2 | `billing.ts` defensivo | typecheck; no-op em Expo Go |
| T3 | init/logout no auth | log do RevenueCat no login |
| T4 | `useOfferings` | offerings carregam no dev build |
| T5 | CTA do paywall → compra + refresh entitlement + restore | UAT: tester compra (cartão de teste) |
| T6 | Erros de compra | UAT: cancelar, billing off |

> **Lógica pura testável** (vitest): seleção de package por `feature`/`role`, e o "poll até liberar".
> O resto (SDK/UI) é UAT no dev build com License tester.

## Plano de teste (end-to-end, custo zero — `manual-3` §9 / `manual-4`)

1. Dev build na faixa interna + e-mail em License testing.
2. Login → `initBilling(user.id)` (log RevenueCat).
3. Paywall → comprar package → "Test card, always approves".
4. Cadeia: RevenueCat recebe → `revenuecat-webhook` (#5a) faz upsert → `subscriptions` vira
   `pro/premium active` → `resolve_entitlement.ai_personal=true` → IA liberada (sem 402).
5. Cancelar (renovação de teste expira em minutos) → `canceled` → `expired` → `free` (paywall volta).
6. Restore em device limpo.

## Por que não executar agora

`react-native-purchases` é **dep nativa** → sem **dev build + Play Console + RevenueCat**, não roda
nem dá pra validar; e adicionar a dep antes do pipeline de build pronto trava o app em dev. Quando
você concluir os manuais 1–2 (conta + produtos + RevenueCat + key) e tiver o dev build, a gente
executa este plano (confirmo a versão exata da API do SDK no install).
