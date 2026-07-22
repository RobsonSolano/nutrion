# Design — paywall-ui

> Arquitetura da spec #2. Consome o contrato do `billing-core` (#1) no cliente RN.
> Cinco camadas, do dado até a UI. Decisões em `context.md` (C1–C7).

## Visão geral (camadas)

```
[RPC resolve_entitlement] ──> (1) leitura: useEntitlement() ──┐
                                                              ├─> (5) gating proativo nas superfícies
[402 needs_upgrade] ──> (2) NeedsUpgradeError ──> (3) handleNeedsUpgrade ──> (4) app/paywall.tsx
```

- **(1) Leitura** — hook React Query lê o entitlement; superfícies marcam CTAs.
- **(2) Detecção** — camada de serviço converte `402 needs_upgrade` em erro tipado.
- **(3) Roteamento** — helper único decide "abre paywall" vs "erro normal".
- **(4) Paywall** — rota modal contextual por `feature`.
- **(5) Proativo** — superfícies leem (1) e bloqueiam antes de disparar; (2)+(3) são a rede.

---

## (1) Leitura de entitlement — [PAY]-01, [PAY]-02

**`src/types/billing.ts`** (novo) — fonte única do tipo no cliente:
```ts
export type Tier = 'free' | 'pro' | 'premium';
export type EntitlementSource =
  | 'store_play' | 'store_apple' | 'stripe' | 'server_trial' | 'grandfather' | 'none';
export type Entitlement = {
  tier: Tier;
  source: EntitlementSource;
  ai_personal: boolean;
  ai_coach: boolean;
  student_limit: number | null;
  trial_end: string | null;
};
export type FeatureKey =
  | 'chat' | 'sanity_check' | 'coach_generate_plan' | 'coach_import_workout' | 'student_limit';
```

**`src/services/entitlement.ts`** (novo):
```ts
export async function fetchEntitlement(): Promise<Entitlement> {
  const { data, error } = await supabase.rpc('resolve_entitlement');
  if (error) throw error;
  return data as Entitlement;
}
```

**`src/hooks/useEntitlement.ts`** (novo) — espelha o padrão de `useProfile`:
```ts
export function useEntitlement() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? queryKeys.entitlement(userId) : ['entitlement', 'none'],
    queryFn: fetchEntitlement,
    enabled: !!userId,
    staleTime: 60_000, // entitlement muda raramente na sessão; 1 min evita refetch a cada foco
  });
}
```
- Invalidação login/logout: a query é keyed por `userId` + `enabled: !!userId` (mesmo padrão de
  `useProfile`) → logout desabilita, outro usuário usa outra key. Sem vazamento. ([PAY]-01)
- Adicionar a `src/lib/queryKeys.ts`: `entitlement: (userId: string) => ['entitlement', userId] as const`.

## (2) Detecção do 402 → NeedsUpgradeError — [PAY]-03

**`src/lib/needsUpgrade.ts`** (novo) — lógica pura, testável:
```ts
export class NeedsUpgradeError extends Error {
  feature: string;
  constructor(feature: string) { super('needs_upgrade'); this.name = 'NeedsUpgradeError'; this.feature = feature; }
}
// p/ callers fetch (chat.ts, students.ts): recebe status + texto do body
export function parseNeedsUpgrade(status: number, bodyText: string): NeedsUpgradeError | null {
  if (status !== 402) return null;
  try {
    const b = JSON.parse(bodyText);
    if (b?.error === 'needs_upgrade' && typeof b.feature === 'string') return new NeedsUpgradeError(b.feature);
  } catch { /* não-JSON: não é o nosso shape */ }
  return null;
}
// p/ caller invoke (workoutImport.ts): lê o body via FunctionsHttpError.context (Response)
export async function needsUpgradeFromInvokeError(error: unknown): Promise<NeedsUpgradeError | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (!(ctx instanceof Response) || ctx.status !== 402) return null;
  try { return parseNeedsUpgrade(402, await ctx.text()); } catch { return null; }
}
```

**Wiring (3 sites):**
- `src/services/chat.ts` — no bloco `if (!res.ok)`, **antes** dos demais ramos:
  `const nu = parseNeedsUpgrade(res.status, text); if (nu) throw nu;` (já existe `const text = await res.text()`).
- `src/services/students.ts` `callFn` — idem no `if (!res.ok)` (cobre `coach-generate-plan` e `coach-create-student`).
- `src/services/workoutImport.ts` `importWorkoutFromAi` — após `if (error)`:
  `const nu = await needsUpgradeFromInvokeError(error); if (nu) throw nu; throw error;`
  (único site `invoke` gated; `coach-apply-template`/`coach-save-*` não têm gating).

> Nota: o `invoke` do supabase-js expõe o `Response` cru em `FunctionsHttpError.context`
> (body não consumido) — por isso `await ctx.text()` funciona. Confirmar versão em Execute.

## (3) Roteamento — [PAY]-05

**`src/lib/paywall.ts`** (novo) — usa o `router` imperativo do expo-router:
```ts
import { router } from 'expo-router';
export function openPaywall(feature: string) {
  router.push({ pathname: '/paywall', params: { feature } });
}
export function handleNeedsUpgrade(err: unknown): boolean {
  if (err instanceof NeedsUpgradeError) { openPaywall(err.feature); return true; }
  return false;
}
```
- Uso nos call sites (reativo): `catch (err) { if (handleNeedsUpgrade(err)) return; /* fluxo de erro atual */ }`.

## (4) Paywall — [PAY]-04, [PAY]-10

**`src/lib/paywallContent.ts`** (novo) — mapeamento puro (testável):
```ts
type PaywallContent = { title: string; subtitle: string; bullets: string[]; planLabel: string; priceHint: string };
// feature → conteúdo. chat/sanity_check => "Pessoal Pro"; coach_* => "Professor Pro"; student_limit => "mais alunos".
export function paywallContent(feature: string | undefined): PaywallContent { /* switch com default seguro */ }
```
- `priceHint` = texto **indicativo** marcado placeholder (C5): `'a partir de R$ 15,90/mês'` — comentário
  no código apontando que a offering real vem da #5 (RevenueCat).

**`app/paywall.tsx`** (novo, rota modal):
- `const { feature } = useLocalSearchParams<{ feature?: string }>();`
- `const { data: profile } = useProfile();` → `isAluno = profile?.role === 'aluno'`.
- Layout com `Screen variant="violet"` + `Card`s; bullets de benefício; header com botão fechar (`router.back()`).
- **CTA (C1):** `Button` "Quero assinar" → `onPress` mostra `useAlert().showAlert({ type:'info', title:'Em breve', message:'A assinatura está a caminho. Avisaremos quando abrir.' })`. Sem fluxo de compra.
- **Modo aluno (C4/[PAY]-10):** se `isAluno` → esconde o CTA de compra; mostra copy
  "Seu acesso à IA depende do plano do seu professor. Fale com ele(a)."
- Registro da rota: em `app/_layout.tsx`, converter `<Stack .../>` para ter filho
  `<Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />`
  (demais rotas continuam auto-registradas pelo file-based routing).

## (5) Gating proativo nas superfícies — [PAY]-06..09

> Regra transversal (C6): enquanto `useEntitlement().isLoading`, **não** bloquear (CTA normal).
> Bloqueio só com dado resolvido. O `402`+`handleNeedsUpgrade` é a rede em todos.

**Componente compartilhado `src/components/ui/ProBadge.tsx`** (novo) — pílula "PRO"
(tema: fundo `violet`/`accent`, texto pequeno). Usado nos CTAs bloqueados.

**`src/lib/studentLimit.ts`** (novo) — regra pura (testável):
```ts
export function isStudentLimitReached(count: number, limit: number | null): boolean {
  return limit !== null && count >= limit;
}
```

| Superfície | Arquivo | Direito | Bloqueio proativo | Reativo (catch) |
|---|---|---|---|---|
| Chat IA | `app/(tabs)/chat.tsx` + `src/hooks/useChat.ts` | `ai_personal` | input vira "card bloqueado" + `ProBadge`; tap → `openPaywall('chat')`; `sendMessage` early-return se sem direito | `useChat` catch: `if (handleNeedsUpgrade(err)) return;` antes de `setLastError` |
| Sanity check | `app/sanity-check.tsx` | `ai_personal` | CTA principal bloqueado + `ProBadge` → `openPaywall('sanity_check')` | catch → `handleNeedsUpgrade` |
| Gerar plano IA | `app/(coach)/aluno-novo.tsx` | `ai_coach` | botão "gerar plano com IA" com `ProBadge` → paywall; caminho **sem IA** (cadastrar/ skip) permanece | `handleCreateAndGenerate` catch → `handleNeedsUpgrade` |
| Import treino IA | `app/(coach)/import-workout.tsx` | `ai_coach` | CTA "gerar com IA" com `ProBadge` → paywall | `handleGenerate` catch → `handleNeedsUpgrade` |
| Limite de alunos | `app/(coach)/aluno-novo.tsx` | `student_limit` | se `isStudentLimitReached(useStudents.count, student_limit)` → CTA criar bloqueado + aviso → `openPaywall('student_limit')` | catch (`402 student_limit`) → `handleNeedsUpgrade` |

- Contagem de alunos: reusar `useStudents()` (já lista; `.length`) — sem nova query.

## Arquivos (novos vs tocados)

**Novos:** `src/types/billing.ts`, `src/services/entitlement.ts`, `src/hooks/useEntitlement.ts`,
`src/lib/needsUpgrade.ts`, `src/lib/paywall.ts`, `src/lib/paywallContent.ts`, `src/lib/studentLimit.ts`,
`src/components/ui/ProBadge.tsx`, `app/paywall.tsx`.

**Tocados:** `src/lib/queryKeys.ts` (+entitlement), `src/services/chat.ts`, `src/services/students.ts`,
`src/services/workoutImport.ts`, `src/hooks/useChat.ts`, `app/_layout.tsx` (+rota modal),
`app/(tabs)/chat.tsx`, `app/sanity-check.tsx`, `app/(coach)/aluno-novo.tsx`, `app/(coach)/import-workout.tsx`.

## Estratégia de testes — DECISÃO PENDENTE

O projeto **não tem runner de testes JS** (sem jest/vitest; só `test:e2e` custom e testes SQL).
A spec pede TDD na lógica. A lógica pura desta feature é pequena e sem deps de RN:
`needsUpgrade.ts`, `paywallContent.ts`, `studentLimit.ts`, `handleNeedsUpgrade`.

Duas opções (ver pergunta ao dev no fim do Design):
- **A (recomendada):** introduzir **vitest** mínimo escopado a `src/lib` (lógica pura, sem JSX/RN) +
  script `test`. TDD real nas 4 unidades de lógica. UI segue verificação manual + typecheck.
- **B:** sem runner; validar lógica por `typecheck` + verificação manual/e2e. Mais rápido, sem
  cobertura automatizada da lógica de billing.

## Riscos / arestas

- **`FunctionsHttpError.context`**: confirmar no Execute que a versão do supabase-js expõe o
  `Response` com body legível (senão, migrar `importWorkoutFromAi` pro padrão `fetch` direto como `chat.ts`).
- **Deploy conjunto (CONCERN #1):** ao fechar a branch, `db:push` + `fn:deploy` do billing-core vão
  **junto** deste build (VERIFY.md §4). Esta spec é o pré-requisito que destrava aquele deploy.
- **Flash de cadeado:** mitigado por C6 (não bloquear em loading).
- **Aluno sem coach / coach free:** `ai_personal=false` → paywall em modo aluno (sem compra).
