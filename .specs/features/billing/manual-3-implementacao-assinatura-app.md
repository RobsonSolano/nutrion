# Manual 3 — Implementação da assinatura no app

> Objetivo: integrar o **RevenueCat SDK** no app Expo, mostrar o paywall, processar
> a compra, e refletir o resultado em `subscriptions` no Supabase via webhook — com
> o **gating autoritativo no servidor**.
>
> Pré-requisitos: Manuais 1 e 2 concluídos (ou pelo menos a conta RevenueCat +
> API key Android + entitlements/offerings criados). A **spec `billing-core`**
> (tabela `subscriptions` + `resolve_entitlement` + gating nas edge functions de
> IA) deve estar implementada **antes** desta integração — ela é a fundação.
>
> Stack já presente no projeto: `expo ~54`, `expo-dev-client ~6`, EAS configurado,
> package `br.com.nutrion`, services em `src/services/`, TanStack Query, Supabase.

---

## Mapa do que será criado

```
src/services/billing.ts          # wrapper do RevenueCat SDK (init, offerings, compra, restore)
src/services/entitlement.ts      # lê resolve_entitlement do Supabase (fonte de verdade)
src/hooks/useEntitlement.ts       # hook TanStack Query do entitlement
src/hooks/useOfferings.ts         # hook das offerings do RevenueCat
app.config.ts                     # + plugin react-native-purchases (se necessário)
supabase/functions/revenuecat-webhook/   # recebe eventos → upsert subscriptions
```

---

## Passo 1 — Instalar o SDK (exige dev build, não Expo Go)

```bash
npx expo install react-native-purchases
```

O RevenueCat tem código nativo → **não roda no Expo Go**. Como o projeto já usa
`expo-dev-client` + EAS, é só gerar um **novo dev build** depois de instalar:

```bash
eas build --profile development --platform android
```

> Se o `react-native-purchases` exigir config plugin nas versões atuais, adicione
> em `app.config.ts` no array `plugins` (`'react-native-purchases'`) antes do build.
> Confira a doc do pacote na hora — a necessidade do plugin muda entre versões.

## Passo 2 — Variáveis de ambiente

No `.env` / config do projeto (seguindo o padrão atual de envs do app):

```
EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_xxxxxxxxxxxxxxxxxx
```

(A key pública `goog_...` veio do RevenueCat — Manual 2, Parte D, passo 4.)

## Passo 3 — `src/services/billing.ts` (wrapper do SDK)

Pontos críticos:
- **Identificar o usuário com o `profiles.id`** (= `auth.uid()`). Isso faz o
  `app_user_id` do RevenueCat bater com o `user_id` do Supabase — o webhook
  depende disso pra saber de quem é a compra.
- Inicializar **uma vez** após o login.

```ts
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

let configured = false;

export async function initBilling(userId: string) {
  if (configured) {
    await Purchases.logIn(userId);
    return;
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  await Purchases.configure({
    apiKey: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID!,
    appUserID: userId, // = profiles.id / auth.uid()
  });
  configured = true;
}

export async function getOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings; // .current ou .all['comum'] / .all['professor']
}

export async function purchase(pkg: import('react-native-purchases').PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo; // o estado autoritativo vem do Supabase; aqui é só feedback imediato
}

export async function restore() {
  return Purchases.restorePurchases();
}

export async function logoutBilling() {
  if (configured) await Purchases.logOut();
}
```

> Chame `initBilling(user.id)` no mesmo ponto onde o app hoje resolve a sessão
> (provider de auth). Chame `logoutBilling()` no logout.

## Passo 4 — `src/services/entitlement.ts` (fonte de verdade = Supabase)

O app **não** decide acesso pelo `customerInfo` do RevenueCat (pode estar
desatualizado / burlável). Decide pelo `resolve_entitlement` do Supabase, que já
considera trial de servidor, grandfather e herança do aluno.

```ts
import { supabase } from './supabase';

export type Entitlement = {
  ai_personal: boolean;   // chat + sanity check
  ai_coach: boolean;      // gerar treino com IA (só professor)
  student_limit: number | null; // null = ilimitado; só professor
  tier: 'free' | 'pro' | 'premium';
  source: 'store_play' | 'store_apple' | 'stripe' | 'server_trial' | 'grandfather' | 'none';
  trial_end: string | null;
};

export async function getEntitlement(): Promise<Entitlement> {
  // RPC criada na spec billing-core
  const { data, error } = await supabase.rpc('resolve_entitlement');
  if (error) throw error;
  return data as Entitlement;
}
```

## Passo 5 — Hooks (`src/hooks/`)

```ts
// useEntitlement.ts
export function useEntitlement() {
  return useQuery({ queryKey: ['entitlement'], queryFn: getEntitlement, staleTime: 60_000 });
}

// useOfferings.ts
export function useOfferings() {
  return useQuery({ queryKey: ['offerings'], queryFn: getOfferings, staleTime: 5 * 60_000 });
}
```

Após uma compra bem-sucedida, **invalide** `['entitlement']` (e dê um pequeno
delay/retry, pois o webhook é assíncrono):

```ts
await purchase(pkg);
await queryClient.invalidateQueries({ queryKey: ['entitlement'] });
```

## Passo 6 — Gating na UI (o "seja Pro")

Onde hoje aparece o botão de Chat IA / Sanity Check, troque por upsell quando não
houver direito:

```tsx
const { data: ent } = useEntitlement();

{ent?.ai_personal
  ? <BotaoChatIA />
  : <UpsellPro feature="chat" />}  // "✨ Seja Pro pra liberar a IA"
```

> ⚠️ Isso é só **experiência**. A proteção real está no servidor (Passo 8). UI
> pode ser burlada; o gasto de token de IA, não.

## Passo 7 — Edge function `revenuecat-webhook`

Recebe eventos do RevenueCat e mantém `subscriptions` em dia. Segue o padrão das
edge functions existentes (Deno, em `supabase/functions/`).

```ts
// supabase/functions/revenuecat-webhook/index.ts (esqueleto)
Deno.serve(async (req) => {
  // 1. Conferir o header secreto definido no RevenueCat (Manual 2, Parte D, passo 8)
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${Deno.env.get('RC_WEBHOOK_SECRET')}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const event = await req.json();
  const e = event.event;
  const userId = e.app_user_id;          // = profiles.id (Passo 3)
  const entitlements = e.entitlement_ids ?? [];
  const tier = entitlements.includes('premium') ? 'premium'
             : entitlements.includes('pro') ? 'pro' : 'free';

  // 2. Mapear o tipo de evento → status
  //    INITIAL_PURCHASE / RENEWAL / UNCANCELLATION → active|in_trial
  //    CANCELLATION → canceled (mantém até period_end)
  //    EXPIRATION → expired (vira free)
  // 3. upsert em subscriptions via service_role (RLS bypass)
  //    { user_id: userId, tier, source: 'store_play', status, period_end: e.expiration_at_ms }
  // ...

  return new Response('ok', { status: 200 });
});
```

Deploy:

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
# (--no-verify-jwt porque o RevenueCat não manda JWT do Supabase; a auth é o header secreto)
supabase secrets set RC_WEBHOOK_SECRET=<segredo>
```

## Passo 8 — Gating autoritativo no servidor (relembrando — vem do `billing-core`)

As edge functions de IA chamam `resolve_entitlement` **antes** de gastar token.
Recapitulando o mapeamento (a implementação é da spec `billing-core`):

| Edge function | Exige |
|---|---|
| `chat-ai` | `ai_personal` |
| Sanity Check (visão) | `ai_personal` |
| `coach-generate-plan` | `ai_coach` (professor pro/premium) |
| `coach-import-workout-ai` | `ai_coach` |
| `coach-create-student` (vincular) | dentro de `student_limit` |

Sem direito → resposta `402` com `{ error: 'needs_upgrade' }`, que a UI traduz no
paywall.

## Passo 9 — Testar (com license testers do Manual 2)

1. Instale o **dev build** (ou o AAB de teste interno) no device de um license tester.
2. Login → confirme `initBilling(user.id)` rodou (log do RevenueCat).
3. Abra o paywall → compre o package → veja o **"Test card, always approves"**.
4. Confirme a cadeia:
   - RevenueCat dashboard mostra o evento.
   - Edge `revenuecat-webhook` recebeu (logs do Supabase).
   - `subscriptions` do usuário virou `pro/premium active`.
   - `useEntitlement` retorna `ai_personal: true` → botão de IA liberado.
5. Teste **cancelamento** (renovação acelerada de teste expira em minutos) → status
   `canceled` → após expiração, `expired` → volta a `free`.
6. Teste **restore** num device limpo.

---

## Ordem de implementação (recapitulando a decomposição)

> Esta integração (`revenuecat-integration`) é a **última** das 5 specs e a única
> que depende da Play Console. Antes dela devem estar prontas:
> `billing-core` → `paywall-ui` → `trial-e-migracao` → `legal-docs`.
> O paywall e o entitlement já podem ser construídos/testados com `customerInfo`
> mockado e `resolve_entitlement` retornando trial de servidor — sem loja.

## Checklist de saída deste manual

- [ ] `react-native-purchases` instalado + novo dev build EAS rodando.
- [ ] `EXPO_PUBLIC_RC_API_KEY_ANDROID` configurada.
- [ ] `billing.ts` inicializando com `appUserID = profiles.id`.
- [ ] `entitlement.ts` lendo `resolve_entitlement` (fonte de verdade).
- [ ] Hooks `useEntitlement` / `useOfferings` + invalidação pós-compra.
- [ ] UI troca botões de IA por upsell quando sem direito.
- [ ] Edge `revenuecat-webhook` deployada, conferindo header secreto, fazendo upsert.
- [ ] Gating server-side ativo nas edge functions de IA (via `billing-core`).
- [ ] Ciclo compra → webhook → `subscriptions` → entitlement validado com tester.
