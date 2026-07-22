# Tasks — paywall-ui

> Premissa zero-context: cada task é executável lendo só ela + `spec.md`/`design.md`.
> `[P]` = paralelizável (sem dependência mútua). TDD inline nas tasks de lógica.
> Comando de teste lógico: `npm test` (vitest, criado na T1). Typecheck: `npm run typecheck`.

---

## T1 — Setup vitest mínimo (infra) `[P]`
- **What:** Adicionar vitest escopado a lógica pura (`src/lib`), sem JSX/RN.
- **Where:** `package.json` (devDep `vitest` + script `"test": "vitest run"`, `"test:watch": "vitest"`), `vitest.config.ts` (raiz) com `resolve.alias` `@` → `./src` e `environment: 'node'`.
- **Depends:** —
- **Done-when:** `npm test` roda (0 testes ou um teste sentinela) sem erro de config; `npm run typecheck` continua verde.
- **Verify:** `npm test` → exit 0. (infra: verificação manual)
- **Nota:** não tocar em `tsconfig`/lint do app. vitest só resolve `src/lib/**`.

## T2 — Tipos de billing + queryKey `[P]`
- **What:** Tipo `Entitlement` (fonte única no cliente) + `FeatureKey`; queryKey de entitlement. ([PAY]-02)
- **Where:** `src/types/billing.ts` (novo — `Tier`, `EntitlementSource`, `Entitlement`, `FeatureKey` conforme design); `src/lib/queryKeys.ts` (+ `entitlement: (userId) => ['entitlement', userId] as const`).
- **Depends:** —
- **Done-when:** tipos exportados batem 1:1 com o contrato do #1 (6 campos); queryKey adicionada.
- **Verify:** `npm run typecheck` verde.

## T3 — `needsUpgrade.ts` (lógica, TDD) 
- **What:** `NeedsUpgradeError`, `parseNeedsUpgrade(status, bodyText)`, `needsUpgradeFromInvokeError(error)`. ([PAY]-03)
- **Where:** `src/lib/needsUpgrade.ts` (novo) + `src/lib/needsUpgrade.test.ts`.
- **Depends:** T1
- **TDD (RED→GREEN):** testes primeiro, cobrindo:
  - `parseNeedsUpgrade(402, '{"error":"needs_upgrade","feature":"chat"}')` → `NeedsUpgradeError` com `feature==='chat'`.
  - `parseNeedsUpgrade(402, '{"error":"other"}')` → `null` (não mascara outros 402).
  - `parseNeedsUpgrade(429, '...')` → `null`. `parseNeedsUpgrade(402, 'texto-cru')` → `null`.
  - `needsUpgradeFromInvokeError({ context: new Response('{"error":"needs_upgrade","feature":"coach_import_workout"}', { status: 402 }) })` → erro com feature certa.
  - `needsUpgradeFromInvokeError(new Error('x'))` → `null`.
- **Done-when:** todos os testes passam; nenhum 402 com shape válido escapa.
- **Verify:** `npm test src/lib/needsUpgrade.test.ts` → todos verdes (colar saída).

## T4 — Plugar detecção do 402 nos 3 serviços
- **What:** Converter `402 needs_upgrade` em `NeedsUpgradeError` nos call sites. ([PAY]-03)
- **Where:**
  - `src/services/chat.ts`: no `if (!res.ok)`, **após** `const text = await res.text()` e antes dos ramos 429/400: `const nu = parseNeedsUpgrade(res.status, text); if (nu) throw nu;`
  - `src/services/students.ts` `callFn`: no `if (!res.ok)` após `const text = await res.text()`: idem.
  - `src/services/workoutImport.ts` `importWorkoutFromAi`: trocar `if (error) throw error;` por `if (error) { const nu = await needsUpgradeFromInvokeError(error); if (nu) throw nu; throw error; }`
- **Depends:** T3
- **Done-when:** os 4 fluxos gated lançam `NeedsUpgradeError` no 402; demais erros inalterados.
- **Verify:** `npm run typecheck` verde + leitura do diff confirma os 3 sites. (runtime no UAT)

## T5 — Service + hook de entitlement
- **What:** `fetchEntitlement()` + `useEntitlement()`. ([PAY]-01)
- **Where:** `src/services/entitlement.ts` (novo, `supabase.rpc('resolve_entitlement')`); `src/hooks/useEntitlement.ts` (novo, padrão de `useProfile`: keyed por userId, `enabled: !!userId`, `staleTime: 60_000`).
- **Depends:** T2
- **Done-when:** hook retorna `Entitlement` tipado; desabilita sem userId (sem vazamento entre sessões).
- **Verify:** `npm run typecheck` verde. (runtime no UAT)

## T6 — `paywall.ts` roteamento (lógica, TDD)
- **What:** `openPaywall(feature)` + `handleNeedsUpgrade(err): boolean`. ([PAY]-05)
- **Where:** `src/lib/paywall.ts` (novo) + `src/lib/paywall.test.ts` (mock `expo-router`).
- **Depends:** T1, T3
- **TDD:** com `vi.mock('expo-router')`:
  - `handleNeedsUpgrade(new NeedsUpgradeError('chat'))` → `true` e `router.push` chamado com `{ pathname: '/paywall', params: { feature: 'chat' } }`.
  - `handleNeedsUpgrade(new Error('x'))` → `false`, `router.push` não chamado.
- **Done-when:** testes verdes.
- **Verify:** `npm test src/lib/paywall.test.ts` → verde (colar saída).

## T7 — `paywallContent.ts` (lógica, TDD) `[P após T1]`
- **What:** `paywallContent(feature)` → `{ title, subtitle, bullets, planLabel, priceHint }`. ([PAY]-04)
- **Where:** `src/lib/paywallContent.ts` (novo) + `src/lib/paywallContent.test.ts`.
- **Depends:** T1
- **TDD:** `chat`/`sanity_check` → plano "Pessoal" (bullets de IA pessoal); `coach_generate_plan`/`coach_import_workout` → "Professor" (IA de coach); `student_limit` → "mais alunos" (não menciona IA); `undefined`/desconhecido → default seguro (não quebra). `priceHint` presente e marcado placeholder.
- **Done-when:** cada feature mapeia pro conteúdo certo; default não lança.
- **Verify:** `npm test src/lib/paywallContent.test.ts` → verde (colar saída).

## T8 — `studentLimit.ts` (lógica, TDD) `[P após T1]`
- **What:** `isStudentLimitReached(count, limit)`. ([PAY]-09)
- **Where:** `src/lib/studentLimit.ts` (novo) + `src/lib/studentLimit.test.ts`.
- **Depends:** T1
- **TDD:** `(5, 5)`→true; `(4, 5)`→false; `(99, null)`→false (premium ilimitado); `(0, 0)`→true.
- **Done-when:** testes verdes.
- **Verify:** `npm test src/lib/studentLimit.test.ts` → verde (colar saída).

## T9 — `ProBadge` componente `[P]`
- **What:** Pílula "PRO" reutilizável. ([PAY]-06..09)
- **Where:** `src/components/ui/ProBadge.tsx` (novo) — usa `colors` de `src/lib/theme.ts` (violet/accent), texto pequeno; props mínimas (`size?`).
- **Depends:** —
- **Done-when:** componente renderiza sem prop obrigatória; segue padrão visual do tema.
- **Verify:** `npm run typecheck` verde + render manual no paywall/CTA. (UI: manual)

## T10 — Tela `app/paywall.tsx` + rota modal
- **What:** Paywall contextual por `feature`; modo aluno sem compra; CTA "em breve". ([PAY]-04, [PAY]-10)
- **Where:** `app/paywall.tsx` (novo): `useLocalSearchParams<{feature?}>`, `useProfile()` p/ `role==='aluno'`, `paywallContent(feature)`, `Screen variant="violet"` + `Card` + `Button`. CTA → `useAlert().showAlert({type:'info', title:'Em breve', ...})`. Aluno → esconde CTA, copy "fale com seu professor". Fechar → `router.back()`. Em `app/_layout.tsx`: converter `<Stack .../>` em `<Stack ...><Stack.Screen name="paywall" options={{ presentation:'modal', animation:'slide_from_bottom' }} /></Stack>`.
- **Depends:** T2, T7
- **Done-when:** `router.push('/paywall?feature=chat')` abre modal com conteúdo certo; aluno não vê CTA; fecha por gesto/botão.
- **Verify:** typecheck verde + abrir via deep-link/navegação no app (UAT manual).

## T11 — Gating Chat IA
- **What:** Bloqueio proativo + reativo no chat. ([PAY]-06)
- **Where:** `src/hooks/useChat.ts`: no `catch`, `if (handleNeedsUpgrade(err)) return;` antes do `setLastError`/`captureError`. `app/(tabs)/chat.tsx`: ler `useEntitlement()`; se `!isLoading && !ai_personal` → input vira card bloqueado com `ProBadge` que chama `openPaywall('chat')` e `sendMessage` não dispara; senão inalterado (C6: não bloquear em loading).
- **Depends:** T5, T6, T9, T10
- **Done-when:** sem `ai_personal` o envio não dispara e leva ao paywall; com direito, chat normal; 402 de corrida cai no paywall (não erro inline).
- **Verify:** UAT manual (usuário free vs com direito).

## T12 — Gating Sanity check
- **What:** Bloqueio proativo + reativo. ([PAY]-07)
- **Where:** `app/sanity-check.tsx`: `useEntitlement()`; sem `ai_personal` → CTA principal bloqueado + `ProBadge` → `openPaywall('sanity_check')`; catch da ação → `if (handleNeedsUpgrade(err)) return;`.
- **Depends:** T5, T6, T9, T10
- **Done-when:** sem direito não dispara e vai ao paywall; com direito inalterado.
- **Verify:** UAT manual.

## T13 — Gating área do coach (IA + limite de alunos)
- **What:** `ai_coach` no "gerar plano IA" + `student_limit` na criação. ([PAY]-08, [PAY]-09)
- **Where:** `app/(coach)/aluno-novo.tsx`: `useEntitlement()` + `useStudents()` (count). Botão "cadastrar e gerar plano com IA": se `!ai_coach` → `ProBadge` + `openPaywall('coach_generate_plan')` (mantém caminho **sem IA** disponível). Se `isStudentLimitReached(count, student_limit)` → CTA criar bloqueado + aviso → `openPaywall('student_limit')`. `handleCreateAndGenerate` catch → `if (handleNeedsUpgrade(err)) return;` antes de `alert.showError`.
- **Depends:** T5, T6, T8, T9, T10
- **Done-when:** prof sem `ai_coach` é levado ao paywall ao tentar IA, mas cadastra sem IA; no limite, criação bloqueada → paywall; premium nunca bloqueia.
- **Verify:** UAT manual (prof free vs pro vs premium).

## T14 — Gating Import treino IA
- **What:** `ai_coach` proativo + reativo. ([PAY]-08)
- **Where:** `app/(coach)/import-workout.tsx`: `useEntitlement()`; sem `ai_coach` → CTA "gerar com IA" com `ProBadge` → `openPaywall('coach_import_workout')`; `handleGenerate` catch → `if (handleNeedsUpgrade(err)) return;`.
- **Depends:** T5, T6, T9, T10
- **Done-when:** sem `ai_coach` vai ao paywall; com direito inalterado.
- **Verify:** UAT manual.

---

## Ordem sugerida
1. **Fundação (paralelo):** T1, T2, T9.
2. **Lógica TDD (após T1):** T3, T7, T8 `[P]`; depois T6 (após T3).
3. **Serviços:** T4 (após T3), T5 (após T2).
4. **Paywall:** T10 (após T2, T7).
5. **Gating (após T5,T6,T9,T10):** T11, T12, T13 (+T8), T14.

## Cobertura spec → tasks
| Req | Tasks |
|-----|-------|
| [PAY]-01 | T5 |
| [PAY]-02 | T2 |
| [PAY]-03 | T3, T4 |
| [PAY]-04 | T7, T10 |
| [PAY]-05 | T6 |
| [PAY]-06 | T11 |
| [PAY]-07 | T12 |
| [PAY]-08 | T13, T14 |
| [PAY]-09 | T8, T13 |
| [PAY]-10 | T10 |

## Gate de deploy (pós-merge)
Fechar a branch dispara o deploy conjunto do billing-core (#1): `npm run db:push` + `npm run fn:deploy`
(VERIFY.md §4 do #1). Esta feature é o pré-requisito de UI que destrava aquele CONCERN.
