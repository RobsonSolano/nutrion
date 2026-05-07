# Feature: Biblioteca de treinos do professor (templates)

## Visão geral

Permite que o professor pré-cadastre treinos reutilizáveis ("templates") na
sua biblioteca privada e aplique-os em alunos no momento do cadastro ou em
edições posteriores. Quando aplicado, o template é **copiado** (snapshot) pro
aluno como `workout_routines` normais — independentes do template a partir
desse momento. O que muda no template depois NÃO afeta alunos já vinculados.

Resolve a dor de gerar/editar treino por aluno quando vários têm objetivo e
padrão muscular semelhantes.

## User stories

**US-1.** Como professor, quero criar um template de treino com nome livre,
seleção de exercícios, séries, repetições e cargas, para reaproveitar em
alunos com perfil semelhante.

**US-2.** Como professor, quero ver/editar/duplicar/arquivar minha biblioteca
de templates a qualquer momento, sem afetar treinos já aplicados em alunos.

**US-3.** Como professor cadastrando um aluno novo, quero marcar "usar treino
da biblioteca" e selecionar 1+ templates, para a IA não precisar gerar
rotinas (só metas calóricas) e o aluno já receber treinos prontos.

**US-4.** Como professor com aluno já cadastrado, quero aplicar um template
no aluno em qualquer momento (sem refazer onboarding), gerando novas rotinas
ao lado das existentes.

**US-5.** Como aluno vinculado a um professor, não quero perceber diferença
entre treino vindo de template e treino criado manualmente pelo professor —
ambos são treinos prescritos pelo coach (lock de edição vale igual, badge
"Criado pelo seu professor" igual).

## Critérios de aceite

| ID | Critério |
|----|----------|
| AC-1 | Professor cria template com >=1 exercício; valida (nome obrigatório, sets/reps válidos) |
| AC-2 | Lista de templates do professor é privada (RLS impede outros coaches lerem) |
| AC-3 | Template editado depois NÃO altera workout_routines já criadas a partir dele |
| AC-4 | Aplicar template ao aluno cria 1 `workout_routines` + N `workout_routine_exercises` (cópia integral); marca `created_by_coach = coach.id` |
| AC-5 | No fluxo de novo aluno, opção "Usar templates" desabilita geração de rotinas pela IA mas mantém geração de metas (kcal/proteína/água) |
| AC-6 | Aluno vê o treino aplicado igual a qualquer outro treino do coach (lock de edição preservado, badge igual) |
| AC-7 | Operação de aplicar template é atômica (transação na edge function) |
| AC-8 | Template arquivado (`is_archived = true`) some da lista padrão mas continua nas rotinas já criadas; "Mostrar arquivados" lista de novo |

## Esquema de dados

### `workout_templates` — tabela nova

```sql
create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  group_id uuid references public.exercise_groups(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_templates_coach_idx
  on public.workout_templates (coach_id, is_archived, created_at desc);

create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();
```

### `workout_template_exercises` — tabela nova

Espelho de `workout_routine_exercises`, sem `routine_id` e sem snapshot de
nome (templates são internos do coach; quando aplicado vira routine e o
snapshot já é feito pelo `exercise_name` em `workout_routine_exercises`).

```sql
create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,        -- snapshot, igual a workout_routine_exercises
  equipment text,
  sort_order int not null default 0,
  sets int,
  reps_min int,
  reps_max int,
  weight_min_kg float,
  weight_max_kg float,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

create index workout_template_exercises_template_idx
  on public.workout_template_exercises (template_id, sort_order);
```

### RLS

Só o `coach_id` dono lê/escreve. Não há leitura por aluno (template é
abstração interna do coach).

```sql
alter table public.workout_templates enable row level security;

create policy "templates_select_own" on public.workout_templates
  for select using (auth.uid() = coach_id);

create policy "templates_insert_own" on public.workout_templates
  for insert with check (
    auth.uid() = coach_id
    and exists (select 1 from public.coaches c where c.id = auth.uid())
  );

create policy "templates_update_own" on public.workout_templates
  for update using (auth.uid() = coach_id);

create policy "templates_delete_own" on public.workout_templates
  for delete using (auth.uid() = coach_id);

-- template_exercises herda via parent (mesmo padrão de workout_routine_exercises)
alter table public.workout_template_exercises enable row level security;

create policy "template_exercises_all_own" on public.workout_template_exercises
  for all using (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
      and t.coach_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = workout_template_exercises.template_id
      and t.coach_id = auth.uid()
    )
  );
```

### Tabela `workout_routines` — coluna opcional adicional

Para rastreio histórico ("esse treino veio do template X"), opcionalmente
adicionar:

```sql
alter table public.workout_routines
  add column if not exists source_template_id uuid
    references public.workout_templates(id) on delete set null;
```

- Não é cópia viva — só auditoria/UI ("aplicado a partir do template Peito A").
- `on delete set null` garante que apagar o template não derruba rotinas.

## Aplicação do template (cópia)

### Edge function `coach-apply-template`

**Entrada:**
```ts
{ student_id: uuid, template_ids: uuid[] }
```

**Validações (service_role):**
1. Caller é coach (`profiles.role = 'professor'`).
2. `student_id` é aluno do caller (`profiles.coach_id = caller.id AND profiles.role = 'aluno'`).
3. Todos os `template_ids` pertencem ao caller (`workout_templates.coach_id = caller.id`).
4. Templates não estão arquivados (UI já filtra, mas valida).

**Operação (transação):**
Para cada template selecionado:
1. INSERT `workout_routines (user_id=student_id, name=template.name, group_id=template.group_id, description=template.description, created_by_coach=caller.id, source_template_id=template.id)` → `routine_id`.
2. SELECT `workout_template_exercises` ORDER BY `sort_order`.
3. INSERT batch em `workout_routine_exercises` copiando todos os campos relevantes + `routine_id`.

**Retorno:** `{ created_routine_ids: uuid[] }`.

### Por que edge function?

- RLS de `workout_routines` só permite INSERT pelo `auth.uid() = user_id` E `role <> 'aluno'`. Coach não consegue inserir routine pra outro user via cliente.
- Já existe padrão `coach-save-student-plan` (sub-feature 3 da area-professor). Mesma família.

## UI / UX

### Rotas novas

```
app/(coach)/
  templates/
    index.tsx        # Lista (cards com nome, qtd exercícios, group badge)
    novo.tsx         # Form de criação (reusa src/components/routine/Editor)
    [id]/
      index.tsx      # Edição (mesmo editor, modo update)
```

### Reuso

`src/components/routine/Editor.tsx` (já usado pra criar rotinas pessoais e
pra editar treino do aluno) deve ser parametrizado pra receber:
- modo `'template'` vs `'routine'`
- onSave callback (insere/atualiza na tabela apropriada)

Provavelmente já está suficientemente desacoplado — a inspeção do executor
deve confirmar.

### Acesso ao menu

Adicionar entrada "Biblioteca" / "Templates" no `(coach)/_layout.tsx` (header
ou tab) ou na home `(coach)/index.tsx` como card destacado.

### Aplicar no fluxo de novo aluno (`aluno-novo.tsx`)

Modificar a tela existente:
- Após o form de ficha, antes do botão "Cadastrar e gerar plano com IA",
  adicionar SegmentedControl: `[ IA gera tudo | Usar templates da biblioteca ]`
- Se "Usar templates" selecionado:
  - Mostrar picker de templates (lista com checkboxes, mostra nome + qtd ex.)
  - Botão muda pra "Cadastrar e aplicar templates"
  - Fluxo:
    1. `useCreateStudent` (cria conta + ficha) — igual hoje
    2. `useGenerateStudentPlan` mas com flag `skip_routines: true` (gera só metas)
       *— alternativa: edge function nova `coach-create-student-with-templates`*
    3. `useApplyTemplates` (chama `coach-apply-template`)
    4. Preview screen mostra metas + treinos copiados (já buscados como routines)
    5. Botão "Salvar" só salva metas (rotinas já estão salvas do passo 3)

### Aplicar em aluno existente

Em `(coach)/aluno/[id]/index.tsx`, novo botão "Aplicar template" que abre
modal de seleção e chama `coach-apply-template`. Treino aparece na lista de
rotinas do aluno automaticamente.

## Integração com features existentes

| Feature | Impacto |
|---------|---------|
| `area-professor` sub-feature 3 (lock) | Rotinas criadas via template já têm `created_by_coach` setado. Lock de edição funciona automaticamente |
| `useGenerateStudentPlan` (Groq) | Adicionar param `skip_routines: boolean` na edge function `onboarding-plan` (ou criar variante) |
| Editor de rotina (`src/components/routine/`) | Generalizar pra receber dados de template |
| Aluno solicitando troca de treino | Fluxo `student_requests` já existe — coach responde aplicando outro template ou editando |

## Decisões

| Tema | Decisão |
|------|---------|
| Modelo de aplicação | **Cópia (snapshot)**. Mudança no template não afeta alunos vinculados |
| Visibilidade | **Privado por coach**. Não há biblioteca pública/compartilhável no MVP |
| Aluno percebe que é template? | **Não**. Treino vindo de template é igual a qualquer outro treino do coach |
| `source_template_id` em routines | Sim, opcional. Útil para UI ("aplicado a partir de X") e analytics |
| Editar template afeta histórico | Não — cópias permanecem. Auditoria via `source_template_id` |
| Limite de templates por coach | Sem limite duro no MVP. Reavaliar se >100 |
| Templates compartilhados entre coaches | Fora de escopo. Marketplace/biblioteca pública = futuro |
| IA + templates | Mutuamente exclusivos no fluxo de novo aluno (UX clara). Em aluno existente, ambos coexistem |

## Riscos / cuidados

- **Edge function atomic**: se INSERT do parent succeed mas children fail, rotina vazia fica no aluno. Usar transação ou rollback explícito.
- **Templates com exercícios deletados**: `exercise_id ON DELETE SET NULL` mantém o `exercise_name` snapshot. Aplicação ainda funciona.
- **Validação de ownership**: edge function precisa validar coach IS ALUNO'S COACH **e** templates ARE COACH'S — checar ambos.
- **UX divergência**: hoje o `aluno-novo` chama IA pra metas+rotinas no mesmo passo. Mexer em `onboarding-plan` requer cuidado pra não quebrar comum/admin.
- **Performance**: lista de templates com 50+ items + previews = lazy load por necessidade.

## Fora de escopo (futuro)

- Biblioteca pública / marketplace de templates entre coaches
- Versionamento de templates (rastreio do que mudou)
- Aplicar template e propagar mudanças em alunos (modelo "live link")
- Template de dieta (só treino no MVP)
- Importar template de outros apps (Mfit, Tecnofit)
- Compartilhar template via link
