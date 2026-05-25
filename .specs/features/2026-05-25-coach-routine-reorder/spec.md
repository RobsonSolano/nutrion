# Reordenar treinos do aluno por drag-and-drop

> Branch: `feature/coach-routine-reorder`
> Criada em: 2026-05-25

## 1. Contexto

Quando o coach importa treinos do aluno via texto (`coach-import-workout-ai`),
a ordem das rotinas no banco vem por timestamp de inserção, não pela
ordem em que apareciam no documento original. Resultado: o coach manda
"Treino A, B, C, D" e a tela mostra "D, C, B, A".

Hoje `workout_routines` ordena por `created_at` e não tem campo de ordem
manual.

## 2. User stories

| ID | Como | Quero | Pra |
|----|------|-------|-----|
| **REORDER-01** | coach | arrastar e soltar as rotinas do aluno na tela de detalhe | corrigir a ordem em que aparecem |
| **REORDER-02** | aluno | ver as rotinas na mesma ordem definida pelo coach | seguir o plano sem confusão |
| **REORDER-03** | coach | ver a nova ordem persistir após sair e voltar na tela | confiar que salvou |

## 3. Critérios de aceite

- **REORDER-01.1** No detalhe do aluno (`(coach)/aluno/[id]/index.tsx`),
  a seção "Treinos prescritos" usa drag-and-drop por long-press com
  handle visual (ícone à esquerda do item).
- **REORDER-01.2** Ao soltar, a nova ordem é persistida imediatamente
  via mutation com optimistic update. Se a mutation falhar, reverte.
- **REORDER-01.3** Apenas o coach do aluno pode reordenar (RLS já
  cobre — `workout_routines` tem policy `update` pra dono OU coach
  ligado via `coaches.id = profiles.coach_id`).
- **REORDER-02.1** A lista do aluno em `(tabs)/treino.tsx` recebe
  automaticamente a ordem nova porque `listRoutines` passa a ordenar
  por `sort_order ASC`.
- **REORDER-03.1** Após `pull-to-refresh` ou re-mount, a ordem
  exibida bate com o `sort_order` salvo no banco.
- **REORDER-03.2** Rotinas arquivadas não afetam ordenação (filtro
  `is_archived = false` mantido).

## 4. Schema

Migration nova:
`supabase/migrations/20260525000000_routine_sort_order.sql`

```sql
-- Coluna sort_order
alter table public.workout_routines
  add column if not exists sort_order int not null default 0;

create index if not exists workout_routines_user_sort_idx
  on public.workout_routines (user_id, sort_order)
  where is_archived = false;

-- Seed: numera rotinas existentes por created_at ascendente (mais
-- antiga = 1) por usuário. Só toca em sort_order = 0 (default), assim
-- a migration é idempotente se rodada de novo.
with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by created_at asc
         ) as rn
    from public.workout_routines
   where is_archived = false
     and sort_order = 0
)
update public.workout_routines wr
   set sort_order = ranked.rn
  from ranked
 where wr.id = ranked.id;
```

Pra atomicidade do batch update, criar função RPC:

```sql
-- RPC: reorder_routines(user_uuid, ordered_ids uuid[])
-- Recebe os IDs na nova ordem e atualiza sort_order = índice+1
-- Em uma única transação.
create or replace function public.reorder_routines(
  p_user_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker  -- usa as policies do caller (coach ou aluno dono)
as $$
begin
  update public.workout_routines wr
     set sort_order = arr.idx,
         updated_at = now()
    from unnest(p_ordered_ids) with ordinality as arr(id, idx)
   where wr.id = arr.id
     and wr.user_id = p_user_id;
end;
$$;
```

`security invoker` faz a RPC respeitar as RLS policies já em vigor.
O coach já tem permissão de UPDATE em `workout_routines` do aluno
dele (migration `20260508000000_coach_edit_student_routines.sql`).

## 5. Código

### 5.1 `src/services/routines.ts`

- Trocar `.order('created_at', { ascending: false })` por
  `.order('sort_order', { ascending: true })` em `listRoutines`.
- Adicionar:
  ```ts
  export async function reorderRoutines(
    userId: string,
    orderedIds: string[],
  ): Promise<void> {
    const { error } = await supabase.rpc('reorder_routines', {
      p_user_id: userId,
      p_ordered_ids: orderedIds,
    });
    if (error) throw error;
  }
  ```

### 5.2 `src/services/students.ts`

- Em `getStudentDetail`, trocar `.order('created_at', { ascending: false })`
  por `.order('sort_order', { ascending: true })`.

### 5.3 `src/hooks/useRoutines.ts`

- Adicionar `useReorderRoutines(userId)`:
  - mutation que chama `reorderRoutines(userId, orderedIds)`
  - optimistic update no cache TanStack Query
  - invalida `['routines', userId]` e `['student-detail', userId]` no
    success/error final
  - revert em caso de erro

### 5.4 Dependências

Adicionar ao `package.json`:
- `react-native-gesture-handler` (versão compatível com Expo SDK 54
  — `~2.20.0` ou a recomendada pelo `npx expo install`)
- `react-native-draggable-flatlist` (`^4.0.1`)

Instalar via `npx expo install react-native-gesture-handler` e
`npm i react-native-draggable-flatlist`.

### 5.5 `app/_layout.tsx`

- Importar `GestureHandlerRootView` de `react-native-gesture-handler`.
- Envolver o root (acima de `SafeAreaProvider` ou abaixo, antes do
  `<Stack>`).

### 5.6 `app/(coach)/aluno/[id]/index.tsx`

Trocar o bloco em `~line 533`:

```tsx
{routines.map((r) => (
  <Pressable ...>...</Pressable>
))}
```

por `DraggableFlatList`:

```tsx
<DraggableFlatList
  data={routines}
  keyExtractor={(r) => r.id}
  onDragEnd={({ data }) => {
    const ids = data.map((r) => r.id);
    reorderM.mutate({ studentId, orderedIds: ids });
  }}
  renderItem={({ item, drag, isActive }) => (
    <ScaleDecorator>
      <Pressable
        onLongPress={drag}
        onPress={() => router.push(...)}
        disabled={isActive}
        className="..."
      >
        <GripVertical size={14} color={colors.textDim} />
        ...
      </Pressable>
    </ScaleDecorator>
  )}
/>
```

> **Ponto de atenção**: `DraggableFlatList` precisa de altura
> definida em algum container ancestral porque é uma `FlatList`
> internamente. A página atual usa `ScrollView`. Solução é embrulhar a
> seção em uma `View style={{ height: items.length * ITEM_HEIGHT }}`
> ou renderizar sem `ScrollView` externo (preferido — mas exige
> refator maior). Decidir na fase Execute após testar.

## 6. Estratégia se ScrollView atrapalhar

Plano A: `DraggableFlatList` dentro de `ScrollView` com altura fixa
calculada (`items.length × 72px`). Funciona pra listas pequenas
(< 20 rotinas — caso típico).

Plano B: Refatorar a tela do aluno pra `FlatList` única com header
contendo as outras seções. Trabalho maior — fica pra v2 se A não
performar.

MVP usa Plano A.

## 7. Pontos a confirmar na fase Execute

- `[CONFIRMAR]` `npx expo install react-native-gesture-handler`
  resolve versão compatível.
- `[CONFIRMAR]` RLS `workout_routines_update` permite o coach editar
  rotinas do aluno (ver migration `20260508000000`).
- `[CONFIRMAR]` Optimistic update com `setQueryData` mantém
  consistência durante reordenações rápidas.

## 8. Fora de escopo

- Reordenar **exercícios dentro de uma rotina** (já tem
  `sort_order` em `workout_routine_exercises`, mas a tela de edição
  pode receber drag&drop em v2).
- Drag&drop em templates do coach (`workout_templates`).
- Drag&drop no app do aluno — o aluno só visualiza, não reordena.
