# Testes e2e

Suite de testes end-to-end que rodam contra o **Supabase real** (não
um banco mock). Cada teste cria seus próprios registros, valida, e
**limpa tudo no final** — não toca em dados de produção que existem.

## Pré-requisitos

`.env.local` na raiz do projeto precisa ter:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

A `SUPABASE_SERVICE_ROLE_KEY` pega em **Supabase Dashboard → Project
Settings → API → service_role key**. **Não commitar.** Já está em
`.env.local` que está no `.gitignore`.

## Rodar

```bash
npm run test:e2e                       # tudo
npm run test:e2e -- --filter Auth      # filtra por nome de suíte
```

Output mostra cada teste com `✓` (verde) ou `✗` (vermelho), tempo de
execução e detalhe do erro quando falha.

## Como funciona

Cada teste recebe um `ctx` (contexto) com um método `ctx.defer(fn)`
que registra cleanup. Os cleanups rodam em ordem reversa (LIFO)
**mesmo se o teste lançar exceção** — o registro nunca fica órfão.

Padrão típico:

```js
test('algum teste', async (ctx) => {
  const user = await createTestUser({ prefix: 'algumacoisa' });
  ctx.defer(() => cleanupUser(user));

  // ... operações ...

  // sem cleanup explícito: defer cuida.
});
```

`cleanupUser(user)` chama `auth.admin.deleteUser(user.id)`. Como
`profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`, todo o
resto (food_logs, routines, sessions, chat, etc) é apagado em cascata
automaticamente.

## Suites incluídas

| Suite | Cobre |
|---|---|
| **Auth & Profile** | signup → trigger handle_new_user, RLS de profile, trigger guard_role_changes, login |
| **Logs** | food_logs CRUD, water_logs upsert, workout_sessions, isolamento RLS |
| **Workout routines** | criar routine + exercícios + count, RLS lock pra aluno |
| **Coach** | signup-professor edge function, coach-create-student, leitura de alunos, anti-escalada |
| **Student requests** | criar/responder solicitação, RLS coach lê |
| **Coach notes** | privacidade (aluno NÃO lê), CRUD do coach |
| **Data export** | queries paralelas RLS-safe, isolamento entre users |

## O que NÃO está coberto (intencionalmente)

- **Chamadas reais à IA** (chat-ai, onboarding-plan, coach-generate-plan,
  sanity-check): geram custo Groq e são flaky em testes. Os endpoints
  são testados manualmente via app.
- **Push notifications**: precisam de device físico real.
- **Gmail SMTP** (coach-send-credentials): testar manualmente pra evitar
  inundar a inbox.

Esses fluxos têm testes unitários menores em outras camadas se valer.

## Adicionar uma suite nova

1. Cria `scripts/e2e/suites/<nome>.mjs` seguindo o template das
   existentes:
   ```js
   import { suite, expect } from '../lib/runner.mjs';
   import { cleanupUser, createTestUser } from '../lib/clients.mjs';

   suite('Nome da suite', ({ test }) => {
     test('caso 1', async (ctx) => {
       // ...
     });
   });
   ```
2. Importa em `runner.mjs`:
   ```js
   await import('./suites/<nome>.mjs');
   ```

Sempre garanta que cada teste deixa o banco como encontrou.
