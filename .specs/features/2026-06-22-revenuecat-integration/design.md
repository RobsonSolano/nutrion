# Design — revenuecat-integration (#5a server-first)

> Webhook (Deno) + downgrade (cliente). Não altera `resolve_entitlement`/`subscriptions` (#1).

## Camada 1 — Webhook

### `supabase/functions/revenuecat-webhook/mapEvent.ts` — lógica PURA (testável) — [RC]-02
TS puro, **sem imports Deno** → testável por vitest (node).
```ts
export type SubState = { tier: 'free'|'pro'|'premium'; status: 'active'|'in_trial'|'canceled'|'expired'; period_end: string | null };
export function mapRevenueCatEvent(event: any): { userId: string; state: SubState } | null {
  const e = event?.event;
  const userId = e?.app_user_id;
  if (!userId) return null;
  const ents: string[] = e?.entitlement_ids ?? [];
  const baseTier = ents.includes('premium') ? 'premium' : 'pro';
  const periodEnd = e?.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null;
  switch (e?.type) {
    case 'INITIAL_PURCHASE': case 'RENEWAL': case 'PRODUCT_CHANGE': case 'UNCANCELLATION':
      return { userId, state: { tier: baseTier, status: e?.period_type === 'TRIAL' ? 'in_trial' : 'active', period_end: periodEnd } };
    case 'CANCELLATION':
      return { userId, state: { tier: baseTier, status: 'canceled', period_end: periodEnd } };
    case 'BILLING_ISSUE': // grace — mantém até period_end
      return { userId, state: { tier: baseTier, status: 'active', period_end: periodEnd } };
    case 'EXPIRATION':
      return { userId, state: { tier: 'free', status: 'expired', period_end: periodEnd } };
    default: return null; // evento não tratado → ack sem escrever
  }
}
```

### `supabase/functions/revenuecat-webhook/index.ts` — Deno — [RC]-01
```ts
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('RC_WEBHOOK_SECRET')}`)
    return new Response('unauthorized', { status: 401 });
  const body = await req.json().catch(() => null);
  const mapped = mapRevenueCatEvent(body);
  if (!mapped) return new Response('ignored', { status: 200 }); // ack
  const supa = createClient(URL, SERVICE_ROLE, { auth: { persistSession:false }});
  // upsert por user_id; só escreve se o profile existe (FK), senão ack
  const { error } = await supa.from('subscriptions').upsert({
    user_id: mapped.userId, source: 'store_play', rc_app_user_id: mapped.userId,
    tier: mapped.state.tier, status: mapped.state.status, period_end: mapped.state.period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) { console.error('[rc-webhook] upsert', error); return new Response('ok', { status: 200 }); }
  return new Response('ok', { status: 200 });
});
```
- Deploy: `supabase functions deploy revenuecat-webhook --no-verify-jwt` + `supabase secrets set RC_WEBHOOK_SECRET=...`.
- **Não** mexe em `trial_consumed` (anti-abuso do #3 preservado). Upsert por `user_id` mantém a linha.
- FK: se `user_id` não é profile, o upsert falha → logamos e devolvemos `200` (ack; não trava o RevenueCat).

## Camada 2 — Downgrade "escolhe quem fica"

### `src/lib/downgrade.ts` — puro (testável) — [RC]-03
```ts
export function needsStudentChoice(p: {
  role: string; source: string; studentCount: number; studentLimit: number | null;
}): boolean {
  if (p.role !== 'professor' || p.studentLimit === null) return false;
  if (p.source === 'grandfather') return false;        // D5: não-destrutivo
  return p.studentCount > p.studentLimit;
}
```

### `src/hooks/useDowngradeStatus.ts`
Deriva de `useEntitlement` + `useStudents`: `{ needsChoice, studentLimit, overBy }`.

### UI
- **Banner/gate** em `app/(coach)/index.tsx`: se `needsChoice` → card destacado "Seu plano agora
  permite N alunos — escolha quem continua" → navega pra tela.
- **Tela** `app/(coach)/escolher-alunos.tsx` ([RC]-04): lista `useStudents` com `Checkbox` (#4
  reusado) marcando quem **fica** (máx `studentLimit`); contador "X de N"; confirmar desabilitado
  se selecionados > limite. Confirmar → para cada **não-selecionado**, chama `useUnlinkStudent`
  (loop sequencial; mostra progresso). Erro num unlink → alerta + permite re-tentar. Ao terminar,
  `invalidate` students/entitlement → `needsChoice` resolve → volta.

## Teste

- `supabase/functions/revenuecat-webhook/mapEvent.test.ts` (vitest): cada tipo de evento → estado
  certo; sem `app_user_id` → null; tipo desconhecido → null; premium vs pro; period_end ISO.
- `src/lib/downgrade.test.ts` (vitest): professor over-limit não-grandfather → true; grandfather → false;
  dentro do limite → false; não-professor → false; limit null (premium) → false.
- `vitest.config.ts`: `include` passa a cobrir `supabase/functions/**/*.test.ts` (mapEvent é TS puro).
- Webhook runtime: UAT por simulação (`curl` com header secreto) no deploy. Tela: manual.

## Arquivos

**Novos:** `supabase/functions/revenuecat-webhook/{index.ts,mapEvent.ts,mapEvent.test.ts,deno.json}`,
`src/lib/downgrade.ts`, `src/lib/downgrade.test.ts`, `src/hooks/useDowngradeStatus.ts`,
`app/(coach)/escolher-alunos.tsx`.
**Tocados:** `vitest.config.ts` (include), `app/(coach)/index.tsx` (banner), `npm run fn:deploy` (+ webhook).

## Riscos

- **mapEvent puro testável por vitest:** ok porque não importa Deno; `index.ts` (com `Deno.serve`/
  `std/`/`@supabase`) **não** é importado pelo teste.
- **Distinguir downgrade de grandfather:** via `source` (R4). Coberto no teste puro.
- **Unlink em lote:** loop client-side reusando a edge existente; sequencial pra erro claro.
- **#5b pendente:** sem o SDK, o webhook não recebe eventos reais — validar por simulação até lá.
