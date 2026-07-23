// Wrapper defensivo do RevenueCat (#5b). O SDK é dep NATIVA: não carrega no Expo Go e crasha
// se importado estático (mesmo padrão do Google Sign-in em auth.ts → lazy require). Sem a API
// key ou em Expo Go, tudo vira no-op seguro pra o app rodar em dev/preview sem billing.
//
// Verdade do acesso = resolve_entitlement (servidor), NÃO o customerInfo (feedback local,
// burlável). Pós-compra o paywall re-busca o entitlement via pollUntil (webhook #5a é async).

import { IS_EXPO_GO } from '@/lib/platform';
import type {
  PurchasesPackage,
  PurchasesOfferings,
  CustomerInfo,
} from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;

/** Billing só opera em dev/release build (não Expo Go) e com a key configurada. */
export const isBillingAvailable = !IS_EXPO_GO && !!API_KEY;

export class BillingUnavailableError extends Error {
  constructor() {
    super('Billing indisponível neste ambiente.');
    this.name = 'BillingUnavailableError';
  }
}

type PurchasesModule = (typeof import('react-native-purchases'))['default'];
let cache: PurchasesModule | null = null;
function load(): PurchasesModule {
  if (!cache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cache = require('react-native-purchases').default as PurchasesModule;
  }
  return cache;
}

let configured = false;

/**
 * Configura o SDK com `appUserID = profiles.id` (o webhook #5a depende disso pra casar a compra
 * ao usuário). Idempotente: configura uma vez; trocas de usuário usam logIn. No-op sem billing.
 */
export async function initBilling(userId: string): Promise<void> {
  if (!isBillingAvailable) return;
  const Purchases = load();
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY as string, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

export async function logoutBilling(): Promise<void> {
  if (!isBillingAvailable || !configured) return;
  try {
    await load().logOut();
  } catch {
    // logOut lança se o usuário já é anônimo — irrelevante.
  }
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!isBillingAvailable) return null;
  return load().getOfferings();
}

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

export async function restore(): Promise<CustomerInfo> {
  if (!isBillingAvailable) throw new BillingUnavailableError();
  return load().restorePurchases();
}

/** true se o erro do SDK for cancelamento do usuário (não é falha — não mostrar erro técnico). */
export function isUserCancelledError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { userCancelled?: boolean }).userCancelled === true
  );
}
