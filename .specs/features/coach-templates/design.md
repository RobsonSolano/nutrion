# Design: Biblioteca de treinos do professor (templates)

## Arquitetura

```
┌─────────────────────────────┐
│ (coach)/templates/          │  Lista, criar, editar templates
│   index.tsx                 │
│   novo.tsx                  │
│   [id]/index.tsx            │
└─────────────┬───────────────┘
              │
              ▼  RLS: auth.uid() = coach_id
   ┌──────────────────────────┐
   │ workout_templates        │
   │ workout_template_exercises│
   └──────────────────────────┘
              │
              │  service_role (edge function)
              ▼
┌─────────────────────────────────┐
│ Edge function:                  │
│ coach-apply-template            │
│  - valida ownership do coach    │
│  - valida student é do coach    │
│  - INSERT routine + exercises   │
│    em transação                 │
└────────────┬────────────────────┘
             │
             ▼
   ┌──────────────────────────┐
   │ workout_routines         │  user_id = student
   │ workout_routine_exercises│  created_by_coach = caller
   │                          │  source_template_id = template
   └──────────────────────────┘
             ▲
             │ aluno só lê (RLS atual)
             │
   ┌─────────┴────────────────┐
   │ (tabs)/treino.tsx (aluno)│
   │  vê treino, não edita    │
   │  (lock já existe)        │
   └──────────────────────────┘
```

## Arquivos afetados

### Novos

| Arquivo | Propósito |
|---------|-----------|
| `supabase/migrations/2026MMDD000000_workout_templates.sql` | Cria tabelas + RLS + adiciona `source_template_id` em workout_routines |
| `supabase/functions/coach-apply-template/index.ts` | Edge function de aplicação atômica |
| `src/services/templates.ts` | listTemplates, getTemplate, createTemplate, updateTemplate, archiveTemplate, applyTemplate |
| `src/hooks/useTemplates.ts` | TanStack Query hooks |
| `app/(coach)/templates/index.tsx` | Lista + filtros (ativos/arquivados) |
| `app/(coach)/templates/novo.tsx` | Form de criação |
| `app/(coach)/templates/[id]/index.tsx` | Editor |
| `src/components/coach/TemplatePicker.tsx` | Modal/screen pra selecionar 1+ templates ao aplicar |
| `src/components/coach/TemplateCard.tsx` | Card de template na lista |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/(coach)/aluno-novo.tsx` | Adiciona toggle "IA gera tudo" / "Usar templates"; quando templates: skip generate routines, chama applyTemplates |
| `app/(coach)/aluno/[id]/index.tsx` | Adiciona botão "Aplicar template" |
| `app/(coach)/_layout.tsx` ou `index.tsx` | Adiciona acesso à tela de templates |
| `src/components/routine/Editor.tsx` (ou wrapper) | Parametrizar pra modo `'template'` (sem `user_id`, salva em workout_template_exercises) |
| `src/services/onboarding.ts` ou edge function `onboarding-plan` | Adicionar param `skip_routines: boolean` |
| `src/types/database.ts` | Adicionar tipos de `workout_templates`, `workout_template_exercises`, `source_template_id` |

## Decisões técnicas

### 1. Reuso do editor de rotina

O editor atual (`src/components/routine/`) provavelmente está acoplado a
`workout_routines`. Vamos extrair em um hook genérico:

```ts
// hooks/useRoutineEditor.ts
type EditorMode = 'routine' | 'template';
type EditorTarget =
  | { mode: 'routine'; userId: string }
  | { mode: 'template'; coachId: string };

function useRoutineEditor(target: EditorTarget) { ... }
```

Componente `RoutineForm` recebe props `onSave(payload)` e `initialData`. As
telas (`rotina/nova`, `rotina/[id]`, `templates/novo`, `templates/[id]/index`)
plugam o editor com handlers próprios.

### 2. Edge function `coach-apply-template`

```ts
// supabase/functions/coach-apply-template/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { student_id, template_ids } = await req.json();
  const authHeader = req.headers.get('Authorization')!;

  // 1. Cliente do caller pra validar identidade
  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user } } = await supaUser.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  // 2. Cliente service_role pra escrever
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 3. Valida caller é coach + student é dele + templates são dele
  const { data: caller } = await admin.from('profiles')
    .select('role, id').eq('id', user.id).single();
  if (caller?.role !== 'professor') return json({ error: 'not_a_coach' }, 403);

  const { data: student } = await admin.from('profiles')
    .select('id, coach_id, role').eq('id', student_id).single();
  if (!student || student.coach_id !== user.id || student.role !== 'aluno') {
    return json({ error: 'not_your_student' }, 403);
  }

  const { data: templates } = await admin.from('workout_templates')
    .select('*').in('id', template_ids).eq('coach_id', user.id);
  if (templates?.length !== template_ids.length) {
    return json({ error: 'template_not_found_or_not_yours' }, 403);
  }

  // 4. Para cada template: copia routine + exercises (transação via RPC)
  const created_routine_ids = [];
  for (const tpl of templates) {
    const { data: routine } = await admin.from('workout_routines').insert({
      user_id: student_id,
      name: tpl.name,
      description: tpl.description,
      group_id: tpl.group_id,
      created_by_coach: user.id,
      source_template_id: tpl.id,
    }).select('id').single();

    const { data: tplExs } = await admin.from('workout_template_exercises')
      .select('*').eq('template_id', tpl.id).order('sort_order');

    if (tplExs && tplExs.length > 0) {
      await admin.from('workout_routine_exercises').insert(
        tplExs.map(ex => ({
          routine_id: routine!.id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          equipment: ex.equipment,
          sort_order: ex.sort_order,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          weight_min_kg: ex.weight_min_kg,
          weight_max_kg: ex.weight_max_kg,
          duration_min: ex.duration_min,
          notes: ex.notes,
        }))
      );
    }

    created_routine_ids.push(routine!.id);
  }

  return json({ created_routine_ids }, 200);
});
```

Sem transação atômica explícita (Supabase Edge Functions JS lib não expõe
`begin/commit`). Mitigação: se INSERT do routine falha, nada é criado. Se
INSERT dos exercises falha, routine fica órfã (vazia) — admin pode limpar.
Aceitável pro MVP. Alternativa: criar RPC SQL `apply_template_atomic()` que
faz tudo dentro de uma função plpgsql.

→ **Decisão MVP**: lib JS, com cleanup manual se falhar. Se virar problema,
upgrade pra RPC.

### 3. Fluxo no `aluno-novo.tsx`

Estado novo: `creationMode: 'ai' | 'templates'` + `selectedTemplateIds: string[]`.

```
[Cadastrar e gerar plano com IA]   ← creationMode=ai (atual)
                vs.
[Cadastrar e aplicar templates]    ← creationMode=templates
```

Quando `templates`:
1. `useCreateStudent` (cria conta + ficha) — igual
2. `useGenerateStudentPlan({ studentId, skipRoutines: true })` — só metas
3. `useApplyTemplates({ studentId, templateIds })` — copia rotinas
4. PreviewScreen mostra metas + lista de rotinas geradas (busca via service)

A edge function `onboarding-plan` ganha param `skip_routines`. Se `true`,
retorna `{ calorie_goal, protein_goal_g, water_goal_ml, rationale }` sem
`routines: [...]`. Cliente preenche `routines: []` e a tela trata.

Alternativa mais limpa: criar edge function nova `coach-create-student-with-templates` que faz tudo (account+plan+templates) em um round-trip. Mais
trabalho. → **MVP**: caminho com 3 chamadas, mais simples de revisar.

### 4. Source tracking

`workout_routines.source_template_id` tem FK pra `workout_templates(id)` com
`ON DELETE SET NULL`. Útil para:
- UI: badge "Aplicado a partir do template Peito A"
- Analytics: quantos alunos usaram esse template
- Operação "reaplicar versão atualizada do template" (futuro)

Não bloqueia delete do template (set null). Não há live link.

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Template sem exercícios | Permitido salvar mas warning. Aplicar gera routine vazia |
| Aplicar mesmo template 2x no mesmo aluno | Permitido — gera 2 routines com mesmo nome |
| Coach apaga template aplicado em alunos | Routines do aluno permanecem (snapshot). `source_template_id = NULL` |
| Coach é deletado | `ON DELETE CASCADE` em workout_templates → templates somem. Routines do aluno permanecem (já têm FK independente) |
| Aluno é deletado | Routines cascatam (já configurado). Templates do coach intactos |
| Exercise (catálogo global) é deletado | `exercise_id ON DELETE SET NULL` em template_exercises e routine_exercises. `exercise_name` preservado |
| Template arquivado em uso | Continua funcionando (rotinas já criadas). Não aparece no picker |

## Test plan

| Cenário | Como testar |
|---------|------------|
| Coach cria template com 3 exercícios | Inserir via UI → verificar tabelas no Supabase Studio |
| Coach lista próprios templates | UI mostra só os dele; outro coach (criar 2º) confirma RLS |
| Editar template não afeta routines geradas | Aplicar template → editar template → ver routine do aluno (deve estar igual) |
| Apply template via edge function | Curl direto na função com auth do coach |
| Apply template para aluno de outro coach (negative) | Esperar 403 `not_your_student` |
| Apply template que não é do coach (negative) | Esperar 403 `template_not_found_or_not_yours` |
| Aluno tenta editar routine vinda de template | UI bloqueada + RLS retorna 0 rows on update |
| Fluxo de novo aluno com templates | Cadastrar com modo templates → verificar metas geradas + rotinas copiadas |
| Aplicar 2 templates de uma vez | Esperar 2 routines criadas |
| Template arquivado | Some da lista padrão, aparece em "Mostrar arquivados" |

Comandos:
```sh
npm run typecheck
npm run lint
npm run db:push                    # aplica migration localmente
npm run fn:deploy                  # deploy edge function
```

Smoke manual: criar coach + aluno + template via UI, aplicar, ver no perfil
do aluno.
