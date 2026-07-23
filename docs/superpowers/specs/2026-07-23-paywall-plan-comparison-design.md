# Paywall com comparação de planos (Pro + Premium) — professor

**Data:** 2026-07-23
**Autor:** Robson Solano (com Claude)
**Status:** Design aprovado — pendente review do spec

---

## Problema

A paywall (`app/paywall.tsx`) escolhe **um** produto via `selectProductId({role, feature, currentTier})` e mostra um único botão "Quero assinar". Consequência: um **professor free** que toca em "fazer upgrade" só vê o **Pro** — nunca conhece o **Premium**, perdendo a chance de já assinar o plano maior. Além disso, o caminho **pro→premium** hoje chama `purchasePackage(pkg)` **sem** substituição/proração → na Google Play isso criaria uma **segunda assinatura** (cobrança dupla), em vez de trocar de plano.

**Objetivo:** professor **free** vê **Pro e Premium** lado a lado (comparação, preços reais) e assina qualquer um; professor **pro** vê só **Premium**; e o pro→premium vira uma **troca de plano com proração** (sem cobrança dupla).

## Decisões de produto (travadas)

1. **Escopo:** só **upgrade**, e só **professor** (usuário comum só tem Pro; aluno não compra). Downgrade (Pro→free, Premium→Pro) fica para uma fase futura.
2. **Planos por tier (professor):** free → mostra **[Pro, Premium]**; pro → mostra **[Premium]**; premium → nada (topo).
3. **pro→premium = in-app com proração** (opção (a)): melhor UX, fica no app. Usa a API de product-change do RevenueCat.
4. **Preços reais** vêm do package do RevenueCat (`product.priceString`), não do `priceHint` placeholder.

## Restrição dura

**OTA-only, zero dependência nativa nova.** `react-native-purchases@10.4.4` já está no build e o módulo nativo já aceita os parâmetros de product-change (`purchasePackage(aPackage, upgradeInfo?, productChangeInfo?, googleIsPersonalizedPrice?)`). Logo, tudo é JS → entrega via `eas update` (runtime 1.3.0). Comum/aluno inalterados.

---

## Arquitetura

### 1. Seleção de planos (puro, testável) — `src/lib/purchaseSelection.ts`

Nova função, ao lado da `selectProductId` existente (que continua servindo o fluxo contextual do 402):

```ts
export type Plan = { tier: 'pro' | 'premium'; productId: ProductId };

export function availablePlans(p: { role: Role | null | undefined; currentTier: Tier }): Plan[]
```

Regras:
- `professor` + `free` → `[{pro, nutrion_prof_pro}, {premium, nutrion_prof_premium}]`
- `professor` + `pro` → `[{premium, nutrion_prof_premium}]`
- `professor` + `premium` → `[]`
- `comum` + `free` → `[{pro, nutrion_comum_pro}]`
- `comum` + `pro` → `[]`
- `aluno` (qualquer) → `[]`

### 2. Conteúdo por plano (puro) — `src/lib/paywallContent.ts`

Novo mapa por tier com nome + bullets (o `priceHint` some do card; preço real vem do package):

```ts
export type PlanContent = { name: string; highlight?: boolean; bullets: string[] };
export function planContent(tier: 'pro' | 'premium', role: Role): PlanContent
```

Conteúdo (professor):
- **Pro:** "Até 5 alunos", "IA de professor: gerar plano completo", "IA de professor: importar treino por texto/foto".
- **Premium (highlight):** "Alunos ilimitados", "Tudo do Pro incluído", "IA de professor completa". `highlight: true`.
- **Comum Pro:** "Chat IA ilimitado", "Sanity check por foto", "Respostas no seu perfil". (reaproveita os bullets pessoais existentes.)

> O `paywallContent(feature)` atual (header contextual do 402) **permanece** — é o título/subtítulo do topo da tela. O `planContent` é só o corpo dos cards.

### 3. UI — `app/paywall.tsx`

- Mantém o header contextual (`paywallContent(feature)` → title/subtitle).
- Abaixo, renderiza **um Card por plano** de `availablePlans(...)` (empilhados; Premium com selo "Recomendado" e destaque `accent="violet" glow`). Cada card: nome, bullets, **preço real** (`findPackage(offerings, plan.productId)?.product.priceString`, com fallback discreto se ausente), e botão **"Assinar {nome}"**.
- Estado `busy` por card (o card em compra mostra loading; os outros ficam desabilitados).
- Aluno: mantém o card informativo "acesso pelo seu professor". Comum free: mostra só o card Pro (mesma UI, lista de 1).
- Se `availablePlans` vier vazio (ex.: premium): mensagem "Seu plano atual já é o mais completo" + fechar.

### 4. Compra com proração — `src/services/billing.ts` + paywall

`purchasePackage` ganha um parâmetro opcional de troca de plano:

```ts
export async function getActiveProductId(): Promise<string | null> {
  if (!isBillingAvailable) return null;
  const info = await load().getCustomerInfo();
  return info.activeSubscriptions?.[0] ?? null;
}

export async function purchasePackage(
  pkg: PurchasesPackage,
  opts?: { oldProductId?: string | null },
): Promise<CustomerInfo> {
  if (!isBillingAvailable) throw new BillingUnavailableError();
  const Purchases = load();
  if (opts?.oldProductId) {
    const { customerInfo } = await Purchases.purchasePackage(pkg, null, {
      oldProductIdentifier: opts.oldProductId,
      prorationMode: Purchases.PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE,
    });
    return customerInfo;
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}
```

No paywall, ao assinar um plano:
- `free` → compra normal (sem `oldProductId`).
- `pro` → premium: busca `getActiveProductId()` e passa como `oldProductId` → a Play **substitui** o Pro pelo Premium com proração imediata (cobra a diferença), sem 2ª assinatura.

Pós-compra: reusa o `refreshEntitlement` já existente (que também chama `syncMyCoachAccess` + invalida `['students']`, do fix anterior).

## Tratamento de erros

- `getActiveProductId` best-effort: se falhar/for null num pro→premium, cai na compra normal (log; o webhook e a verdade do servidor corrigem o tier). Melhor não travar a compra.
- Cancelamento do usuário: já tratado (`isUserCancelledError`).
- `findPackage` null (offering não carregou): botão do card desabilitado + aviso "planos indisponíveis" (como hoje).

## Testes

- **vitest (puro):** `availablePlans` (todas as combinações role×tier); `planContent` (retorna bullets certos por tier/role). Mock de `findPackage` já testado.
- **Manual/E2E (device):** professor free → vê 2 cards → assina Premium (fresh) → vira premium. Professor pro → vê 1 card Premium → assina → **troca de plano com proração** (conferir na Play que NÃO há 2 assinaturas). Comum free → só Pro (inalterado). Aluno → card informativo.

## Fora de escopo (YAGNI)

- Downgrade (Pro→free cancelando na Play; Premium→Pro troca de plano) — fase futura.
- Premium para usuário comum (não existe produto).
- Mudar o header contextual do 402.

## Sequenciamento

Spec único. Ordem: (1) `availablePlans` + testes → (2) `planContent` + testes → (3) `billing.purchasePackage`/`getActiveProductId` → (4) UI da paywall (cards) → (5) verificação + OTA. Entrega via `eas update` (sem novo build).
