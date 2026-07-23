# Paywall com comparação Pro + Premium — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Professor free vê Pro e Premium lado a lado (comparação, preços reais) e assina qualquer um; professor pro vê só Premium; pro→premium vira troca de plano com proração (sem cobrança dupla).

**Architecture:** Duas funções puras novas (`availablePlans`, `planContent`) decidem o que exibir; `app/paywall.tsx` renderiza um card por plano com preço real do RevenueCat; `services/billing.ts` ganha product-change/proração pra pro→premium.

**Tech Stack:** Expo/React Native (expo-router, nativewind), `react-native-purchases@10.4.4`, @tanstack/react-query, vitest.

## Global Constraints

- **OTA-only, zero dependência nativa nova.** `react-native-purchases@10.4.4` já está no build e o nativo já aceita product-change. Entrega via `eas update` (runtime **1.3.0**). Não bumpar nativo.
- **Escopo:** só **upgrade**, só **professor** (comum tem só Pro; aluno não compra). Downgrade fora de escopo.
- **Product IDs (imutáveis):** `nutrion_comum_pro`, `nutrion_prof_pro`, `nutrion_prof_premium`.
- **Preço real** vem do package do RevenueCat (`pkg.product.priceString`), nunca de placeholder.
- **Proração pro→premium:** `PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE`.
- Commits terminam com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Node via nvm: prefixar comandos com `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH"`.
- Typecheck tem **1 erro pré-existente** `src/lib/paywall.ts(6,17)` (`/paywall` route) — NÃO é desta feature; bar = "sem erros NOVOS".

---

### Task 1: `availablePlans` (seleção de planos por tier) + testes

**Files:**
- Modify: `src/lib/purchaseSelection.ts` (adicionar tipo `Plan` + função `availablePlans`)
- Test: `src/lib/purchaseSelection.test.ts` (adicionar describe)

**Interfaces:**
- Produces: `type Plan = { tier: 'pro' | 'premium'; productId: ProductId }`; `availablePlans({ role, currentTier }): Plan[]`.

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao fim de `src/lib/purchaseSelection.test.ts`:

```ts
import { availablePlans } from './purchaseSelection';

describe('availablePlans', () => {
  it('professor free → Pro e Premium, nessa ordem', () => {
    expect(availablePlans({ role: 'professor', currentTier: 'free' })).toEqual([
      { tier: 'pro', productId: 'nutrion_prof_pro' },
      { tier: 'premium', productId: 'nutrion_prof_premium' },
    ]);
  });
  it('professor pro → só Premium', () => {
    expect(availablePlans({ role: 'professor', currentTier: 'pro' })).toEqual([
      { tier: 'premium', productId: 'nutrion_prof_premium' },
    ]);
  });
  it('professor premium → nada (topo)', () => {
    expect(availablePlans({ role: 'professor', currentTier: 'premium' })).toEqual([]);
  });
  it('comum free → só Pro', () => {
    expect(availablePlans({ role: 'comum', currentTier: 'free' })).toEqual([
      { tier: 'pro', productId: 'nutrion_comum_pro' },
    ]);
  });
  it('comum pro → nada', () => {
    expect(availablePlans({ role: 'comum', currentTier: 'pro' })).toEqual([]);
  });
  it('aluno → nada (IA herdada)', () => {
    expect(availablePlans({ role: 'aluno', currentTier: 'free' })).toEqual([]);
  });
  it('role indefinido → nada', () => {
    expect(availablePlans({ role: null, currentTier: 'free' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/purchaseSelection.test.ts`
Expected: FAIL — `availablePlans` não existe.

- [ ] **Step 3: Implementar**

Adicionar ao fim de `src/lib/purchaseSelection.ts`:

```ts
/** Um plano comprável a ser exibido no paywall. */
export type Plan = { tier: 'pro' | 'premium'; productId: ProductId };

/**
 * Lista ordenada de planos a exibir no paywall (upgrade). Professor free vê
 * Pro + Premium; pro vê só Premium; premium nada. Comum só tem Pro. Aluno nunca
 * compra (IA herdada do professor, C4).
 */
export function availablePlans({
  role,
  currentTier,
}: {
  role: Role | null | undefined;
  currentTier: Tier;
}): Plan[] {
  if (role === 'professor') {
    if (currentTier === 'free') {
      return [
        { tier: 'pro', productId: 'nutrion_prof_pro' },
        { tier: 'premium', productId: 'nutrion_prof_premium' },
      ];
    }
    if (currentTier === 'pro') {
      return [{ tier: 'premium', productId: 'nutrion_prof_premium' }];
    }
    return []; // premium = topo
  }
  if (role === 'comum') {
    return currentTier === 'free'
      ? [{ tier: 'pro', productId: 'nutrion_comum_pro' }]
      : [];
  }
  return []; // aluno / indefinido
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/purchaseSelection.test.ts`
Expected: PASS (todos, incluindo os `selectProductId` já existentes + os 7 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/purchaseSelection.ts src/lib/purchaseSelection.test.ts
git commit -m "feat(paywall): availablePlans — planos por tier (Pro+Premium professor)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `planContent` (conteúdo por plano) + testes

**Files:**
- Modify: `src/lib/paywallContent.ts`
- Test: `src/lib/paywallContent.test.ts` (adicionar describe)

**Interfaces:**
- Consumes: `Role` de `@/lib/purchaseSelection`.
- Produces: `type PlanContent = { name: string; highlight?: boolean; bullets: string[] }`; `planContent(tier: 'pro' | 'premium', role: Role): PlanContent`.

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao fim de `src/lib/paywallContent.test.ts`:

```ts
import { planContent } from './paywallContent';

describe('planContent', () => {
  it('professor pro: nome Pro, sem highlight, fala em 5 alunos', () => {
    const c = planContent('pro', 'professor');
    expect(c.name).toBe('Pro');
    expect(c.highlight).toBeFalsy();
    expect(c.bullets.some((b) => b.includes('5 alunos'))).toBe(true);
  });
  it('professor premium: nome Premium, highlight, fala em ilimitado', () => {
    const c = planContent('premium', 'professor');
    expect(c.name).toBe('Premium');
    expect(c.highlight).toBe(true);
    expect(c.bullets.some((b) => b.toLowerCase().includes('ilimitado'))).toBe(true);
  });
  it('comum pro: bullets pessoais (chat IA)', () => {
    const c = planContent('pro', 'comum');
    expect(c.name).toBe('Pro');
    expect(c.bullets.some((b) => b.toLowerCase().includes('chat ia'))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/paywallContent.test.ts`
Expected: FAIL — `planContent` não existe.

- [ ] **Step 3: Implementar**

Em `src/lib/paywallContent.ts`, adicionar o import no topo e a função + tipo ao fim:

```ts
import type { Role } from '@/lib/purchaseSelection';
```

```ts
export type PlanContent = { name: string; highlight?: boolean; bullets: string[] };

/**
 * Conteúdo do CARD de um plano (nome + bullets). Preço real vem do package do
 * RevenueCat na tela — não aqui. Professor tem Pro e Premium; comum só Pro.
 */
export function planContent(tier: 'pro' | 'premium', role: Role): PlanContent {
  if (role === 'professor') {
    if (tier === 'premium') {
      return {
        name: 'Premium',
        highlight: true,
        bullets: [
          'Alunos ilimitados',
          'Tudo do Pro incluído',
          'IA de professor completa (gerar + importar treino)',
        ],
      };
    }
    return {
      name: 'Pro',
      bullets: [
        'Até 5 alunos',
        'IA de professor: gerar plano completo',
        'IA de professor: importar treino por texto ou foto',
      ],
    };
  }
  // comum só tem Pro (IA pessoal)
  return {
    name: 'Pro',
    bullets: [
      'Chat IA ilimitado pra treino e dieta',
      'Sanity check: valide seu prato por foto',
      'Respostas ancoradas no seu perfil e metas',
    ],
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/paywallContent.test.ts`
Expected: PASS (existentes + 3 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/paywallContent.ts src/lib/paywallContent.test.ts
git commit -m "feat(paywall): planContent — bullets por plano (Pro/Premium)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Compra com proração — `billing.ts`

**Files:**
- Modify: `src/services/billing.ts`

**Interfaces:**
- Produces: `getActiveProductId(): Promise<string | null>`; `purchasePackage(pkg, opts?: { oldProductId?: string | null }): Promise<CustomerInfo>`.

- [ ] **Step 1: Adicionar `getActiveProductId` e o parâmetro de troca de plano**

Em `src/services/billing.ts`, substituir a função `purchasePackage` atual por:

```ts
/**
 * Product identifier da assinatura ativa (Google), ou null. Usado pra troca de
 * plano (pro→premium): precisamos do produto antigo pra substituir em vez de
 * criar uma 2ª assinatura.
 */
export async function getActiveProductId(): Promise<string | null> {
  if (!isBillingAvailable) return null;
  const info = await load().getCustomerInfo();
  return info.activeSubscriptions?.[0] ?? null;
}

/**
 * Compra um package. Com `oldProductId`, faz TROCA de plano (Google product
 * change) com proração imediata — substitui a assinatura atual (evita cobrança
 * dupla no pro→premium). Sem ele, é compra normal (free→qualquer).
 */
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

> Assinatura RN 10.4.4: `purchasePackage(aPackage, upgradeInfo?, productChangeInfo?, googleIsPersonalizedPrice?)` — por isso o 2º arg é `null` e o 3º é o `GoogleProductChangeInfo` (`{ oldProductIdentifier, prorationMode }`). `PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE` é membro válido do enum (=2).

- [ ] **Step 2: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros novos (só o pré-existente do paywall.ts). Se o TS reclamar do 3º arg, conferir o tipo `GoogleProductChangeInfo` em `react-native-purchases` e ajustar o objeto pra bater exatamente (`oldProductIdentifier` obrigatório, `prorationMode` opcional).

- [ ] **Step 3: Commit**

```bash
git add src/services/billing.ts
git commit -m "feat(billing): troca de plano com proração (pro→premium sem cobrança dupla)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: UI da paywall — cards de plano

**Files:**
- Modify: `app/paywall.tsx` (reescrita da tela)

**Interfaces:**
- Consumes: `availablePlans`, `findPackage`, `Plan`, `Role` (`@/lib/purchaseSelection`); `planContent` (`@/lib/paywallContent`); `purchasePackage`, `getActiveProductId`, `restore`, `isBillingAvailable`, `isUserCancelledError` (`@/services/billing`); `syncMyCoachAccess` (`@/services/suspension`).

- [ ] **Step 1: Reescrever `app/paywall.tsx`**

Substituir TODO o conteúdo de `app/paywall.tsx` por:

```tsx
import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown, X } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { colors } from '@/lib/theme';
import { paywallContent, planContent } from '@/lib/paywallContent';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useOfferings } from '@/hooks/useOfferings';
import { useAlert } from '@/components/GlobalAlertProvider';
import { availablePlans, findPackage, type Plan, type Role } from '@/lib/purchaseSelection';
import {
  purchasePackage,
  restore,
  getActiveProductId,
  isUserCancelledError,
  isBillingAvailable,
} from '@/services/billing';
import { pollUntil } from '@/lib/pollUntil';
import { fetchEntitlement } from '@/services/entitlement';
import { syncMyCoachAccess } from '@/services/suspension';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Paywall contextual (#2/#5b). Header vem do feature do 402; o corpo mostra os
 * planos compráveis do usuário (availablePlans): professor free vê Pro+Premium,
 * pro vê Premium. Preço real do RevenueCat. pro→premium usa troca de plano com
 * proração (billing.purchasePackage com oldProductId). Aluno não compra.
 */
export default function PaywallScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const { data: entitlement } = useEntitlement();
  const { data: offerings } = useOfferings();
  const alert = useAlert();

  // productId em compra (ou 'restore'); null = ocioso.
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const busy = busyPlan !== null;

  const header = paywallContent(feature);
  const role = profile?.role as Role | undefined;
  const currentTier = entitlement?.tier ?? 'free';
  const isAluno = role === 'aluno';
  const plans = availablePlans({ role, currentTier });

  /** Re-busca o entitlement até refletir a compra + reconcilia acesso dos alunos. */
  async function refreshEntitlement(): Promise<boolean> {
    const { satisfied } = await pollUntil({
      fn: fetchEntitlement,
      done: (e) => e.tier !== 'free',
    });
    if (user?.id) {
      try {
        await syncMyCoachAccess(user.id);
      } catch {
        // best-effort: o webhook também reconcilia
      }
      await qc.invalidateQueries({ queryKey: queryKeys.entitlement(user.id) });
      await qc.invalidateQueries({ queryKey: ['students', user.id] });
    }
    return satisfied;
  }

  async function handleSubscribe(plan: Plan) {
    if (!isBillingAvailable) {
      alert.showAlert({
        type: 'info',
        title: 'Indisponível agora',
        message: 'A assinatura fica disponível no app instalado da loja. Em breve por aqui.',
      });
      return;
    }
    const pkg = findPackage(offerings, plan.productId);
    if (!pkg) {
      alert.showAlert({
        type: 'warning',
        title: 'Planos indisponíveis',
        message: 'Não consegui carregar os planos agora. Tente de novo em instantes.',
      });
      return;
    }
    setBusyPlan(plan.productId);
    try {
      // pro→premium: troca de plano (substitui a assinatura atual, sem 2ª cobrança).
      const oldProductId =
        currentTier !== 'free' ? await getActiveProductId().catch(() => null) : null;
      await purchasePackage(pkg, { oldProductId });
      const liberado = await refreshEntitlement();
      alert.showAlert(
        liberado
          ? {
              type: 'success',
              title: 'Assinatura ativa!',
              message: 'Seus recursos foram liberados. Aproveite 💪',
            }
          : {
              type: 'info',
              title: 'Compra recebida',
              message:
                'Estamos liberando seu acesso — pode levar alguns instantes. Se demorar, toque em "Restaurar compras".',
            },
      );
      router.back();
    } catch (err) {
      if (isUserCancelledError(err)) return;
      alert.showError(err);
    } finally {
      setBusyPlan(null);
    }
  }

  async function handleRestore() {
    if (!isBillingAvailable) return;
    setBusyPlan('restore');
    try {
      await restore();
      const liberado = await refreshEntitlement();
      if (liberado) {
        alert.showAlert({
          type: 'success',
          title: 'Assinatura restaurada!',
          message: 'Seus recursos foram liberados novamente.',
        });
        router.back();
      } else {
        alert.showAlert({
          type: 'info',
          title: 'Nada pra restaurar',
          message: 'Não encontramos uma assinatura ativa nesta conta.',
        });
      }
    } catch (err) {
      if (isUserCancelledError(err)) return;
      alert.showError(err);
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Screen variant="violet" edges={['top']}>
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <X size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Persona Fit Pro</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-3 pt-2">
            <View className="h-16 w-16 rounded-3xl bg-violet/20 border border-violet items-center justify-center">
              <Crown size={30} color={colors.violetSoft} />
            </View>
            <Text className="text-text text-2xl font-bold text-center">{header.title}</Text>
            <Text className="text-text-dim text-base text-center">{header.subtitle}</Text>
          </View>

          {isAluno ? (
            <Card padding="lg">
              <Text className="text-text text-base font-semibold mb-1">
                Acesso pelo seu professor
              </Text>
              <Text className="text-text-dim text-[15px] leading-5">
                Seu acesso à IA depende do plano do seu professor. Fale com ele(a) pra liberar
                esses recursos no seu acompanhamento.
              </Text>
            </Card>
          ) : plans.length === 0 ? (
            <Card padding="lg">
              <Text className="text-text text-base font-semibold mb-1">Tudo certo!</Text>
              <Text className="text-text-dim text-[15px] leading-5">
                Seu plano atual já é o mais completo. Aproveite 💪
              </Text>
            </Card>
          ) : (
            <View className="gap-4">
              {plans.map((plan) => {
                const c = planContent(plan.tier, role as Role);
                const pkg = findPackage(offerings, plan.productId);
                const price = pkg?.product.priceString ?? null;
                return (
                  <Card
                    key={plan.productId}
                    accent={c.highlight ? 'violet' : undefined}
                    glow={c.highlight}
                    padding="lg"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-text text-lg font-bold">{c.name}</Text>
                      {c.highlight && (
                        <View className="rounded-full border border-violet/50 bg-violet/15 px-2.5 py-0.5">
                          <Text className="text-violet-soft text-[11px] font-bold">Recomendado</Text>
                        </View>
                      )}
                    </View>
                    <View className="gap-2.5 mb-4">
                      {c.bullets.map((b) => (
                        <View key={b} className="flex-row items-start gap-3">
                          <View className="mt-0.5 h-5 w-5 rounded-full bg-violet/20 items-center justify-center">
                            <Check size={13} color={colors.violetSoft} />
                          </View>
                          <Text className="text-text flex-1 text-[15px] leading-5">{b}</Text>
                        </View>
                      ))}
                    </View>
                    {price && (
                      <Text className="text-text-dim text-sm mb-3">
                        {price}
                        <Text className="text-text-muted"> / mês</Text>
                      </Text>
                    )}
                    <Button
                      label={`Assinar ${c.name}`}
                      variant={c.highlight ? 'primary' : 'secondary'}
                      size="lg"
                      fullWidth
                      loading={busyPlan === plan.productId}
                      disabled={busy || !pkg}
                      onPress={() => handleSubscribe(plan)}
                    />
                  </Card>
                );
              })}

              <Button
                label="Já assinei · Restaurar compras"
                variant="ghost"
                size="md"
                fullWidth
                disabled={busy}
                onPress={handleRestore}
              />
              <Button
                label="Agora não"
                variant="ghost"
                size="md"
                fullWidth
                disabled={busy}
                onPress={() => router.back()}
              />
            </View>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck && npm run lint`
Expected: sem erros novos (só o pré-existente do paywall.ts). Se `Card` não aceitar `accent={undefined}` ou `glow`, conferir a interface de `@/components/ui/Card` (o uso `accent="violet" glow` já existia na versão anterior desta tela) e ajustar; se `Button` não tiver `variant="secondary"`, usar `"primary"`/`"ghost"` conforme a API real (variant existe — usado em `app/(coach)/index.tsx`).

- [ ] **Step 3: Commit**

```bash
git add app/paywall.tsx
git commit -m "feat(paywall): comparação de planos (cards Pro+Premium, preço real, proração)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verificação + OTA

**Files:** nenhum.

- [ ] **Step 1: Suíte completa + typecheck + lint**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck && npm run lint && npx vitest run`
Expected: typecheck só com o erro pré-existente; lint sem erros novos; vitest 100% verde (inclui os novos de availablePlans/planContent).

- [ ] **Step 2: Deploy OTA (produção)** — só após aprovação do dev (deploy é ação de produção)

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx --yes eas-cli@latest update --branch production --message "paywall: comparação Pro+Premium" --non-interactive`
Expected: publicado, runtime 1.3.0. Confirmar `version` não bumpada.

- [ ] **Step 3: E2E manual (device)**

1. Professor **free** → paywall mostra **2 cards** (Pro + Premium destacado) com **preços reais** → assina Premium (compra fresh) → vira premium.
2. Professor **pro** → paywall mostra **só Premium** → assina → **troca de plano com proração**; conferir na Play que **NÃO** há 2 assinaturas ativas (uma só, agora Premium).
3. Professor **premium** → "Seu plano atual já é o mais completo".
4. Usuário **comum free** → só card Pro (inalterado). **Aluno** → card "acesso pelo seu professor".

---

## Self-Review

**1. Spec coverage:**
- availablePlans (planos por tier) → Task 1. ✅
- planContent (bullets por plano) + preço real na UI → Tasks 2, 4. ✅
- UI cards + header contextual + empty state + aluno → Task 4. ✅
- Proração pro→premium (getActiveProductId + productChangeInfo) → Tasks 3, 4. ✅
- OTA-only / runtime 1.3.0 → Global Constraints + Task 5. ✅
- Fora de escopo (downgrade, premium comum) → respeitado. ✅

**2. Placeholder scan:** sem TBD/TODO. billing/UI têm verificação manual (padrão do repo p/ código nativo/RN); lógica pura tem vitest (Tasks 1, 2).

**3. Type consistency:** `Plan`/`Role`/`ProductId` de `purchaseSelection` usados igual em Tasks 1/4. `planContent(tier, role)` idêntico entre Tasks 2 e 4. `purchasePackage(pkg, { oldProductId })` e `getActiveProductId` idênticos entre Tasks 3 e 4. `PRORATION_MODE.IMMEDIATE_AND_CHARGE_PRORATED_PRICE` confirmado no enum instalado.

**Nota de risco:** o tipo exato de `GoogleProductChangeInfo` e a posição do arg em `purchasePackage` (2º = upgradeInfo deprecated → `null`; 3º = productChangeInfo) devem bater com `react-native-purchases@10.4.4` — Task 3 Step 2 valida via typecheck. Preço "/mês" assume base plan mensal (verdade hoje).
