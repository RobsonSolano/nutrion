# Tasks: Biblioteca de treinos do professor (templates)

Branch: `feature/coach-templates` (a partir de `develop`)

Ordem sugerida (top-down). T-1, T-2 e T-3 são bloqueios pra todo o resto.
T-7 e T-8 podem rodar em paralelo entre si.

---

## T-1. Migration: tabelas de templates

**What:** Criar `workout_templates` + `workout_template_exercises` + adicionar
`source_template_id` em `workout_routines`. Aplicar RLS.

**Where:** `supabase/migrations/2026MMDD000000_workout_templates.sql`

**Depends:** —

**Done-when:**
- Tabelas criadas com colunas e CHECKs da spec
- Indexes (`workout_templates_coach_idx`, `workout_template_exercises_template_idx`)
- Trigger `set_updated_at` em workout_templates
- Policies de RLS: `templates_select_own`, `templates_insert_own`, `templates_update_own`, `templates_delete_own`
- Policy `template_exercises_all_own` (FOR ALL com using + with check via parent)
- `workout_routines.source_template_id` (uuid nullable, FK ON DELETE SET NULL)
- Migration idempotente (`if not exists`, `drop policy if exists`)

**Verify:**
```sh
npm run db:push     # sucesso
# Supabase Studio: confirmar schema; criar 1 template manual; outro coach (criar 2º) NÃO deve ler
```

---

## T-2. Tipos TypeScript

**What:** Adicionar tipos das novas tabelas em `src/types/database.ts`.

**Where:** `src/types/database.ts`

**Depends:** T-1

**Done-when:**
- `WorkoutTemplate`, `WorkoutTemplateExercise` exportados
- `WorkoutRoutine` atualizado com `source_template_id?: string | null`
- `npm run typecheck` verde

**Verify:** `npm run typecheck`

---

## T-3. Service `templates.ts`

**What:** CRUD + apply de templates.

**Where:** `src/services/templates.ts` (novo)

**Depends:** T-1, T-2

**Done-when:**
- `listTemplates(coachId, { archived?: boolean })`
- `getTemplate(id)` (template + exercises)
- `createTemplate({ name, description?, group_id?, exercises: [...] })` (insert template + batch insert exercises)
- `updateTemplate(id, patch)` (atualiza template; exercises via funções separadas ou diff)
- `archiveTemplate(id)` (UPDATE is_archived = true)
- `applyTemplate({ studentId, templateIds })` → chama edge function

**Verify:**
- TS lint OK
- Manual: `await listTemplates(...)` retorna esperado num REPL ou na tela

---

## T-4. Edge function `coach-apply-template`

**What:** Função Deno que valida ownership e copia template → routine + exercises.

**Where:** `supabase/functions/coach-apply-template/index.ts` (novo)

**Depends:** T-1

**Done-when:**
- Aceita `POST { student_id, template_ids: string[] }`
- Valida: caller é professor; student é aluno do caller; templates pertencem ao caller
- Para cada template: INSERT routine + batch INSERT routine_exercises
- Retorna `{ created_routine_ids: string[] }`
- Erros: 401 (no auth), 403 (not_a_coach / not_your_student / template_not_found_or_not_yours)
- Adicionada ao `npm run fn:deploy` (verificar package.json)

**Verify:**
```sh
npm run fn:deploy
# curl com auth válido + payload válido → 200 + IDs
# curl com auth de outro user → 403
```

---

## T-5. Hooks React Query

**What:** TanStack Query hooks pra templates.

**Where:** `src/hooks/useTemplates.ts` (novo)

**Depends:** T-3

**Done-when:**
- `useTemplates(coachId, { archived?: boolean })`
- `useTemplate(id)`
- `useCreateTemplate()`, `useUpdateTemplate()`, `useArchiveTemplate()`
- `useApplyTemplate()` (mutation)
- Invalidate keys corretos após mutations

**Verify:** import no devtool, mutar e ver cache atualizar

---

## T-6. Generalizar editor de rotina

**What:** Refatorar `src/components/routine/Editor.tsx` (ou criar `RoutineForm`)
pra suportar modo `'template'` e modo `'routine'`. Sem regressão no fluxo
atual.

**Where:** `src/components/routine/` (provavelmente Editor.tsx ou similar)

**Depends:** T-2

**Done-when:**
- Componente aceita prop `mode: 'routine' | 'template'`
- onSave callback recebe payload normalizado
- initialData para edição
- Telas existentes (`rotina/nova.tsx`, `rotina/[id].tsx`) continuam funcionando

**Verify:**
- Smoke teste: criar rotina pessoal (deve continuar funcionando)
- TypeCheck verde

---

## T-7. UI: lista de templates `(coach)/templates/index.tsx`

**What:** Tela com lista + busca + filtro arquivados + botão "+ Novo".

**Where:** `app/(coach)/templates/index.tsx` (novo)

**Depends:** T-5, T-6

**Done-when:**
- Lista cards com nome, descrição, grupo, qtd exercícios
- Botão `+` flutuante ou no header pra criar
- Toggle "Mostrar arquivados"
- Tap em card → `/coach/templates/[id]`
- Empty state quando coach não tem templates

**Verify:** smoke teste manual

---

## T-8. UI: criar/editar template

**What:** Telas `templates/novo.tsx` e `templates/[id]/index.tsx` reusando o editor.

**Where:** `app/(coach)/templates/novo.tsx`, `app/(coach)/templates/[id]/index.tsx`

**Depends:** T-6, T-7

**Done-when:**
- Form pré-preenchido em edição
- Salvar cria/atualiza template + exercises
- Botão "Arquivar" em edição
- Volta pra lista após salvar
- Validação: nome obrigatório, >=1 exercício

**Verify:**
- Criar template com 3 exercícios → aparece na lista
- Editar e salvar → mudanças persistem
- Arquivar → some da lista padrão

---

## T-9. Acesso à biblioteca pelo `(coach)`

**What:** Adicionar entry-point ("Biblioteca de treinos" / "Templates") no
layout ou home do coach.

**Where:** `app/(coach)/_layout.tsx` ou `app/(coach)/index.tsx`

**Depends:** T-7

**Done-when:** existe link clicável que leva pra `/coach/templates`

**Verify:** smoke teste

---

## T-10. Picker de templates pra aplicar

**What:** Modal/screen reutilizável que lista templates e retorna 1+ IDs selecionados.

**Where:** `src/components/coach/TemplatePicker.tsx` (novo)

**Depends:** T-5

**Done-when:**
- Aceita prop `onSelect(ids: string[])` e `multi: boolean`
- Lista templates ativos do coach (não arquivados)
- Checkboxes / radio
- Botão confirmar

**Verify:** chamar dentro do `aluno-novo.tsx` (T-12) e dentro do detalhe do aluno (T-11)

---

## T-11. Aplicar template em aluno existente

**What:** Botão "Aplicar template" no detalhe do aluno que abre o picker e
chama `coach-apply-template`.

**Where:** `app/(coach)/aluno/[id]/index.tsx`

**Depends:** T-10, T-4

**Done-when:**
- Botão visível
- Tap abre picker; selecionar 1+ → mutation
- Toast de sucesso + invalidate query de routines do aluno
- Lista de rotinas do aluno mostra novas

**Verify:** smoke teste

---

## T-12. Toggle IA vs templates no fluxo de novo aluno

**What:** Em `aluno-novo.tsx`, adicionar SegmentedControl `[IA gera tudo |
Usar templates]`. Quando templates: skip generate routines, chama
applyTemplates.

**Where:** `app/(coach)/aluno-novo.tsx`

**Depends:** T-10, T-4, T-13

**Done-when:**
- SegmentedControl visível antes do botão final
- Quando "templates": picker aparece; botão "Cadastrar e aplicar templates"
- Fluxo: createStudent → generatePlan(skipRoutines) → applyTemplates → preview
- Preview mostra metas + lista de routines copiadas (re-fetch)

**Verify:**
- Cadastrar aluno via IA continua funcionando
- Cadastrar com 2 templates: aluno tem 2 routines + metas IA

---

## T-13. Param `skip_routines` na edge function `onboarding-plan`

**What:** Adicionar param opcional `skip_routines: boolean` na edge function
`onboarding-plan`. Se true, retorna metas sem `routines: [...]`.

**Where:** `supabase/functions/onboarding-plan/index.ts`

**Depends:** —

**Done-when:**
- Function aceita o param
- Comportamento default (sem flag) inalterado
- Quando `true`, payload da Groq não pede rotinas; resposta vem com `routines: []`
- Cliente preenche routines vazio; tela atual lida bem com isso

**Verify:**
- `npm run fn:deploy`
- `useGenerateStudentPlan` com `skipRoutines: true` retorna metas + `routines: []`
- Sem flag, comportamento atual preservado

---

## T-14. Indicar origem do template (UI)

**What:** No detalhe do treino do aluno (`treino.tsx` ou onde mostra rotinas),
opcionalmente mostrar "Aplicado a partir de [template name]" quando
`source_template_id` existe.

**Where:** componente que renderiza rotina do aluno (verificar no Execute)

**Depends:** T-11/T-12

**Done-when:** badge/texto pequeno aparece na rotina do aluno quando
`source_template_id` está preenchido. Faz fetch do nome do template.

**Verify:** smoke

**Status:** opcional — pode ficar pra um segundo PR.

---

## T-15. /simplify + testes + docs + commit

**What:** Rodar /simplify sobre todo o diff, executar testes (typecheck +
lint + smoke), atualizar docs do codebase, commitar.

**Where:** —

**Depends:** T-1 a T-13 (T-14 opcional)

**Done-when:**
- /simplify executado, sugestões aplicadas ou justificadas
- `npm run typecheck` verde
- `npm run lint` verde
- Smoke test manual rodado
- `.specs/codebase/STRUCTURE.md` atualizado (novas rotas, services)
- Commits criados (perguntar ao dev antes)

**Verify:** suite limpa e commits no `feature/coach-templates`
