# Tasks — revenuecat-integration (#5a server-first)

> Premissa zero-context. `[P]` paralelizável. `npm test` (vitest), `npm run typecheck`.

## T1 — `mapEvent.ts` (puro, TDD) + ampliar vitest include
- **What:** Mapa evento RevenueCat → `{ userId, state{tier,status,period_end} }`. ([RC]-02)
- **Where:** `supabase/functions/revenuecat-webhook/mapEvent.ts` (TS puro, sem Deno) +
  `mapEvent.test.ts`; `vitest.config.ts` → `include` cobre `supabase/functions/**/*.test.ts`.
- **Depends:** —
- **TDD:** INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION→active (TRIAL→in_trial);
  CANCELLATION→canceled (period_end mantido); EXPIRATION→free/expired; BILLING_ISSUE→active(grace);
  premium nos entitlements→premium senão pro; sem app_user_id→null; tipo desconhecido→null.
- **Done-when:** testes verdes.
- **Verify:** `npm test supabase/functions/revenuecat-webhook/mapEvent.test.ts`.

## T2 — Edge `revenuecat-webhook` (auth + upsert)
- **What:** `Deno.serve` que valida o header secreto e faz upsert em `subscriptions`. ([RC]-01)
- **Where:** `supabase/functions/revenuecat-webhook/index.ts` (+ `deno.json` padrão das edges).
  Usa `mapRevenueCatEvent`; service_role; upsert `onConflict:'user_id'`; `--no-verify-jwt` no deploy.
  Adicionar o deploy ao `npm run fn:deploy` (script em package.json).
- **Depends:** T1
- **Done-when:** 401 sem header; 200 + upsert com evento válido; 200 (ack) p/ tipo ignorado / user inexistente.
- **Verify:** typecheck do app (edge excluída do tsc); runtime via `curl` simulado no UAT.

## T3 — `downgrade.ts` (puro, TDD) `[P]`
- **What:** `needsStudentChoice({role,source,studentCount,studentLimit})`. ([RC]-03)
- **Where:** `src/lib/downgrade.ts` + `src/lib/downgrade.test.ts`.
- **Depends:** —
- **TDD:** professor over-limit não-grandfather→true; grandfather over-limit→false; dentro do limite→false;
  não-professor→false; studentLimit null (premium)→false.
- **Done-when:** testes verdes.
- **Verify:** `npm test src/lib/downgrade.test.ts`.

## T4 — `useDowngradeStatus` + banner no coach index
- **What:** Derivar `{needsChoice, studentLimit, overBy}` e sinalizar no coach. ([RC]-03)
- **Where:** `src/hooks/useDowngradeStatus.ts` (useEntitlement + useStudents + `needsStudentChoice`);
  `app/(coach)/index.tsx` banner condicional → navega pra `escolher-alunos`.
- **Depends:** T3
- **Done-when:** professor over-limit (não-grandfather) vê o banner; demais não; typecheck verde.
- **Verify:** typecheck; UAT manual.

## T5 — Tela `escolher-alunos` + loop de unlink
- **What:** Selecionar quem fica (≤ limite) e desvincular o resto. ([RC]-04)
- **Where:** `app/(coach)/escolher-alunos.tsx`: `useStudents` + `Checkbox` (marca quem fica, máx
  `studentLimit`), confirmar bloqueado se > limite; loop sequencial `useUnlinkStudent` nos não-mantidos
  com progresso/erro; invalida students+entitlement ao fim.
- **Depends:** T4
- **Done-when:** confirma com ≤ limite → excedentes desvinculados (viram comum + trial via #3);
  estado de downgrade resolve; erro num unlink informa e permite re-tentar.
- **Verify:** typecheck; UAT manual (professor com >5 alunos e sub expirada).

## Ordem
1. T1, T3 `[P]` (lógica pura).
2. T2 (após T1).
3. T4 (após T3) → T5.

## Cobertura spec → tasks
| Req | Tasks |
|-----|-------|
| [RC]-01 | T2 |
| [RC]-02 | T1 |
| [RC]-03 | T3, T4 |
| [RC]-04 | T5 |

## #5b (deferido — quando houver Play Console + RevenueCat + dev build)
Instalar `react-native-purchases` (dev build), `billing.ts` (init com appUserID=profiles.id),
`useOfferings`, ligar a CTA "Quero assinar" do paywall à compra real + invalidar entitlement,
restore, plugin no `app.config`. Guiado por manual-2/3/4. Confirmar a API do SDK via Context7 na hora.
