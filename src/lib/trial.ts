// Status do trial de servidor (billing-core source='server_trial'). Lógica pura → testável.

/** Dias inteiros restantes do trial (ceil). 0 quando expirado ou sem trial. */
export function trialDaysLeft(trialEnd: string | null, now: number): number {
  if (!trialEnd) return 0;
  const ms = new Date(trialEnd).getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
