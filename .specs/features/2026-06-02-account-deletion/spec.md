# Exclusão de conta (LGPD / Play Store / App Store)

> Branch sugerida: `feature/account-deletion`
> Criada em: 2026-06-02

## 1. Contexto e justificativa

Play Store (desde abril/2023) e App Store (Guideline 5.1.1(v)) exigem
fluxo de **auto-exclusão de conta** acessível dentro do app. LGPD
reforça o mesmo direito (Art. 18 — exclusão de dados pessoais).

Hoje:

- ✅ Coach pode excluir conta de aluno via `coach-delete-student`
  (hard delete via `auth.admin.deleteUser`, cascade limpa tudo).
- ❌ **Usuário comum, aluno e professor NÃO conseguem excluir a
  própria conta**. Está em violação direta das políticas de loja e
  LGPD.

## 2. Decisões arquiteturais

| Decisão | Escolha | Por quê |
|---|---|---|
| Estratégia de exclusão | **Hard delete em `auth.users`** + cascade | LGPD pura, email libera pra recadastro, zero responsabilidade contínua sobre dados antigos |
| Auditoria | Tabela `account_deletion_log` com **hashes (sem PII)** + motivo opcional | Permite o time cruzar pedidos de suporte sem manter PII; alimenta análise de churn |
| Coach perdendo aluno | Apenas **push imediato** no momento da exclusão | Coach é avisado quando ainda tem como agir; depois, dados somem (LGPD). Sem snapshot/memória persistente |
| Bloqueio do professor | Pré-check: professor com alunos vinculados **NÃO pode excluir** até desvincular cada um | Não deixa alunos órfãos sem aviso |
| "Excluir aluno" atual | Vira **"Desvincular aluno"** + nova edge function `coach-unlink-student` (aluno vira `comum`, perde `coach_id`) | Coach não tem mais poder de excluir conta do aluno; só desvincular |
| `coach-delete-student` antiga | Permanece deployada, marcada `@deprecated` no código | Backward compat enquanto não tem release maior pra remover |
| Modal de motivo | Textarea **opcional** ("Por que está saindo?") | Sem fricção, mas captura sinal qualitativo de churn |

## 3. User stories

| ID | Como | Quero | Pra |
|----|------|-------|-----|
| **DEL-01** | usuário comum | excluir minha conta pelo perfil | exercer meu direito LGPD / sair do app definitivamente |
| **DEL-02** | aluno | excluir minha conta sem precisar pedir pro coach | exercer meu direito mesmo discordando do coach |
| **DEL-03** | aluno | que meu coach saiba que excluí | o coach ter contexto pra dar baixa interna |
| **DEL-04** | professor | excluir minha conta de professor | sair do app quando não dou mais aula |
| **DEL-05** | professor com alunos | ser impedido de excluir minha conta enquanto tiver alunos vinculados | não deixar alunos órfãos |
| **DEL-06** | professor | desvincular um aluno pra ele voltar a ser comum | quando o aluno não é mais meu cliente, sem destruir a conta dele |
| **DEL-07** | qualquer usuário | confirmar a ação com modal claro | não excluir conta por engano |
| **DEL-08** | usuário que excluiu conta | criar uma conta nova com o mesmo email depois | comprar oportunidade de recomeçar (LGPD permite) |
| **DEL-09** | usuário que excluiu | (opcional) dizer o motivo da saída | dar feedback ao time se quiser |

## 4. Critérios de aceite (rastreáveis)

### Botão "Excluir conta" — duas telas

- **DEL-01.1** Em `app/editar-perfil.tsx`, no final do scroll, aparece
  um bloco visual "Zona de risco" (border `danger/30`, bg `danger/5`)
  com botão **"Excluir minha conta"** (variant `danger`, ícone
  `Trash2`). Disponível pra `role IN ('comum', 'aluno')`.
- **DEL-04.1** Em `app/(coach)/perfil.tsx`, mesmo bloco no final,
  visível pra `role = 'professor'`.

### Modal de confirmação (com motivo opcional)

- **DEL-07.1** Modal customizado (não o `ConfirmModal` padrão, porque
  tem textarea):
  - Título: **"Excluir sua conta?"**
  - Mensagem: *"Ao confirmar, você perderá totalmente o acesso ao
    NutriOn e seus dados serão apagados. Essa ação NÃO pode ser
    desfeita."*
  - **Textarea opcional** abaixo: placeholder *"Por que está saindo?
    (opcional, ajuda a gente a melhorar)"*, max 500 chars.
  - Ações: `[Excluir conta (danger)]` + `[Cancelar (ghost)]`
- **DEL-07.2** Botão "Excluir" fica desabilitado enquanto a mutation
  está rodando. Modal não-dismissable durante `isPending`.

### Bloqueio do professor com alunos

- **DEL-05.1** No clique do botão (antes do modal), client verifica
  via `useStudents()` se `count(students) > 0`. Se sim:
  - Modal diferente: título *"Desvincule seus alunos antes"*,
    mensagem *"Você tem N aluno(s) vinculado(s). Antes de excluir
    sua conta, vá em cada aluno e clique em 'Desvincular aluno'."*
  - Ação única: `[Ver alunos]` que navega pra `/(coach)/index`.
  - **Sem** botão de excluir.
- **DEL-05.2** Edge function `delete-my-account` re-valida o bloqueio
  server-side (caso UI seja burlada): retorna 409 `has_students`
  com `student_count`.

### Hard delete (server-side)

- **DEL-01.2** Edge function `delete-my-account` (autenticada via JWT
  do user) executa em ordem:
  1. Lê o profile do caller (`id`, `role`, `full_name`, `coach_id`,
     `created_at`).
  2. Lê o email do `auth.users` via service_role
     (`supabase.auth.admin.getUserById`).
  3. Se `role = 'professor'`: re-valida bloqueio (`select count(*)
     from profiles where coach_id = caller.id`). Se `> 0`, retorna
     409 com `student_count` e `student_ids`.
  4. **Se `role = 'aluno'` E `coach_id` não-nulo**: dispara push pro
     coach via `sendPushAi` com `type='student_account_deleted'` e
     contexto (`student_name`, `account_age_days`,
     `last_activity_summary` opcional). Push é **fire-and-forget**:
     falha de push não bloqueia exclusão.
  5. **INSERT em `account_deletion_log`** (auditoria):
     ```sql
     insert into account_deletion_log (
       user_id_hash, email_hash, role,
       was_linked_to_coach_id, account_age_days, deletion_reason
     ) values (
       encode(digest(caller.id::text, 'sha256'), 'hex'),
       encode(digest(email, 'sha256'), 'hex'),
       role,
       coach_id,  -- pode ser null
       now() - created_at,
       payload.reason  -- nullable
     );
     ```
  6. **Hard delete** via `supabase.auth.admin.deleteUser(caller.id)`.
     Cascade apaga: `profiles`, `food_logs`, `water_logs`,
     `workout_logs`, `workout_routines` (e exercícios), `chat_messages`,
     `ai_usage_log`, `student_requests`, `coach_notes`,
     `student_plan_revisions`, `progress_entries`,
     `physical_assessments`, `student_anamneses`, `push_history`,
     `push_preferences`, `coaches` (se professor), etc.
  7. Retorna `{ ok: true }`.
- **DEL-08.1** Após exclusão, o email volta a estar disponível pra
  criar nova conta normalmente (Supabase Auth desbloqueia
  automaticamente porque `auth.users` foi removido).
- **DEL-01.3** Client recebe OK → faz `supabase.auth.signOut()` local
  → invalida o cache do TanStack Query → redireciona pra
  `/(auth)/login`. Ordem: signOut **antes** de invalidar cache pra
  evitar refetch com sessão zumbi.

### Notificação ao coach (push imediato)

- **DEL-03.1** Novo valor `student_account_deleted` no enum
  `push_type`.
- **DEL-03.2** Novo slug `push_account_deleted` no
  `ai_usage_log_feature_check`.
- **DEL-03.3** `_shared/pushPrompts.ts`:
  - `PushType` += `'student_account_deleted'`
  - `aiUsageFeature` → `'push_account_deleted'`
  - `buildUserPrompt` gera prompt com persona operacional, contexto:
    `student_name`, `account_age_days`, `last_activity_summary`
    (opcional).
  - `staticTemplate` fallback: título `"Aluno saiu"`, corpo
    `"{student_name} excluiu a conta."`
- **DEL-03.4** `_shared/pushAi.ts`:
  - `COOLDOWN_HOURS_BY_TYPE`: adicionar
    `student_account_deleted: 0` (evento único, sem cooldown).
  - `CRITICAL_TYPES`: incluir `'student_account_deleted'` (ignora
    quiet hours — coach tem que saber mesmo que seja 23h).
- **DEL-03.5** Push falha ≠ exclusão falha. Push é fire-and-forget
  (caller já recebeu OK e desconectou).

### Desvincular aluno (substitui "Excluir aluno")

- **DEL-06.1** Nova edge function `coach-unlink-student`:
  - Auth JWT do coach
  - Valida `student.coach_id = caller.id AND student.role = 'aluno'`
  - Executa em ordem (uma transação lógica — coletar erros mas não
    abortar push):
    1. `DELETE FROM coach_notes WHERE student_id = X AND
       coach_id = caller.id` (privacidade do ex-aluno — coach perde
       memória das observações)
    2. `UPDATE student_plan_revisions SET coach_id = null WHERE
       student_id = X AND coach_id = caller.id` (aluno mantém
       histórico próprio via policy `auth.uid() = student_id`; coach
       perde acesso porque `coach_id` fica null)
    3. `UPDATE profiles SET role = 'comum', coach_id = null WHERE
       id = student_id` (desvínculo principal)
    4. Dispara push pro aluno via `sendPushAi` com
       `type='coach_unlinked'` (fire-and-forget)
  - **Mantém**:
    - `workout_routines` do aluno (mesmo com `created_by_coach`
      preenchido — auditoria). Aluno passa a poder editar/excluir
      porque virou `role='comum'` e a RLS `routines_update_own`
      permite (filtro `role <> 'aluno'`).
    - `student_anamneses`, `physical_assessments`,
      `student_contracts` ficam no banco. Coach perde acesso pela
      RLS automaticamente (filtram por `coach_id` nos profiles).
      Aluno mantém acesso ao próprio.
    - `food_logs`, `water_logs`, `workout_sessions` ficam (logs do
      aluno). Coach perde acesso.
  - Retorna `{ ok: true }`
- **DEL-06.2** Rename no client:
  - `services/students.ts:deleteStudent` → `unlinkStudent`
  - `hooks/useStudents.ts:useDeleteStudent` → `useUnlinkStudent`
- **DEL-06.3** Em `(coach)/aluno/[id]/index.tsx`:
  - Botão "Excluir aluno" → **"Desvincular aluno"**
  - Modal título: *"Desvincular [nome]?"*
  - Modal mensagem: *"O aluno volta a ser usuário comum e mantém o
    treino prescrito. Suas notas privadas sobre ele serão apagadas
    e você não verá mais os dados dele aqui. Essa ação não pode ser
    desfeita."*
- **DEL-06.4** `coach-delete-student` permanece deployada. Adiciona
  comentário `@deprecated` no topo do `index.ts`. Removível em
  release maior.

### Push pro aluno quando desvinculado

- **DEL-06.5** Novo valor `coach_unlinked` no enum `push_type`.
- **DEL-06.6** Novo slug `push_coach_unlinked` no
  `ai_usage_log_feature_check`.
- **DEL-06.7** Prompt do push (gerado por IA, persona operacional):
  - Contexto: `coach_name`, `days_with_coach`
  - Tom: factual, sem culpa nem dramatização. Cita que o usuário
    agora gerencia o próprio plano.
  - Static fallback: título *"Plano agora é seu"*, corpo *"Seu
    professor encerrou o vínculo. Você continua com seus treinos e
    agora pode editá-los."*
- **DEL-06.8** Em `pushAi.ts`:
  - `COOLDOWN_HOURS_BY_TYPE`: `coach_unlinked: 0` (evento único)
  - `CRITICAL_TYPES`: incluir `'coach_unlinked'` (ignora quiet
    hours — aluno deve saber que mudou de status mesmo de noite)
- **DEL-06.9** Push é fire-and-forget. Se falhar (token expirado,
  Expo fora do ar), o desvínculo já aconteceu — aluno descobre
  abrindo o app (nome do coach some, edição liberada).

## 5. Mudanças de schema

Migration `20260602000000_account_deletion.sql`:

```sql
-- =====================================================================
-- 1. Tabela de auditoria — sem PII, apenas hashes e estatística.
-- =====================================================================
create table if not exists public.account_deletion_log (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  user_id_hash text not null,
  email_hash text,
  role text check (role in ('comum','aluno','professor')),
  was_linked_to_coach_id uuid,  -- só estatística; não FK pra não bloquear coach-delete
  account_age_days int,
  deletion_reason text          -- opcional, max 500 chars (validado client + edge function)
);

create index if not exists account_deletion_log_email_hash_idx
  on public.account_deletion_log (email_hash);
create index if not exists account_deletion_log_deleted_at_idx
  on public.account_deletion_log (deleted_at desc);

comment on table public.account_deletion_log is
  'Auditoria mínima de auto-exclusão de contas. Sem PII direta (apenas hashes SHA-256 de id e email pra cruzamento manual em pedidos de suporte). LGPD: dados pessoais são fisicamente removidos via cascade quando auth.users é deletado.';

-- RLS: ninguém acessa diretamente — só service_role lê/escreve
-- (edge function delete-my-account e queries do time pelo painel).
alter table public.account_deletion_log enable row level security;
-- Sem policies = ninguém com JWT comum lê/escreve.

-- =====================================================================
-- 2. Novos tipos de push
-- =====================================================================
alter type public.push_type add value if not exists 'student_account_deleted';
alter type public.push_type add value if not exists 'coach_unlinked';

-- =====================================================================
-- 3. Estende ai_usage_log.feature
-- =====================================================================
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in (
    'chat','sanity_check','onboarding_plan','coach_plan',
    'push_inactivity','push_streak','push_workout',
    'push_weekly_summary','push_coach_alert','push_plan_update',
    'push_goal_achieved','push_protein','push_workout_check',
    'push_streak_warning','push_account_deleted',
    'push_coach_unlinked'
  ));
```

> **Sobre o hash SHA-256:** Postgres tem `digest()` via extension
> `pgcrypto`. Verificar se já está habilitada (provável — Supabase
> habilita por default em projetos novos). Se não, adicionar
> `create extension if not exists pgcrypto;` no topo da migration.

## 6. Edge Functions

### 6.1 `delete-my-account` (NOVA)

**Auth:** JWT do user (garante que ele só apaga a si mesmo).

**Body:** `{ reason?: string }` (max 500 chars, opcional)

**Lógica:** ver §4 DEL-01.2.

**Errors:**

| Code | HTTP | Quando |
|---|---|---|
| `unauthorized` | 401 | Sem JWT válido |
| `has_students` | 409 | Professor com `coach_id` na profiles de outros |
| `internal_error` | 500 | Falha no auth admin / SQL |

### 6.2 `coach-unlink-student` (NOVA)

**Auth:** JWT do coach.

**Body:** `{ student_id: string }`

**Lógica:**
1. Valida JWT
2. `select role, coach_id from profiles where id = student_id`
3. Se `role != 'aluno'` ou `coach_id != caller.id` → 403
4. `update profiles set role = 'comum', coach_id = null where id = student_id`
5. Retorna `{ ok: true }`

**Errors:**

| Code | HTTP | Quando |
|---|---|---|
| `unauthorized` | 401 | Sem JWT |
| `forbidden` | 403 | Não é coach desse aluno |
| `student_not_found` | 404 | ID inválido |

### 6.3 `coach-delete-student` (existente, deprecated)

Mantém código. Adiciona no topo:

```ts
/**
 * @deprecated Desde 2026-06-02 (feature account-deletion).
 * Coach não tem mais poder de excluir conta do aluno.
 * Use `coach-unlink-student` pra remover o vínculo (aluno vira comum).
 * Esta function permanece deployada apenas pra backward compat com
 * clients antigos que ainda chamam. Remover quando histórico de
 * invocations confirmar que ninguém usa.
 */
```

## 7. Client (React Native)

### 7.1 Services / Hooks

| Arquivo | Antes | Depois |
|---|---|---|
| `src/services/students.ts` | `deleteStudent(id)` | `unlinkStudent(id)` (calls `coach-unlink-student`) |
| `src/hooks/useStudents.ts` | `useDeleteStudent` | `useUnlinkStudent` |
| `src/services/auth.ts` | — | `deleteMyAccount(reason?: string)` (novo) |
| `src/hooks/useAuth.ts` | — | `useDeleteMyAccount` (novo) — onSuccess: signOut + qc.clear() + redirect |

### 7.2 Telas

| Tela | Mudança |
|---|---|
| `app/editar-perfil.tsx` | Adiciona `<DangerZone>` no final |
| `app/(coach)/perfil.tsx` | Idem + pré-check de alunos vinculados |
| `app/(coach)/aluno/[id]/index.tsx` | "Excluir aluno" → "Desvincular aluno"; troca hook |

### 7.3 Componente `DangerZone`

Em `src/components/DangerZone.tsx`. Recebe:

```ts
type Props = {
  /** Quando true (professor com alunos), o botão fica disabled e
   *  o modal mostra a mensagem de bloqueio em vez do modal de exclusão. */
  blockedReason?: { studentCount: number; onSeeStudents: () => void } | null;
};
```

Encapsula: bloco visual + estado do modal + textarea de motivo +
chamada do `useDeleteMyAccount`. Mostra `<ConfirmModal>` se
bloqueado, ou modal customizado com textarea se ok.

## 8. Prompts da IA

### `student_account_deleted`

```
Contexto:
- Aluno: {student_name}
- Tempo como aluno: {account_age_days} dias
- Última atividade: {last_activity_summary}

Você está escrevendo pra um PROFESSOR (coach), avisando que um aluno
acabou de excluir a conta no app. Tom: operacional, curto, sem
lamento ou clichê. Cita o nome e o tempo se relevante. Sugere ação
prática quando faz sentido (ex: "vale uma mensagem se quiser entender
o motivo"). NÃO use emoji. NÃO use "infelizmente".
```

Static fallback:
- Título: `"Aluno saiu"`
- Corpo: `"{student_name} excluiu a conta."`

### `coach_unlinked`

```
Contexto:
- Coach: {coach_name}
- Tempo com o coach: {days_with_coach} dias

Você está escrevendo pra um ALUNO que acabou de ser desvinculado pelo
professor dele. Tom: factual, sem culpa nem dramatização. Reconhece a
mudança e enfatiza que agora ele gerencia o próprio plano. NÃO use
emoji. NÃO julga o motivo do desvínculo.
```

Static fallback:
- Título: `"Plano agora é seu"`
- Corpo: `"Seu professor encerrou o vínculo. Você continua com seus treinos e agora pode editá-los."`

## 9. Sequência de implementação

1. **Migration** `20260602000000_account_deletion.sql`
2. **Shared push**: `pushPrompts.ts` + `pushAi.ts` (novo tipo +
   CRITICAL_TYPES + COOLDOWN)
3. **Tipos client**: `PushType` em `src/types/database.ts`
4. **Edge function `coach-unlink-student`**
5. **Edge function `delete-my-account`**
6. **Services**: `unlinkStudent`, `deleteMyAccount`
7. **Hooks**: `useUnlinkStudent`, `useDeleteMyAccount`
8. **Componente `DangerZone`**
9. **Telas**:
   - `(coach)/aluno/[id]/index.tsx` (renomear botão)
   - `editar-perfil.tsx` (adiciona DangerZone)
   - `(coach)/perfil.tsx` (adiciona DangerZone + pré-check)
10. **`package.json`**: adicionar `delete-my-account` e
    `coach-unlink-student` ao `fn:deploy`
11. **Verify**: typecheck, lint, smoke tests por persona

## 10. Pontos a confirmar na fase Execute

- `[CONFIRMAR]` Extension `pgcrypto` está habilitada no projeto
  (pra `digest()`). Se não, adicionar `create extension`.
- `[CONFIRMAR]` Lista completa de tabelas que cascateiam quando
  `auth.users` é deletado. Garantir que **nenhuma tem FK sem
  cascade** que bloqueie o delete. Migrations relevantes:
  - `20260419220000_init.sql` (profiles + base)
  - `20260504000000_coach_role_and_table.sql` (coaches)
  - `20260505000000_student_management.sql`
  - `20260507000000_student_requests.sql`
  - `20260510000000_coach_notes.sql`
  - `20260511000000_student_plan_revisions.sql`
  - `20260512000000_push_notifications.sql`
  - `20260515000000_workout_templates.sql`
  - `20260516000000_student_contracts.sql`
  - `20260518000000_progress_entries.sql`
  - `20260520000000_physical_assessments.sql`
  - `20260521000000_push_preferences.sql`
  - `20260522000000_student_anamneses.sql`
- `[CONFIRMAR]` `account_deletion_log.was_linked_to_coach_id` é
  uuid sem FK — quando o coach é deletado, esse campo fica
  "órfão" mas válido (intencional, é só estatística).
- `[CONFIRMAR]` `last_activity_summary` no prompt do push —
  calcular como? Olhar `food_logs`/`water_logs`/`workout_sessions`
  mais recente. Pode ser pesado se chamado no momento do delete.
  Alternativa: omitir do prompt (a IA gera com só nome + dias).
- ~~Quando coach desvincula aluno, aluno recebe push?~~ ✅
  Decidido: sim, push `coach_unlinked` (texto "Plano agora é seu").
  Crítico, ignora quiet hours.
- `[CONFIRMAR]` Validação do `reason` (textarea): max 500 chars
  no client, mas precisa validar server-side também na edge
  function. Sanitizar contra SQL injection (parametrizar via
  bindings — supabase-js já faz).
- `[CONFIRMAR]` `qc.clear()` vs `qc.invalidateQueries()` após
  signOut — qual sequência impede refetch zumbi.

## 11. Fora de escopo

- Tela "minhas contas antigas" pro coach (snapshot histórico). Não
  pedido nesta feature.
- Email pro coach (push é suficiente; SMTP exige infra nova).
- Push pro aluno desvinculado (decidir na fase Execute se entra).
- Tela de "reativação" / soft restore (LGPD permite via processo
  manual de suporte com backup; sem UI dedicada).
- Exportação de dados antes da exclusão (LGPD permite; feature
  separada, fora deste escopo).
- "Período de carência" tipo "sua conta será excluída em 30 dias,
  acesse pra cancelar". Mantemos exclusão imediata por simplicidade.

## 12. Estimativa

| Bloco | Estimativa |
|---|---|
| Migration + shared push | 0,5 d |
| `coach-unlink-student` | 0,3 d |
| `delete-my-account` (lógica completa) | 1 d |
| Client (services + hooks + tipos) | 0,5 d |
| Componente `DangerZone` + integração 3 telas | 1 d |
| Verify + smoke tests por persona (comum / aluno / professor com e sem alunos) | 0,7 d |
| **Total** | **~4 dias úteis** |
