# Tasks: Aba de contrato no detalhe do aluno

Branch: `feature/coach-contracts` (a partir de `develop`)

Ordem: T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 → T-9 (commit). T-3 e
T-4 podem rodar em paralelo.

---

## T-1. Migration: `student_contracts`

**What:** Criar tabela + indexes + constraints + trigger + view + RLS.

**Where:** `supabase/migrations/2026MMDD000000_student_contracts.sql` (novo)

**Depends:** —

**Done-when:**
- Tabela `student_contracts` com todas as colunas e CHECKs da spec
- Constraint `contracts_parceria_no_value` (parceria sem value/payment_day)
- Constraint `contracts_dates_consistent` (end_date >= start_date)
- Partial unique index `student_contracts_one_active_per_pair_idx`
- Trigger `student_contracts_auto_end_previous` (BEFORE INSERT)
- View `student_contracts_view` com `effective_status`
- Indexes de busca
- 4 policies de RLS (select_coach, insert_coach, update_coach, delete_coach)
- Trigger `set_updated_at`

**Verify:**
```sh
npm run db:push
# Supabase Studio:
# - inserir contrato ativo, ver constraints
# - tentar inserir parceria com value → erro
# - inserir 2º active → trigger fecha anterior
# - aluno consultando: 0 rows (RLS)
```

---

## T-2. Tipos TypeScript

**What:** `StudentContract`, `ContractType`, `ContractStatus` em `database.ts`.

**Where:** `src/types/database.ts`

**Depends:** T-1

**Done-when:**
- Tipos refletem schema (incluindo `effective_status` da view)
- `npm run typecheck` verde

**Verify:** typecheck

---

## T-3. Helper `lib/money.ts`

**What:** `formatBRL(cents)` e `parseBRL(masked)`.

**Where:** `src/lib/money.ts` (novo, ou estender existente)

**Depends:** —

**Done-when:**
- `formatBRL(25000)` → `'R$ 250,00'`
- `formatBRL(null)` → `'—'`
- `parseBRL('R$ 1.250,50')` → `125050`
- `parseBRL('')` → `0`
- Sem dependências externas (usa Intl)

**Verify:**
- Tests inline ou no app
- Lint verde

---

## T-4. Service `contracts.ts`

**What:** CRUD de contratos.

**Where:** `src/services/contracts.ts` (novo)

**Depends:** T-1, T-2

**Done-when:**
- `listStudentContracts(studentId)` lê da view
- `getActiveContract(studentId)` filtra `effective_status = 'active'`
- `createContract(input)` insere com `coach_id = auth.uid()`, `status = 'active'`
- `updateContract(id, patch)` (só notes em encerrados)
- `cancelContract(id)` UPDATE status='cancelled', end_date=hoje
- Erros de RLS bem propagados

**Verify:** lint, smoke direto via service

---

## T-5. Hooks React Query

**What:** Hooks pra contratos.

**Where:** `src/hooks/useContracts.ts` (novo)

**Depends:** T-4

**Done-when:**
- `useStudentContracts(studentId)`
- `useActiveContract(studentId)`
- `useCreateContract()`, `useUpdateContract()`, `useCancelContract()`
- Invalidate keys corretos: `['contracts', studentId]`

**Verify:** usar nos componentes da T-7

---

## T-6. Componente `ContractForm`

**What:** Form reutilizável (criar e editar).

**Where:** `src/components/coach/ContractForm.tsx` (novo)

**Depends:** T-3

**Done-when:**
- Aceita `initialData?` e `onSubmit`
- SegmentedControl tipo (mensal/treino/semanal/parceria)
- DatePicker pra start_date e end_date (toggle "sem prazo")
- Input value (R$, máscara via formatBRL/parseBRL) — oculto se parceria
- Input payment_day (1-31, opcional) — oculto se parceria
- Textarea notes
- Validação: tipo+start obrigatórios; value se ≠parceria; end>=start
- Botão "Salvar" desabilitado se inválido

**Verify:** smoke isolado (nova screen ou storybook ad-hoc)

---

## T-7. Tela `(coach)/aluno/[id]/contrato.tsx`

**What:** Tela com contrato ativo + histórico + form (modal ou inline).

**Where:** `app/(coach)/aluno/[id]/contrato.tsx` (novo)

**Depends:** T-5, T-6

**Done-when:**
- Header com nome do aluno
- Card grande do contrato ativo (badge "Ativo" verde)
- Botão "Encerrar" → confirma → cancelContract
- Botão "Editar" → abre form em modal/sheet
- Botão "+ Novo contrato" → abre form vazio
- Accordion/list "Histórico" com contratos ended/cancelled
- Empty state quando aluno não tem contrato

**Verify:** smoke teste manual

---

## T-8. Acesso à aba "Contrato" no detalhe do aluno

**What:** Adicionar botão/tab "Contrato" no `(coach)/aluno/[id]/index.tsx`
(ou no `_layout.tsx` se tiver tabs).

**Where:** `app/(coach)/aluno/[id]/index.tsx` (ou `_layout.tsx`)

**Depends:** T-7

**Done-when:**
- Inspecionar como historico/notas estão acessíveis (botão? tab?)
- Adicionar Contrato no mesmo padrão
- Tap → push pra `contrato.tsx`

**Verify:** smoke

---

## T-9. /simplify + testes + docs + commit

**What:** Roda /simplify, suite de testes, atualiza docs, commit.

**Depends:** T-1 a T-8

**Done-when:**
- `npm run typecheck` verde
- `npm run lint` verde
- /simplify aplicado
- `.specs/codebase/STRUCTURE.md` atualizado (nova rota, service)
- Commit criado (perguntar ao dev)

**Verify:** suite limpa
