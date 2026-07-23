# Suspensão de alunos excedentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o downgrade destrutivo (deletar alunos) por **suspensão reversível**: alunos excedentes ficam bloqueados (dado preservado), o professor escolhe quais ficam ativos, e upgrade reativa todos.

**Architecture:** Estado persistido em `profiles.suspended_at` + RPC reconciliadora `sync_coach_student_access` (determinística, idempotente, auto-curável) disparada por webhook/edge functions/bootstrap. Aluno suspenso é barrado no `(tabs)/_layout` e mandado pra rota `/suspended`. Professor gerencia ativos na tela `escolher-alunos` (agora seletor de ativos, não mais deleção).

**Tech Stack:** Expo/React Native (expo-router, nativewind, @tanstack/react-query), Supabase (Postgres/plpgsql RPC, edge functions Deno), vitest.

## Global Constraints

- **OTA-only:** entrega no app via `eas update`. **Zero dependência nativa nova.** `version`/runtime fica em **1.3.0** (não bumpar nativo).
- **Backend deploy separado:** migration via `supabase db push`; edge functions via `supabase functions deploy <nome>`.
- **Segredos:** nunca colocar `SUPABASE_SERVICE_ROLE_KEY`/`GROQ_*` no app nem no EAS env. Edge functions leem via `Deno.env`.
- **Node 20+** (nvm) em qualquer comando Bash.
- **Limites por tier (fonte: `_resolve_entitlement`):** free/grandfather = 2, pro = 5, premium = ilimitado (`student_limit = null`).
- **Grandfather é isento** de suspensão (mantém todos ativos), consistente com `src/lib/downgrade.ts`.
- **Suspensão ≠ desvínculo (unlink):** unlink continua existindo, é voluntário, notifica o aluno e o torna `comum`. Não mexer nele além de disparar a reconciliação.
- Copy em pt-BR, seguindo o tom do app.

---

### Task 1: Migration — coluna `suspended_at` + RPCs de reconciliação

**Files:**
- Create: `supabase/migrations/20260723000000_student_suspension.sql`

**Interfaces:**
- Produces (SQL):
  - `public.sync_coach_student_access(p_coach_id uuid) returns void` — reconcilia ativos/suspensos do professor conforme o limite do tier. SECURITY DEFINER. Grant: `authenticated`, `service_role`.
  - `public.check_and_sync_my_suspension() returns boolean` — para o aluno logado (`auth.uid()`): reconcilia via o coach dele e retorna se ELE está suspenso. SECURITY DEFINER. Grant: `authenticated`.
  - Coluna `public.profiles.suspended_at timestamptz null` (null = ativo).

- [ ] **Step 1: Escrever a migration completa**

Create `supabase/migrations/20260723000000_student_suspension.sql`:

```sql
-- =====================================================================
-- Persona Fit — Suspensão de alunos excedentes (downgrade não-destrutivo)
-- Substitui a deleção forçada por suspensão reversível. Fonte da verdade:
-- profiles.suspended_at (null = ativo). Reconciliação determinística e
-- idempotente via sync_coach_student_access, disparada por webhook/edge/bootstrap.
-- =====================================================================

-- 1. Coluna de estado + índice parcial (consulta do painel do professor).
alter table public.profiles
  add column if not exists suspended_at timestamptz;

create index if not exists idx_profiles_coach_suspended
  on public.profiles (coach_id)
  where suspended_at is not null;

-- 2. Reconciliador. Determinístico + idempotente:
--    - premium (limit null) ou grandfather -> todos ativos
--    - senão: mantém até L ativos (preserva escolha atual), suspende os
--      ativos MAIS RECENTES além de L, e preenche vagas com os suspensos
--      MAIS ANTIGOS. Rodar de novo sem mudança externa não altera nada.
create or replace function public.sync_coach_student_access(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ent json;
  v_source text;
  v_limit int;
  v_active int;
begin
  if p_coach_id is null then
    return;
  end if;

  select role into v_role from public.profiles where id = p_coach_id;
  if v_role is distinct from 'professor' then
    return;
  end if;

  v_ent := public._resolve_entitlement(p_coach_id);
  v_source := v_ent ->> 'source';
  v_limit := nullif(v_ent ->> 'student_limit', '')::int;  -- null = ilimitado

  -- Premium (ilimitado) ou grandfather: todos ativos.
  if v_limit is null or v_source = 'grandfather' then
    update public.profiles
       set suspended_at = null
     where coach_id = p_coach_id
       and role = 'aluno'
       and suspended_at is not null;
    return;
  end if;

  -- 1. Ativos além do limite: suspende os MAIS RECENTES (preserva os L mais antigos ativos).
  update public.profiles
     set suspended_at = now()
   where id in (
     select id
       from public.profiles
      where coach_id = p_coach_id and role = 'aluno' and suspended_at is null
      order by created_at asc, id asc
      offset v_limit
   );

  -- 2. Vagas livres: reativa os suspensos MAIS ANTIGOS até preencher L.
  select count(*) into v_active
    from public.profiles
   where coach_id = p_coach_id and role = 'aluno' and suspended_at is null;

  update public.profiles
     set suspended_at = null
   where id in (
     select id
       from public.profiles
      where coach_id = p_coach_id and role = 'aluno' and suspended_at is not null
      order by created_at asc, id asc
      limit greatest(0, v_limit - v_active)
   );
end;
$$;

-- 3. Check + auto-cura para o aluno logado.
create or replace function public.check_and_sync_my_suspension()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_coach uuid;
  v_suspended timestamptz;
begin
  if v_uid is null then
    return false;
  end if;

  select role, coach_id into v_role, v_coach
    from public.profiles where id = v_uid;

  if v_role is distinct from 'aluno' then
    return false;
  end if;

  if v_coach is not null then
    perform public.sync_coach_student_access(v_coach);
  end if;

  select suspended_at into v_suspended
    from public.profiles where id = v_uid;

  return v_suspended is not null;
end;
$$;

grant execute on function public.sync_coach_student_access(uuid) to authenticated, service_role;
grant execute on function public.check_and_sync_my_suspension() to authenticated;
```

- [ ] **Step 2: Aplicar a migration no banco**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx supabase db push`
Expected: aplica `20260723000000_student_suspension.sql` sem erro; `supabase migration list` mostra a migration como aplicada (local+remote).

- [ ] **Step 3: Verificar a reconciliação (teste via service role)**

Escolha um professor de teste com ≥3 alunos (ex.: o professor validado ontem). Rode as queries abaixo no SQL editor do Supabase (ou psql com service role), substituindo `:coach`:

```sql
-- estado antes
select id, full_name, created_at, suspended_at
  from profiles where coach_id = ':coach' and role = 'aluno'
  order by created_at asc;

-- força tier free no professor e reconcilia
select public.sync_coach_student_access(':coach');

-- estado depois: os 2 mais antigos suspended_at = null, o resto = now()
select id, full_name, created_at, suspended_at
  from profiles where coach_id = ':coach' and role = 'aluno'
  order by created_at asc;
```
Expected: com limite 2, exatamente os 2 alunos mais antigos ficam com `suspended_at IS NULL`; os demais com timestamp. Rodar `sync_coach_student_access` de novo NÃO muda nada (idempotência).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723000000_student_suspension.sql
git commit -m "feat(db): suspensão reversível de alunos (coluna + RPCs de reconciliação)"
```

---

### Task 2: Disparar reconciliação no webhook do RevenueCat

**Files:**
- Modify: `supabase/functions/revenuecat-webhook/index.ts:36-55`

**Interfaces:**
- Consumes: `sync_coach_student_access(uuid)` (Task 1).

- [ ] **Step 1: Chamar a RPC após o upsert bem-sucedido**

Em `supabase/functions/revenuecat-webhook/index.ts`, substituir o bloco final (linhas 49-55) por:

```ts
  if (error) {
    // FK (user inexistente) ou outro erro: loga e dá ack 200 pra não travar o RevenueCat.
    console.error('[revenuecat-webhook] upsert falhou:', error.message);
    return new Response('ok', { status: 200 });
  }

  // Reconcilia acesso dos alunos se o assinante for professor (no-op caso contrário).
  // Downgrade -> suspende excedente; upgrade -> reativa todos. Best-effort (não trava o ack).
  const { error: syncErr } = await supa.rpc('sync_coach_student_access', {
    p_coach_id: mapped.userId,
  });
  if (syncErr) {
    console.error('[revenuecat-webhook] sync_coach_student_access:', syncErr.message);
  }

  return new Response('ok', { status: 200 });
```

- [ ] **Step 2: Deploy da function**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx supabase functions deploy revenuecat-webhook --no-verify-jwt`
Expected: deploy OK (mantém `--no-verify-jwt` — o webhook autentica por header secreto).

- [ ] **Step 3: Verificar via log (manual, no E2E da Task 13)**

Deferido pro teste E2E (downgrade real → EXPIRATION → webhook → alunos suspensos). Aqui só garantir que o deploy subiu sem erro.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/revenuecat-webhook/index.ts
git commit -m "feat(webhook): reconcilia acesso dos alunos após mudança de assinatura"
```

---

### Task 3: Reconciliar ao desvincular aluno (libera vaga)

**Files:**
- Modify: `supabase/functions/coach-unlink-student/index.ts:135-170`

**Interfaces:**
- Consumes: `sync_coach_student_access(uuid)` (Task 1).

- [ ] **Step 1: Chamar a RPC após o desvínculo (antes do push)**

Em `supabase/functions/coach-unlink-student/index.ts`, logo após o bloco do `grant_server_trial` (linha 148, antes do cálculo de `daysWithCoach`), inserir:

```ts
    // Desvincular liberou uma vaga: reconcilia pra reativar o suspenso mais antigo (se houver).
    // Best-effort: não impacta o retorno do desvínculo.
    try {
      const { error: syncErr } = await supaService.rpc('sync_coach_student_access', {
        p_coach_id: caller.id,
      });
      if (syncErr) {
        console.error('[coach-unlink] sync_coach_student_access:', syncErr.message);
      }
    } catch (err) {
      console.error('[coach-unlink] sync falhou:', err);
    }
```

- [ ] **Step 2: Deploy**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx supabase functions deploy coach-unlink-student`
Expected: deploy OK.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/coach-unlink-student/index.ts
git commit -m "feat(unlink): reconcilia acesso após desvincular (reativa próximo da fila)"
```

---

### Task 4: Edge function `coach-set-active-students` (aplica o conjunto de ativos)

**Files:**
- Create: `supabase/functions/coach-set-active-students/index.ts`
- Modify: `package.json:fn:deploy` (adicionar a nova function à lista)

**Interfaces:**
- Consumes: `sync_coach_student_access(uuid)` (Task 1).
- Produces (HTTP): `POST coach-set-active-students` body `{ active_ids: string[] }` → `{ ok: true }`. Erros: `401 unauthorized`, `400 invalid_body`, `403 forbidden` (algum id não é aluno do caller), `402 needs_upgrade` (|active_ids| > limite).

- [ ] **Step 1: Escrever a function**

Create `supabase/functions/coach-set-active-students/index.ts`:

```ts
// Persona Fit — Edge Function coach-set-active-students
//
// Recebe o CONJUNTO de alunos que devem ficar ATIVOS. Marca os de fora como
// suspensos e os de dentro como ativos, depois chama sync_coach_student_access
// pra normalizar contra o limite do tier. Caminho único (sem toggle 1-a-1).

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = { active_ids: string[] };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'unauthorized' }, 401);
    }

    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supaService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await supaAuth.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || !Array.isArray(body.active_ids)) {
      return json({ error: 'invalid_body', detail: 'active_ids obrigatório.' }, 400);
    }
    const activeIds = [...new Set(body.active_ids)];

    // Limite do tier do professor.
    const { data: ent, error: entErr } = await supaService.rpc(
      '_resolve_entitlement',
      { p_uid: caller.id },
    );
    if (entErr) {
      return json({ error: 'entitlement_failed', detail: entErr.message }, 500);
    }
    const limit = (ent as { student_limit: number | null }).student_limit;
    if (limit !== null && activeIds.length > limit) {
      return json({ error: 'needs_upgrade', feature: 'student_limit' }, 402);
    }

    // Todos os alunos do professor.
    const { data: students, error: studentsErr } = await supaService
      .from('profiles')
      .select('id')
      .eq('coach_id', caller.id)
      .eq('role', 'aluno');
    if (studentsErr) {
      return json({ error: 'load_failed', detail: studentsErr.message }, 500);
    }
    const ownedIds = new Set((students ?? []).map((s) => s.id as string));

    // Ownership: todo active_id precisa ser aluno do caller.
    if (activeIds.some((id) => !ownedIds.has(id))) {
      return json({ error: 'forbidden', detail: 'aluno fora do seu vínculo.' }, 403);
    }

    const suspendIds = [...ownedIds].filter((id) => !activeIds.includes(id));

    // Ativa os do conjunto.
    if (activeIds.length > 0) {
      const { error } = await supaService
        .from('profiles')
        .update({ suspended_at: null })
        .in('id', activeIds)
        .eq('coach_id', caller.id);
      if (error) return json({ error: 'update_failed', detail: error.message }, 500);
    }
    // Suspende o restante.
    if (suspendIds.length > 0) {
      const { error } = await supaService
        .from('profiles')
        .update({ suspended_at: new Date().toISOString() })
        .in('id', suspendIds)
        .eq('coach_id', caller.id)
        .is('suspended_at', null);
      if (error) return json({ error: 'update_failed', detail: error.message }, 500);
    }

    // Normaliza contra o limite (segurança/idempotência).
    const { error: syncErr } = await supaService.rpc('sync_coach_student_access', {
      p_coach_id: caller.id,
    });
    if (syncErr) {
      console.error('[coach-set-active] sync:', syncErr.message);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[coach-set-active-students] unexpected:', err);
    return json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Adicionar à lista de deploy do package.json**

Em `package.json`, no script `fn:deploy`, adicionar ` && supabase functions deploy coach-set-active-students` antes de ` && supabase functions deploy revenuecat-webhook --no-verify-jwt`.

- [ ] **Step 3: Deploy**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx supabase functions deploy coach-set-active-students`
Expected: deploy OK.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/coach-set-active-students/index.ts package.json
git commit -m "feat(fn): coach-set-active-students (aplica conjunto de ativos + reconcilia)"
```

---

### Task 5: Tipos + services do cliente (suspended_at, setActiveStudents, checkMySuspension)

**Files:**
- Modify: `src/types/database.ts` (adicionar `suspended_at` ao `Profile`)
- Modify: `src/services/students.ts:15-25` (StudentLite) e `:141-157` (listStudents) e novo `setActiveStudents`
- Create: `src/services/suspension.ts`

**Interfaces:**
- Produces:
  - `StudentLite` passa a incluir `suspended_at: string | null`.
  - `setActiveStudents(activeIds: string[]): Promise<{ ok: true }>` em `services/students.ts`.
  - `checkMySuspension(): Promise<boolean>` em `services/suspension.ts`.

- [ ] **Step 1: Adicionar `suspended_at` ao tipo Profile**

Em `src/types/database.ts`, localizar o tipo/interface `Profile` e adicionar o campo (junto aos demais campos nullable):

```ts
  suspended_at: string | null;
```

- [ ] **Step 2: Incluir `suspended_at` no StudentLite e no select de listStudents**

Em `src/services/students.ts`, no `StudentLite` (linhas 15-25), adicionar `'suspended_at'` ao `Pick`:

```ts
export type StudentLite = Pick<
  Profile,
  | 'id'
  | 'full_name'
  | 'avatar_url'
  | 'weight_kg'
  | 'height_cm'
  | 'goal_type'
  | 'created_at'
  | 'onboarding_completed_at'
  | 'suspended_at'
>;
```

E no `listStudents` (linha ~149), adicionar `suspended_at` ao `.select(...)`:

```ts
    .select(
      'id, full_name, avatar_url, weight_kg, height_cm, goal_type, created_at, onboarding_completed_at, suspended_at',
    )
```

- [ ] **Step 3: Adicionar `setActiveStudents` ao services/students.ts**

No fim de `src/services/students.ts`, adicionar:

```ts
/**
 * Define o conjunto de alunos ATIVOS do professor. Os de fora ficam suspensos
 * (sem acesso ao app até serem reativados ou o professor fazer upgrade).
 * Substitui a lógica destrutiva de "escolher quem fica" (que desvinculava).
 */
export async function setActiveStudents(
  activeIds: string[],
): Promise<{ ok: true }> {
  return callFn<{ ok: true }>('coach-set-active-students', {
    active_ids: activeIds,
  });
}
```

- [ ] **Step 4: Criar services/suspension.ts**

Create `src/services/suspension.ts`:

```ts
import { supabase } from './supabase';

/**
 * Verifica (e auto-cura) se o aluno logado está suspenso. Chama a RPC
 * check_and_sync_my_suspension, que reconcilia o acesso via o coach do aluno
 * antes de responder — assim um webhook perdido se corrige no próximo acesso.
 */
export async function checkMySuspension(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_and_sync_my_suspension');
  if (error) throw error;
  return data === true;
}
```

- [ ] **Step 5: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/services/students.ts src/services/suspension.ts
git commit -m "feat(services): suspended_at, setActiveStudents e checkMySuspension"
```

---

### Task 6: Lib pura `suspension.ts` (helpers) + testes vitest

**Files:**
- Create: `src/lib/suspension.ts`
- Test: `src/lib/suspension.test.ts`

**Interfaces:**
- Consumes: shape `{ suspended_at: string | null }`.
- Produces:
  - `suspendedCount(students: { suspended_at: string | null }[]): number`
  - `activeIds<T extends { id: string; suspended_at: string | null }>(students: T[]): string[]`

- [ ] **Step 1: Escrever o teste (falhando)**

Create `src/lib/suspension.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activeIds, suspendedCount } from './suspension';

const s = (id: string, suspended: boolean) => ({
  id,
  suspended_at: suspended ? '2026-07-23T00:00:00Z' : null,
});

describe('suspendedCount', () => {
  it('conta só os suspensos', () => {
    expect(suspendedCount([s('a', false), s('b', true), s('c', true)])).toBe(2);
  });
  it('zero quando ninguém suspenso', () => {
    expect(suspendedCount([s('a', false)])).toBe(0);
  });
  it('lista vazia = 0', () => {
    expect(suspendedCount([])).toBe(0);
  });
});

describe('activeIds', () => {
  it('retorna só os ids com suspended_at null', () => {
    expect(activeIds([s('a', false), s('b', true), s('c', false)])).toEqual(['a', 'c']);
  });
  it('lista vazia = []', () => {
    expect(activeIds([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar pra ver falhar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/suspension.test.ts`
Expected: FAIL — `Cannot find module './suspension'`.

- [ ] **Step 3: Implementar**

Create `src/lib/suspension.ts`:

```ts
// Helpers puros de suspensão de alunos. A reconciliação real vive no servidor
// (sync_coach_student_access); aqui só derivamos estado pra UI do professor.

/** Quantos alunos estão suspensos (suspended_at != null). */
export function suspendedCount(students: { suspended_at: string | null }[]): number {
  return students.filter((s) => s.suspended_at != null).length;
}

/** Ids dos alunos atualmente ativos (suspended_at == null). */
export function activeIds<T extends { id: string; suspended_at: string | null }>(
  students: T[],
): string[] {
  return students.filter((s) => s.suspended_at == null).map((s) => s.id);
}
```

- [ ] **Step 4: Rodar pra ver passar**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npx vitest run src/lib/suspension.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/suspension.ts src/lib/suspension.test.ts
git commit -m "feat(lib): helpers puros de suspensão (suspendedCount, activeIds) + testes"
```

---

### Task 7: Hooks — `useStudentSuspension` e `useSetActiveStudents`

**Files:**
- Create: `src/hooks/useStudentSuspension.ts`
- Modify: `src/hooks/useStudents.ts:1-13` (import) e adicionar `useSetActiveStudents`

**Interfaces:**
- Consumes: `checkMySuspension` (Task 5), `setActiveStudents` (Task 5).
- Produces:
  - `useStudentSuspension(enabled: boolean): { suspended: boolean; isChecking: boolean }`
  - `useSetActiveStudents()` — mutation `(activeIds: string[]) => Promise<{ ok: true }>`, invalida `['students', coachId]` e o entitlement.

- [ ] **Step 1: Criar useStudentSuspension**

Create `src/hooks/useStudentSuspension.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { checkMySuspension } from '@/services/suspension';
import { useAuth } from './useAuth';

/**
 * Gate de suspensão do aluno. `enabled` deve ser true só quando role='aluno'.
 * A query chama check_and_sync_my_suspension (auto-cura via o coach). Enquanto
 * resolve, `isChecking` é true — o (tabs)/_layout espera antes de rotear.
 */
export function useStudentSuspension(enabled: boolean): {
  suspended: boolean;
  isChecking: boolean;
} {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ['student-suspension', userId ?? 'none'],
    queryFn: checkMySuspension,
    enabled: enabled && !!userId,
    staleTime: 60_000,
  });

  return {
    suspended: q.data === true,
    isChecking: enabled && !!userId && q.isLoading,
  };
}
```

- [ ] **Step 2: Adicionar useSetActiveStudents ao useStudents.ts**

Em `src/hooks/useStudents.ts`, adicionar `setActiveStudents` ao import de `@/services/students` (linhas 2-13):

```ts
  setActiveStudents,
```

E adicionar o hook (após `useUnlinkStudent`, ~linha 176):

```ts
/**
 * Define o conjunto de alunos ATIVOS (os demais ficam suspensos). Usado pela
 * tela escolher-alunos após um downgrade. Invalida lista + entitlement.
 */
export function useSetActiveStudents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (activeIds: string[]) => setActiveStudents(activeIds),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: studentsKey(user.id) });
        void qc.invalidateQueries({ queryKey: queryKeys.entitlement(user.id) });
      }
    },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros novos. (`queryKeys` já é importado em useStudents.ts:27.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useStudentSuspension.ts src/hooks/useStudents.ts
git commit -m "feat(hooks): useStudentSuspension + useSetActiveStudents"
```

---

### Task 8: Tela `/suspended` (bloqueio total do aluno)

**Files:**
- Create: `app/suspended.tsx`

**Interfaces:**
- Consumes: `useAuth().logout`, componentes `Screen`, `Logo`, `Button`.

- [ ] **Step 1: Criar a tela**

Create `app/suspended.tsx` (molde do `app/consent.tsx`):

```tsx
import { ScrollView, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { Button, Logo, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

/**
 * Bloqueio total do aluno suspenso. Exibido pelo (tabs)/_layout quando
 * check_and_sync_my_suspension retorna true. Sem acesso a treino/histórico:
 * o professor precisa reativar (ou fazer upgrade). Única saída é sair.
 */
export default function SuspendedScreen() {
  const { logout } = useAuth();

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-8">
          <Logo size="lg" />
        </View>

        <View className="items-center mb-6">
          <View className="h-16 w-16 rounded-3xl bg-warn/10 border border-warn/40 items-center justify-center mb-5">
            <Ban size={30} color={colors.warn} />
          </View>
          <Text className="text-text text-xl font-bold text-center mb-2">
            Acesso suspenso
          </Text>
          <Text className="text-text-dim text-sm text-center leading-relaxed">
            Seu professor atingiu o limite de alunos do plano dele. Seu treino e
            seus dados estão guardados — nada foi perdido.
          </Text>
          <Text className="text-text-dim text-sm text-center leading-relaxed mt-3">
            Entre em contato com seu personal/professor pra liberar seu acesso.
          </Text>
        </View>

        <Button label="Sair" onPress={() => void logout()} variant="secondary" size="lg" />
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck (valida imports/props dos componentes ui)**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros. (Se `Logo`/`Screen`/`Button` tiverem props diferentes, alinhar com `app/consent.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add app/suspended.tsx
git commit -m "feat(app): tela /suspended (bloqueio total do aluno suspenso)"
```

---

### Task 9: Gate de suspensão no `(tabs)/_layout`

**Files:**
- Modify: `app/(tabs)/_layout.tsx:15-47`

**Interfaces:**
- Consumes: `useStudentSuspension` (Task 7).

- [ ] **Step 1: Plugar o gate**

Em `app/(tabs)/_layout.tsx`, adicionar o import (junto aos demais hooks, ~linha 8):

```tsx
import { useStudentSuspension } from '@/hooks/useStudentSuspension';
```

Adicionar a chamada do hook no topo do componente (após `const isStudent = ...`, ~linha 21). Chamada incondicional (regra dos hooks), habilitada só pra aluno:

```tsx
  const suspension = useStudentSuspension(isStudent);
```

E inserir o gate DEPOIS do redirect de professor e ANTES do gate de onboarding (entre as linhas 39 e 41):

```tsx
  // Professor não usa as tabs do app — vai pra área do professor.
  if (profileQ.data?.role === 'professor') {
    return <Redirect href={'/(coach)' as Href} />;
  }

  // Aluno suspenso: bloqueio total (acesso liberado só pelo professor/upgrade).
  if (isStudent) {
    if (suspension.isChecking) return null;
    if (suspension.suspended) return <Redirect href={'/suspended' as Href} />;
  }
```

- [ ] **Step 2: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/_layout.tsx"
git commit -m "feat(app): barra aluno suspenso no (tabs)/_layout -> /suspended"
```

---

### Task 10: Home do professor — banner de suspensão + chip na lista + sync-on-open

**Files:**
- Create: `src/hooks/useCoachAccessSync.ts`
- Modify: `app/(coach)/index.tsx` (import, banner 96-109, StudentRow 285-328, chamada do sync)

**Interfaces:**
- Consumes: `suspendedCount` (Task 6), `useCoachAccessSync` (este task), `StudentLite.suspended_at` (Task 5).

- [ ] **Step 1: Criar useCoachAccessSync (rede de segurança)**

Create `src/hooks/useCoachAccessSync.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';

/**
 * Rede de segurança: ao abrir a home do professor, reconcilia o acesso dos
 * alunos (caso um webhook de downgrade/upgrade tenha falhado). Invalida a
 * lista de alunos depois pra refletir suspensões/reativações.
 */
export function useCoachAccessSync(): void {
  const { user } = useAuth();
  const qc = useQueryClient();

  useQuery({
    queryKey: ['coach-access-sync', user?.id ?? 'none'],
    queryFn: async () => {
      const { error } = await supabase.rpc('sync_coach_student_access', {
        p_coach_id: user!.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['students', user!.id] });
      return true;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 2: Home — imports + chamada do sync**

Em `app/(coach)/index.tsx`, adicionar imports:

```tsx
import { suspendedCount } from '@/lib/suspension';
import { useCoachAccessSync } from '@/hooks/useCoachAccessSync';
```

Dentro de `CoachHome`, após `const downgrade = useDowngradeStatus();` (~linha 43), chamar:

```tsx
  useCoachAccessSync();
```

E derivar a contagem de suspensos (após `const studentIds = ...`, ~linha 58):

```tsx
  const suspended = suspendedCount(studentsQ.data ?? []);
```

- [ ] **Step 3: Substituir o banner de downgrade pelo banner de suspensão**

Substituir o bloco `{downgrade.needsChoice && (...)}` (linhas 96-109) por:

```tsx
        {suspended > 0 && (
          <Pressable
            onPress={() => router.push('/(coach)/escolher-alunos' as Href)}
            className="rounded-2xl border border-warn/50 bg-warn/10 px-4 py-3 active:opacity-80"
          >
            <Text className="text-warn text-[13px] font-semibold mb-1">
              ⚠️ {suspended} de {studentsQ.data?.length ?? 0} alunos com acesso suspenso
            </Text>
            <Text className="text-text-dim text-[12px] leading-relaxed">
              Seu plano permite {downgrade.studentLimit} ativos. Escolha quem fica
              ativo ou faça upgrade pra liberar todos. Toque pra resolver.
            </Text>
          </Pressable>
        )}
```

- [ ] **Step 4: StudentRow — indicar suspenso**

Alterar a assinatura de `StudentRow` (linhas 285-296) pra receber `student: StudentLite` (já recebe) e derivar `suspended`. Adicionar, logo após `const initial = ...` (~linha 294):

```tsx
  const suspended = student.suspended_at != null;
```

E adicionar um pill "suspenso" na área de infos. Inserir dentro do `<View className="flex-row items-center gap-2 mt-0.5">` (após o bloco de `weight_kg`, ~linha 322), antes de fechar a View:

```tsx
          {suspended && (
            <View className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5">
              <Text className="text-warn text-[10px] font-bold">suspenso</Text>
            </View>
          )}
```

Opcional (feedback visual): aplicar `opacity-60` ao container quando suspenso — alterar o `className` do `Pressable` raiz de `StudentRow` para incluir `${suspended ? 'opacity-60' : ''}` via template string.

- [ ] **Step 5: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(coach)/index.tsx" src/hooks/useCoachAccessSync.ts
git commit -m "feat(coach): banner de suspensão + chip na lista + sync-on-open"
```

---

### Task 11: `escolher-alunos` vira seletor de ATIVOS (sem deleção)

**Files:**
- Modify: `app/(coach)/escolher-alunos.tsx` (reescrita)

**Interfaces:**
- Consumes: `useSetActiveStudents` (Task 7), `activeIds` (Task 6), `useStudents`, `useDowngradeStatus`.

- [ ] **Step 1: Reescrever a tela**

Substituir todo o conteúdo de `app/(coach)/escolher-alunos.tsx` por:

```tsx
import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Button, Card, Screen } from '@/components/ui';
import Checkbox from '@/components/ui/Checkbox';
import { useStudents, useSetActiveStudents } from '@/hooks/useStudents';
import { useDowngradeStatus } from '@/hooks/useDowngradeStatus';
import { useAlert } from '@/components/GlobalAlertProvider';
import { activeIds } from '@/lib/suspension';
import { colors } from '@/lib/theme';

/**
 * Seletor de alunos ATIVOS após downgrade. O professor marca até `limit`
 * alunos que ficam ativos; os demais ficam suspensos (sem acesso ao app até
 * reativar ou dar upgrade). NÃO desvincula/deleta — suspensão é reversível.
 */
export default function EscolherAlunosScreen() {
  const router = useRouter();
  const alert = useAlert();
  const studentsQ = useStudents();
  const { studentLimit } = useDowngradeStatus();
  const setActive = useSetActiveStudents();

  const students = studentsQ.data ?? [];
  const limit = studentLimit ?? 0;
  const [kept, setKept] = useState<Set<string>>(
    () => new Set(activeIds(students).slice(0, limit)),
  );
  const [working, setWorking] = useState(false);

  const toggle = (id: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < limit) next.add(id); // não passa do limite
      return next;
    });
  };

  const canConfirm = kept.size > 0 && kept.size <= limit && !working;

  async function handleConfirm() {
    setWorking(true);
    try {
      await setActive.mutateAsync(Array.from(kept));
      router.back();
    } catch (err) {
      alert.showError(err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <Text className="text-text font-semibold">Quem fica ativo</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card accent="violet" padding="md">
          <Text className="text-text-dim text-[13px] leading-relaxed">
            Seu plano permite <Text className="text-text font-semibold">{limit}</Text> alunos
            ativos. Marque quem continua com acesso — os não marcados ficam{' '}
            <Text className="text-text font-semibold">suspensos</Text> (sem acesso ao app até
            você reativar ou fazer upgrade). Nada é apagado. Selecionados: {kept.size}/{limit}.
          </Text>
        </Card>

        {students.map((s) => (
          <Card key={s.id} padding="md">
            <Checkbox checked={kept.has(s.id)} onChange={() => toggle(s.id)}>
              <Text className="text-text text-[15px] font-semibold">
                {s.full_name ?? 'Aluno'}
              </Text>
            </Checkbox>
          </Card>
        ))}
      </ScrollView>

      <View className="px-5 pb-2">
        <Button
          label={working ? 'Salvando…' : `Salvar (${kept.size} ativo${kept.size === 1 ? '' : 's'})`}
          onPress={handleConfirm}
          variant="primary"
          size="lg"
          fullWidth
          loading={working}
          disabled={!canConfirm}
        />
      </View>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck`
Expected: sem erros. (Removeu `useUnlinkStudent`, `useQueryClient`, `useAuth`, `queryKeys` que não são mais usados — garantir que não sobraram imports não usados que o lint reprove.)

- [ ] **Step 3: Lint**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run lint`
Expected: sem erros novos em `escolher-alunos.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(coach)/escolher-alunos.tsx"
git commit -m "feat(coach): escolher-alunos vira seletor de ativos (suspende, não deleta)"
```

---

### Task 12: Polish da lista de alunos — altura máx + scroll + filtro (Frente B, independente)

**Files:**
- Modify: `app/(coach)/index.tsx` (bloco da lista de alunos, ~linhas 141-161)

**Interfaces:**
- Consumes: `studentsQ.data` (`StudentLite[]`).

- [ ] **Step 1: Estado do filtro + lista filtrada**

Em `app/(coach)/index.tsx`, adicionar import do `useState` e `TextInput`:

```tsx
import { ScrollView, Text, View, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { useState } from 'react';
```

Dentro de `CoachHome`, adicionar estado (após `const suspended = ...` da Task 10):

```tsx
  const [studentFilter, setStudentFilter] = useState('');
  const allStudents = studentsQ.data ?? [];
  const filteredStudents = studentFilter.trim()
    ? allStudents.filter((s) =>
        (s.full_name ?? '').toLowerCase().includes(studentFilter.trim().toLowerCase()),
      )
    : allStudents;
```

- [ ] **Step 2: Campo de busca (só com >10 alunos) + lista com altura máxima e scroll**

Substituir o ramo de renderização da lista (o bloco `studentsQ.data && studentsQ.data.length > 0 ? (...)` — linhas ~141-153) por:

```tsx
          ) : allStudents.length > 0 ? (
            <>
              {allStudents.length > 10 && (
                <TextInput
                  value={studentFilter}
                  onChangeText={setStudentFilter}
                  placeholder="Buscar aluno pelo nome"
                  placeholderTextColor={colors.textMuted}
                  className="mb-2 rounded-2xl border border-border bg-surface-muted px-3 py-2.5 text-text text-sm"
                />
              )}
              <ScrollView
                style={{ maxHeight: 6 * 68 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                contentContainerStyle={{ gap: 8 }}
              >
                {filteredStudents.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    tracking={trackingByStudent.get(s.id)}
                    onPress={() => router.push(`/(coach)/aluno/${s.id}` as Href)}
                  />
                ))}
                {filteredStudents.length === 0 && (
                  <Text className="text-text-muted text-xs text-center py-4">
                    Nenhum aluno com esse nome.
                  </Text>
                )}
              </ScrollView>
            </>
          ) : (
```

> Nota: a `ScrollView` interna vertical dentro da `ScrollView` da tela dispara o
> aviso de VirtualizedList — já suprimido em `app/_layout.tsx:14-16`. Com ≤ dezenas
> de alunos não há impacto de performance. `maxHeight: 6*68` ≈ 6 linhas.

- [ ] **Step 3: Typecheck + lint**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck && npm run lint`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add "app/(coach)/index.tsx"
git commit -m "feat(coach): lista de alunos com altura máx + scroll + filtro por nome"
```

---

### Task 13: Verificação end-to-end + deploy OTA

**Files:** nenhum (deploy + validação).

- [ ] **Step 1: Suíte completa + typecheck + lint**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run typecheck && npm run lint && npx vitest run`
Expected: tudo verde.

- [ ] **Step 2: Garantir backend deployado**

Confirmar que Tasks 1-4 já rodaram: `supabase migration list` mostra `20260723000000` aplicada; functions `revenuecat-webhook`, `coach-unlink-student`, `coach-set-active-students` deployadas.

- [ ] **Step 3: Deploy OTA (produção)**

Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH" && cd /home/robson/www/_estudos/pessoal/nutrion/app && npm run update:production -- "suspensão reversível de alunos"`
Expected: `eas update` publica no branch `production` (runtime 1.3.0). Confirmar que a `version` NÃO foi bumpada.

- [ ] **Step 4: E2E manual (com um professor de teste + ≥3 alunos)**

Roteiro:
1. Professor premium/pro com 3+ alunos ativos — confere que todos os alunos entram normal.
2. Rebaixar o professor pra free (compra de teste expira, OU `sync_coach_student_access` manual pra free). Webhook → banner "⚠️ N de M suspensos" na home; alunos excedentes (mais recentes) suspensos.
3. Abrir o app como um aluno suspenso → cai em `/suspended` (bloqueio total).
4. Abrir o app como um aluno ativo → entra normal.
5. Professor troca ativos em `escolher-alunos` (marca outro aluno) → o antes ativo suspende, o antes suspenso reativa; alunos refletem no próximo acesso.
6. Professor faz upgrade (ou premium) → webhook → todos reativados; nenhum `/suspended`.
7. Professor desvincula um aluno → vaga liberada reativa o suspenso mais antigo.

- [ ] **Step 5: Commit (se houver ajustes do E2E)**

```bash
git add -A
git commit -m "fix: ajustes do E2E de suspensão"
```

---

## Self-Review

**1. Spec coverage:**
- Estado persistido + RPC reconciliadora → Task 1. ✅
- Gatilhos (webhook, unlink, set-active, bootstrap professor, bootstrap aluno) → Tasks 2, 3, 4, 10 (`useCoachAccessSync`), 7/9 (`check_and_sync_my_suspension`). ✅
- Grandfather isento / premium ilimitado → Task 1 (RPC). ✅
- Exposição do estado (aluno `suspended`, professor `suspended_at`) → Tasks 5 (services/tipos), 6 (helpers). ✅
- Aluno suspenso = bloqueio total (`/suspended`) → Tasks 8, 9. ✅
- Professor: banner reescrito + escolher-alunos como seletor de ativos + lista com chip → Tasks 10, 11. ✅
- Polish da lista (altura/scroll/filtro) → Task 12. ✅
- OTA-only / version 1.3.0 → Global Constraints + Task 13. ✅
- Unlink inalterado (só dispara sync) → Task 3. ✅

**2. Placeholder scan:** sem TBD/TODO. Verificações de SQL/edge são manuais por convenção do repo (não há testes de SQL/edge além de `mapEvent.test.ts`, que é lógica pura); lógica pura nova tem vitest (Task 6).

**3. Type consistency:** `sync_coach_student_access(uuid)` e `check_and_sync_my_suspension()` usados de forma idêntica em Tasks 1/2/3/4/7/10. `suspended_at: string | null` consistente em `Profile`/`StudentLite`/helpers. `setActiveStudents(string[])`/`useSetActiveStudents` consistentes entre Tasks 5 e 7/11. `suspendedCount`/`activeIds` idênticos entre Tasks 6, 10, 11.

**Nota de risco:** o campo exato do `Profile` em `src/types/database.ts` (Task 5, Step 1) precisa ser localizado no arquivo real; se o tipo for gerado do Supabase, regenerar ou adicionar manualmente. `_resolve_entitlement` aceita `p_uid` (confirmado na migration 20260722); a nova RPC e a edge `coach-set-active-students` chamam com esse nome de parâmetro.
