import { router } from 'expo-router';
import { NeedsUpgradeError } from './needsUpgrade';

/** Abre o paywall modal contextual pra uma feature key do billing-core. */
export function openPaywall(feature: string) {
  router.push({ pathname: '/paywall', params: { feature } });
}

/**
 * Handler único pros call sites: se o erro for um NeedsUpgradeError (402 do gating),
 * abre o paywall e retorna true (caller deve parar o tratamento de erro normal).
 * Qualquer outro erro → false (segue o fluxo de erro existente).
 */
export function handleNeedsUpgrade(err: unknown): boolean {
  if (err instanceof NeedsUpgradeError) {
    openPaywall(err.feature);
    return true;
  }
  return false;
}
