# Estrutura do codebase

## Diretórios principais

```
app/                          # Rotas Expo Router (file-based)
  (auth)/                     # Grupo: login (sem header)
    login.tsx
  (tabs)/                     # Grupo: tabs principais (Home, Treino, Chat, Perfil)
    index.tsx                 # Home (dashboard)
    treino.tsx
    chat.tsx
    perfil.tsx
  onboarding/                 # Fluxo de onboarding (8 steps + loading + resultado)
    index.tsx, dados.tsx, objetivo.tsx, esporte.tsx,
    habitos.tsx, bio.tsx, loading.tsx, resultado.tsx
  rotina/                     # CRUD de rotinas de treino
    nova.tsx, [id].tsx
  log.tsx                     # Log rápido (refeição/água/treino)
  sanity-check.tsx            # Validação de prato via foto
  editar-perfil.tsx
  index.tsx                   # Redirect inicial
  _layout.tsx                 # Root layout (auth gate, providers)

src/
  components/                 # Componentes reutilizáveis
    ui/                       # Primitivos (Button, Input, SegmentedControl, ConfirmModal, ...)
    onboarding/               # Steps de onboarding
    routine/                  # Editor de treino, ExercisePicker, etc.
    log/                      # Tabs de log rápido
    ChatBubble.tsx, TypingIndicator.tsx, WeekStreak.tsx, Disclaimer.tsx
  services/                   # Camada de acesso ao Supabase (uma por entidade)
    supabase.ts               # Cliente Supabase
    auth.ts, profile.ts, onboarding.ts
    foodLogs.ts, waterLogs.ts, workoutLogs.ts, routines.ts, exercises.ts
    chat.ts, chatMessages.ts, sanityCheck.ts, aiUsage.ts
  stores/                     # Zustand stores
    useSessionStore.ts        # Sessão Supabase
    useOnboardingStore.ts     # Estado do form de onboarding
    useOnboardingResultStore.ts
  hooks/                      # Hooks React Query e utilitários
  lib/                        # Utilitários puros (formatadores, helpers)
  types/                      # Types globais

supabase/
  migrations/                 # Migrations SQL idempotentes (timestamp_nome.sql)
  functions/
    chat-ai/                  # Edge function do chat
    onboarding-plan/          # Edge function que gera plano de onboarding
  config.toml

scripts/
  seed-user.mjs               # Seed de usuário pra testes locais

assets/                       # Imagens, ícones, splash
```

## Schema Supabase (resumo)

**Auth:** `auth.users` (gerenciado pelo Supabase).

**Por usuário (RLS = auth.uid() = user_id):**
- `profiles` — id = auth.users.id; biometria, metas, campos de onboarding, `user_number`, `is_early_adopter`.
- `workout_logs`, `food_logs`, `water_logs` — logs diários.
- `workout_routines` → `workout_routine_exercises` (cascade) — rotinas e prescrição.
- `workout_sessions` — execuções diárias de rotinas.
- `chat_messages` — histórico do chat com IA (cota diária via `day` column).
- `ai_usage_log` — log analítico de chamadas IA (chat, sanity_check, onboarding_plan).

**Catálogo global (RLS = leitura pra todos autenticados):**
- `exercise_groups` (9 grupos) → `exercises` (~90 com modalidade).

**Storage:**
- Bucket `meal-photos` — privado, prefixo `<user_id>/`.

**Triggers:**
- `handle_new_user` — cria `profiles` no INSERT em `auth.users`.
- `set_updated_at` — atualiza `updated_at` em profiles, water_logs, workout_routines.

## Comandos principais

| Comando | Ação |
|---------|------|
| `npm run start` | Expo dev server (dev client) |
| `npm run start:go` | Expo Go (sem Google Sign-in nativo) |
| `npm run android` | Build dev e abrir |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run db:push` | `supabase db push` (aplicar migrations) |
| `npm run fn:deploy` | Deploy das edge functions chat-ai e onboarding-plan |
| `npm run seed:user` | Seed de usuário (scripts/seed-user.mjs) |

## Convenções de RLS

Toda tabela com `user_id` repete o mesmo padrão:

```sql
alter table public.X enable row level security;
create policy "X_select_own" on public.X for select using (auth.uid() = user_id);
create policy "X_insert_own" on public.X for insert with check (auth.uid() = user_id);
create policy "X_update_own" on public.X for update using (auth.uid() = user_id);
create policy "X_delete_own" on public.X for delete using (auth.uid() = user_id);
```

Tabelas filhas (`workout_routine_exercises`) validam ownership via `EXISTS` no parent.
