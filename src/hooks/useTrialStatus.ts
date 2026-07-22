import { useEntitlement } from './useEntitlement';
import { trialDaysLeft } from '@/lib/trial';

/**
 * Status do trial de servidor pro usuário logado. Deriva do entitlement (#1).
 * inTrial = está num server_trial ativo; daysLeft = dias inteiros restantes.
 */
export function useTrialStatus(): { inTrial: boolean; daysLeft: number } {
  const { data } = useEntitlement();
  if (!data || data.source !== 'server_trial') {
    return { inTrial: false, daysLeft: 0 };
  }
  const daysLeft = trialDaysLeft(data.trial_end, Date.now());
  return { inTrial: daysLeft > 0, daysLeft };
}
