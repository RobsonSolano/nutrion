# Tasks — billing-core

> Design dobrado inline (arquitetura já resolvida na spec + decisões D1–D5).
> Ordem por dependência: A → B → C → D. D é paralelizável ([P]).
> Código abaixo é **referência**, não copy-paste — seguir convenções reais do projeto.

## Design inline

### Algoritmo do `resolve_entitlement`

Separar **core testável** (uid explícito) do **wrapper público** (no-arg, usa `auth.uid()`):

```
public._resolve_entitlement(p_uid uuid) returns json   -- SECURITY DEFINER, lógica
public.resolve_entitlement()         returns json   -- SECURITY DEFINER, = _resolve_entitlement(auth.uid())
```

Lógica do core (`p_uid`):
```
profile = (role, coach_id, is_early_adopter) de profiles where id = p_uid
sub     = (tier, source, status, trial_end) de subscriptions where user_id = p_uid  -- pode ser null

trial_active   = sub.source='server_trial' AND sub.status='in_trial' AND sub.trial_end > now()
paid_access    = sub.status IN ('active','in_trial') AND sub.tier IN ('pro','premium')
is_grandfather = sub.source='grandfather' OR profile.is_early_adopter   -- D2/D3

tier_out   = CASE WHEN paid_access THEN sub.tier ELSE 'free' END
source_out = COALESCE(sub.source, 'none')

role = 'comum'    → ai_personal = paid_access OR trial_active OR is_grandfather
                    ai_coach = false ; student_limit = null
role = 'professor'→ ai_personal = paid_access OR trial_active OR is_grandfather
                    ai_coach     = paid_access OR trial_active          -- NÃO grandfather (D3)
                    student_limit = CASE tier_out WHEN 'premium' THEN null
                                                  WHEN 'pro'     THEN 20
                                                  ELSE 5 END            -- free/grandfather = 5 (D3)
role = 'aluno'    → ai_personal = (_resolve_entitlement(profile.coach_id)).ai_personal  -- herança (D5)
                    se coach_id null → ai_personal=false
                    ai_coach=false ; student_limit=null
trial_end_out = sub.trial_end (ou null)
```

### Interface do helper `_shared/entitlement.ts`

```ts
export type Entitlement = {
  tier: 'free'|'pro'|'premium';
  source: 'store_play'|'store_apple'|'stripe'|'server_trial'|'grandfather'|'none';
  ai_personal: boolean;
  ai_coach: boolean;
  student_limit: number | null;
  trial_end: string | null;
};
// Chama a RPC com o JWT do usuário (client criado com o Authorization do request).
export async function getEntitlement(supabase: SupabaseClient): Promise<Entitlement>;
// Resposta padrão de bloqueio (reutilizável nas functions).
export function needsUpgrade(feature: string): Response; // 402 { error:'needs_upgrade', feature }
```

### Template de gating (mesmo padrão nas 5 functions)

```ts
import { getEntitlement, needsUpgrade } from '../_shared/entitlement.ts';
// ...após getUser() e antes de gastar token / criar recurso:
const ent = await getEntitlement(supabase);
if (!ent.ai_personal) return needsUpgrade('chat');   // ajustar flag+feature por função
```

---

## Task A — Migration: `subscriptions` + RLS + backfill grandfather  ([BILL]-01,02,03)

- **What:** Criar tabela `subscriptions`, RLS (dono lê; escrita só service_role) e backfill `source='grandfather'` pra todo profile existente.
- **Where:** `supabase/migrations/2026062210XXXX_billing_core.sql` (timestamp > último migration `20260602`).
- **Depends:** —
- **Done when:**
  - Tabela criada com checks/defaults da spec.
  - RLS: policy select `auth.uid()=user_id`; sem policy de insert/update/delete pro role `authenticated` (escrita só service_role bypassa RLS).
  - `insert into subscriptions (user_id, tier, source) select id, 'free', 'grandfather' from profiles on conflict do nothing`.
- **Verify:** rodar a migration local (`supabase db reset` ou aplicar) sem erro; `select count(*) from subscriptions` == `select count(*) from profiles`; tentar `insert` como usuário comum falha por RLS.
- **Código de referência:**
```sql
create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro','premium')),
  source text check (source in ('store_play','store_apple','stripe','server_trial','grandfather')),
  status text not null default 'active' check (status in ('active','in_trial','canceled','expired')),
  trial_end timestamptz,
  period_end timestamptz,
  rc_app_user_id text,
  trial_consumed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- (sem policies de escrita: service_role ignora RLS; client não escreve)
insert into public.subscriptions (user_id, tier, source, status)
  select id, 'free', 'grandfather', 'active' from public.profiles
  on conflict (user_id) do nothing;
```

## Task B — `resolve_entitlement` + teste SQL (TDD: RED → GREEN)  ([BILL]-04,05,06)

- **What:** Implementar core + wrapper conforme o design; escrever **primeiro** o teste SQL que seeda os 7 estados e valida o retorno.
- **Where:** RPC na mesma migration de A (ou `2026062210XXXX_resolve_entitlement.sql`); teste em `supabase/tests/resolve_entitlement.test.sql`.
- **Depends:** A.
- **Done when:**
  - Teste SQL existe e cobre: comum free / comum grandfather / comum trial ativo / comum trial expirado / aluno c/ coach grandfather / professor free-grandfather (ai_coach=false, limit=5) / professor pro (ai_coach=true, limit=20) / professor premium (limit=null).
  - `_resolve_entitlement(uid)` e `resolve_entitlement()` criados (SECURITY DEFINER, `set search_path = public`).
  - Teste passa (GREEN) com saída fresca.
- **Verify:** rodar o `.test.sql` via `psql`/supabase e colar a saída (todas asserções `PASS`). Iron Law: evidência antes de marcar feito.
- **Nota TDD:** escrever o teste, rodar e ver **falhar** (RED, função inexistente), então implementar até GREEN.

## Task C — Helper `_shared/entitlement.ts`  ([BILL]-07)

- **What:** `getEntitlement(supabase)` (chama RPC) + `needsUpgrade(feature)` (Response 402).
- **Where:** `supabase/functions/_shared/entitlement.ts`.
- **Depends:** B (RPC precisa existir).
- **Done when:** funções exportadas conforme interface; tipo `Entitlement` exportado.
- **Verify:** `npm run typecheck` (ou deno check do arquivo) sem erro; revisão de que usa o client com Authorization do request.

## Task D — Gating nas 5 edge functions  ([BILL]-08,09,10,11,12)  [P]

> Paralelizável: arquivos distintos, mesmo template. Cada uma: importar helper →
> após `getUser()`, antes de gastar token/criar → checar flag → `needsUpgrade`.

- **D1 [BILL]-08/09** `chat-ai`: `chat` e `sanity_check` exigem `ai_personal`. feature `'chat'` / `'sanity_check'`. Inserir **antes** das cotas/Groq.
- **D2 [BILL]-10** `coach-generate-plan`: exige `ai_coach`. feature `'coach_generate_plan'`.
- **D3 [BILL]-11** `coach-import-workout-ai`: exige `ai_coach`. feature `'coach_import_workout'`.
- **D4 [BILL]-12** `coach-create-student`: trocar `coaches.max_students` por `getEntitlement().student_limit`; se `student_limit` não-null e `count >= student_limit` → `needsUpgrade('student_limit')`; se null, nunca bloqueia.
- **Depends:** C.
- **Done when:** cada função importa o helper e bloqueia corretamente sem gastar recurso; padrão 402 consistente.
- **Verify:** `npm run typecheck` + `npm run lint`; inspeção do diff (check antes do custo); e2e/manual de um caso bloqueado e um liberado.
- **Dispatch:** subagentes paralelos (modelo barato) com o template exato; seguidos de review de consistência (1 subagente) antes do /simplify.

---

## Pós-execução (gates)
1. `/simplify` sobre o diff acumulado.
2. `npm run typecheck && npm run lint` (+ teste SQL do RPC) — evidência fresca.
3. Docs: atualizar `.specs/codebase/` se necessário; STATE.md com o CONCERN de ordem de deploy.
4. Commits divididos (A / B / C+D) — perguntar ao dev.

## Rastreabilidade → ver `spec.md` (atualizar status conforme conclui cada task)
