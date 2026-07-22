import { useQuery } from '@tanstack/react-query';
import { getOfferings, isBillingAvailable } from '@/services/billing';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Offerings do RevenueCat (#5b). Mudam raramente → staleTime alto. `enabled` só quando o billing
 * está disponível (dev/release build + key) — em Expo Go/sem key não tenta buscar.
 */
export function useOfferings() {
  return useQuery({
    queryKey: queryKeys.offerings(),
    queryFn: getOfferings,
    enabled: isBillingAvailable,
    staleTime: 5 * 60_000,
  });
}
