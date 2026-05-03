# Feature: Área do Professor

## Visão geral

Permite que profissionais de educação física / nutrição criem contas de
"professor" no NutriOn, cadastrem alunos com login próprio, montem treinos
junto com a IA pra cada aluno, e acompanhem o dia-a-dia. Alunos não passam
pelo onboarding (o professor preenche os dados), não editam os treinos
criados pelo professor (só executam e logam), e podem solicitar mudanças via
fila de solicitações.

Usuários "comuns" (sem professor) continuam usando o app como hoje, sem
restrição — a área do professor é uma extensão, não substituição.

## Tipos de usuário

| Tipo | role (em profiles) | coach_id | entry em coaches |
|------|--------------------|----------|------------------|
| **Comum** (atual) | `'comum'` (default) | NULL | não |
| **Aluno** | `'aluno'` | NOT NULL | não |
| **Professor** | `'professor'` | NULL | sim |

Mutuamente exclusivos no MVP. Constraint via `check (role in (...))`.

## Esquema de dados

### `profiles` — colunas adicionadas

```sql
alter table public.profiles
  add column if not exists role text not null default 'comum'
    check (role in ('comum','aluno','professor')),
  add column if not exists coach_id uuid references public.profiles(id)
    on delete set null;
```

- `coach_id` → quando aluno é deletado, OK; quando professor é deletado, alunos viram órfãos (`coach_id = NULL`) e mantêm os dados.
- RLS de UPDATE precisa **bloquear** o user de mudar o próprio `role` ou `coach_id` (senão ele vira professor sozinho). Mudança de role só via edge function com `service_role`.

### `coaches` — tabela nova

```sql
create table public.coaches (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  cref text,                              -- registro profissional, opcional
  max_students int not null default 20,
  created_at timestamptz not null default now()
);
```

RLS: leitura própria (`auth.uid() = id`). Insert/update só via edge functions
com `service_role`. Aluno não consulta dados do professor diretamente — UI
busca `full_name`/`avatar_url` do `profiles` do `coach_id`.

### `workout_routines` — coluna adicionada (sub-feature 3)

```sql
alter table public.workout_routines
  add column if not exists created_by_coach uuid references public.coaches(id)
    on delete set null;
```

RLS: aluno só lê/executa rotinas onde `created_by_coach = profile.coach_id`
ou `created_by_coach IS NULL` (suas próprias). Update/delete bloqueado quando
`created_by_coach IS NOT NULL` e `auth.uid() = user_id` (aluno).

### `student_requests` — tabela nova (sub-feature 4)

```sql
create table public.student_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  message text not null check (char_length(message) <= 500),
  status text not null default 'open'
    check (status in ('open','in_progress','done','cancelled')),
  coach_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS: aluno lê/cria as próprias; professor lê/atualiza as dele.

## Sub-features (cada uma é uma branch)

### 1. Auth + role + signup-professor (esta branch)

- Migration: role + coach_id + tabela coaches + RLS hardening em profiles
- Edge function `signup-professor`: define role + cria coaches row (chamada após `auth.signUp` do client)
- Tela `app/(auth)/signup-professor.tsx`: form com email/senha/nome/bio/cref
- Link "Sou professor — criar conta" no login.tsx
- Gate em `(tabs)/_layout`: redireciona role='professor' pra `/(coach)`
- Diretório `app/(coach)/` com placeholder

### 2. CRUD de alunos + envio de email

- Edge function `coach-create-student`: usa `service_role.admin.createUser`
  pra criar auth.users do aluno + setar profile (role='aluno', coach_id, dados
  básicos preenchidos pelo professor, `onboarding_completed_at = now()`)
- Edge function `send-email`: SMTP Gmail via `denomailer`. Reusável em #6.
- UI no `(coach)/`: lista de alunos, criar aluno (form com escolha "Definir
  senha" ou "Gerar aleatória"), editar aluno
- Botão "Encaminhar dados pro email do aluno" usa `send-email`
- Limite: `coaches.max_students` (default 20). Edge function valida.

### 3. Ownership + lock de treinos

- Migration: `created_by_coach` em workout_routines
- RLS: aluno não pode UPDATE/DELETE rotina onde `created_by_coach IS NOT NULL`
- UI: badge "Criado pelo seu professor" em rotinas do coach. Botões de edição
  desabilitados pra aluno.
- Professor cria rotinas pelo dashboard (sub-feature 5) — usa o editor atual
  com `user_id = aluno_id` e `created_by_coach = coach.id`

### 4. Fila de solicitações

- Migration: `student_requests`
- UI no perfil do aluno: aba "Solicitações" com filtros por status,
  botão "+ Solicitação" abre input livre de até 500 chars
- UI no dashboard do professor: lista de solicitações abertas, ação de
  aprovar/rejeitar/responder + mudar status

### 5. Dashboard do professor

- Tabs em `(coach)`: Alunos, Solicitações, Perfil
- Aluno detalhe: macros do dia, últimos logs, treinos prescritos, histórico
  de solicitações, botão "Editar treinos" (ré-uso do editor atual)
- Lista de alunos com aderência (% de dias logados na semana)

### 6. Reset/trocar senha

- "Esqueci a senha" usa Supabase Auth nativo (`resetPasswordForEmail`) — email
  vai do template default do Supabase
- "Trocar senha" no perfil: input nova senha + confirmar → `auth.updateUser`
- Customização do template do email do Supabase fica no painel do dashboard

## Decisões

| Tema | Decisão |
|------|---------|
| Senha inicial do aluno (Q1) | Misto: professor escolhe entre "Definir senha" ou "Gerar aleatória" (mostrada uma vez). Ambas opções no form de cadastro |
| Limite de alunos por professor (Q2) | 20 (`coaches.max_students`, ajustável caso a caso) |
| Formato das solicitações (Q3) | Texto livre, 500 chars |
| Aluno troca de professor (Q4) | Não no MVP. Trocas via SQL manual |
| Professor vê chat do aluno (Q5) | Não — chat é privado por user_id (RLS atual já garante) |
| Aluno cria rotinas próprias (P5) | **Não**. Só executa as do professor. Se quiser variação, solicita |
| Cota de IA (P6) | Independente por usuário. Aluno tem 10 chat/dia, 5 sanity/dia, etc — igual ao comum |
| `is_early_adopter` (P8) | Só comuns contam. Alunos não — `user_number` continua sequencial pra todos |
| Reset de senha | Supabase Auth nativo (default), customizar template no dashboard |
| Email custom | Edge function `send-email` via Gmail SMTP, usada pra "Encaminhar dados pro aluno" |

## Riscos / cuidados

- **Escalada de privilégio**: o user precisa ser impedido de UPDATE no
  próprio `role` via cliente (RLS deve fixar valor atual no `with check`).
- **Cadastro do aluno**: edge function precisa de `service_role` (acesso
  admin). Validar limite de alunos antes de criar pra não estourar.
- **Email com senha em plain text**: a senha gerada/definida vai por email
  uma vez. Recomendar ao aluno que troque após primeiro login (UX dica).
- **Onboarding pulado**: aluno entra direto nas tabs com profile preenchido.
  A UI deve garantir que campos obrigatórios (peso, altura, metas) foram
  preenchidos pelo professor — senão a Home/Chat quebra.
- **RLS de coaches**: leitura pública dos `full_name` dos professores via
  `profiles` (já é o caso). Não expor `bio`/`cref` pra alunos no MVP — só
  o próprio professor lê esses dados.

## Fora de escopo (futuro)

- N:M aluno↔professor (múltiplos professores)
- Convite por email com link de definir senha (em vez de senha definida pelo professor)
- Aprovação manual de signup-professor (anti-abuso)
- Pagamento/billing
- Aluno → professor (promoção de role)
- Notificações push
