// Detecção do gating server-side do billing-core: 402 { error:'needs_upgrade', feature }.
// Converte o 402 num erro tipado pra UI rotear ao paywall (ver src/lib/paywall.ts).

export class NeedsUpgradeError extends Error {
  feature: string;
  constructor(feature: string) {
    super('needs_upgrade');
    this.name = 'NeedsUpgradeError';
    this.feature = feature;
  }
}

/**
 * Para callers via fetch direto (chat.ts, students.ts callFn): recebe o status e o
 * texto cru do body. Retorna NeedsUpgradeError só quando é o shape exato do billing-core
 * — qualquer outro 402/erro retorna null e segue o tratamento normal do caller.
 */
export function parseNeedsUpgrade(
  status: number,
  bodyText: string,
): NeedsUpgradeError | null {
  if (status !== 402) return null;
  try {
    const b = JSON.parse(bodyText);
    if (b?.error === 'needs_upgrade' && typeof b.feature === 'string') {
      return new NeedsUpgradeError(b.feature);
    }
  } catch {
    // body não-JSON → não é o nosso shape
  }
  return null;
}

/**
 * Para callers via supabase.functions.invoke (workoutImport.ts): o invoke engole o body
 * em não-2xx, mas expõe o Response cru em FunctionsHttpError.context (body não consumido).
 */
export async function needsUpgradeFromInvokeError(
  error: unknown,
): Promise<NeedsUpgradeError | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (!(ctx instanceof Response) || ctx.status !== 402) return null;
  try {
    return parseNeedsUpgrade(402, await ctx.text());
  } catch {
    return null;
  }
}
