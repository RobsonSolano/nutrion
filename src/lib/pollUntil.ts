// Poll genérico com backoff linear (#5b). Usado após a compra: o entitlement real só vira
// `pro`/`premium` quando o webhook (#5a) faz o upsert em `subscriptions` — assíncrono. Então
// re-buscamos o entitlement algumas vezes até refletir, em vez de confiar no customerInfo local.
// `sleep` é injetável → testável instantaneamente.

type Params<T> = {
  fn: () => Promise<T>;
  done: (value: T) => boolean;
  /** número máximo de tentativas (default 4). */
  retries?: number;
  /** base do backoff linear em ms (default 1500); espera = delayMs * nº da tentativa. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export async function pollUntil<T>({
  fn,
  done,
  retries = 4,
  delayMs = 1500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}: Params<T>): Promise<{ value: T; satisfied: boolean; attempts: number }> {
  let value = await fn();
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (attempt > 1) value = await fn();
    if (done(value)) return { value, satisfied: true, attempts: attempt };
    if (attempt < retries) await sleep(delayMs * attempt);
  }
  return { value, satisfied: false, attempts: retries };
}
