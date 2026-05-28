# Tasks — Melhorias de imagens e push

Tasks atômicas com critério de pronto verificável. Ordem importa
quando indicada via `Depends`.

---

## T1 — Migration `20260524000000_push_v3_new_types.sql`

**What:** estender enum `push_type` com 3 novos slugs, estender
`ai_usage_log_feature_check` com 3 novos slugs de feature, estender
`push_history.skip_reason` check constraint com 3 novos motivos.

**Where:** `supabase/migrations/20260524000000_push_v3_new_types.sql`
(arquivo novo).

**Depends:** —

**Done-when:**
- Migration roda local sem erro.
- `select unnest(enum_range(null::push_type))` retorna 11 valores
  (8 antigos + 3 novos: `protein_reminder`, `daily_workout_check`,
  `streak_warning`).
- Inserir uma linha de teste em `ai_usage_log` com
  `feature='push_protein'` funciona.
- Inserir linha de teste em `push_history` com
  `skip_reason='no_goal'` funciona.

**Verify:**
```bash
npm run db:push   # aplica em remoto (com cuidado)
# ou local:
# supabase db reset (se houver setup local)
```

---

## T2 — `_shared/pushPrompts.ts` — novos tipos

**What:**
1. Estender union `PushType` com 3 novos slugs.
2. Estender `aiUsageFeature(type)` com retornos `'push_protein'`,
   `'push_workout_check'`, `'push_streak_warning'`.
3. Adicionar `buildUserPrompt(type, ctx)` pros 3 novos tipos com os
   prompts da spec §6.
4. Adicionar `staticTemplate(type, ctx)` pros 3 novos tipos
   (fallback) E reescrever o template de `water_reminder` para o
   formato "fim de dia" descrito em PUSH-W1.2.

**Where:** `supabase/functions/_shared/pushPrompts.ts`.

**Depends:** T1 (não em runtime, mas semanticamente).

**Done-when:**
- TypeScript do projeto ok (`deno check` ou `npm run typecheck`).
- Os 3 novos tipos aparecem em todos os switches sem
  TS "missing case".

**Verify:**
```bash
cd supabase/functions
# se tiver deno: deno check _shared/pushPrompts.ts
```

---

## T3 — `_shared/pushAi.ts` — cooldown e routing

**What:** adicionar entradas para os 3 novos tipos no
`COOLDOWN_HOURS_BY_TYPE` (24h em todos). Garantir que
`useTemplate` segue só `type === 'water_reminder'` (os outros usam
IA).

**Where:** `supabase/functions/_shared/pushAi.ts`.

**Depends:** T2.

**Done-when:**
- `Record<PushType, number>` continua exhaustive (sem TS error).
- Lógica de IA vs template inalterada exceto pelo enum.

---

## T4 — Edge Function `cron-water-reminder`

**What:** cron que roda 20h BRT, seleciona alunos com
`expo_push_token` E `volume_ml` do dia < 50% de `water_goal_ml` (ou
sem registro de água hoje), chama `sendPushAi(type='water_reminder')`
(template fixo via `useTemplate`).

**Where:**
- `supabase/functions/cron-water-reminder/index.ts`
- `supabase/functions/cron-water-reminder/deno.json`

**Depends:** T1, T2, T3.

**Done-when:**
- Função tem auth `X-Cron-Secret`, CORS, throttle 100ms.
- Pula alunos sem `water_goal_ml` (skip_reason: `no_goal`).
- Pula alunos que já atingiram >= 50% (skip_reason: `goal_met`).
- Resposta JSON inclui `processed`, `sent`, `skipped`,
  `skipReasons`, `cutoff_pct`.

**Verify (local):**
```bash
# Smoke test com dry_run via send-push-ai (não esta função direto)
curl -X POST $URL/functions/v1/send-push-ai \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<seu_id>","type":"water_reminder","dry_run":true,
       "context":{"water_now_ml":500,"water_goal_ml":4000}}'
```

---

## T5 — Edge Function `cron-protein-reminder`

**What:** cron que roda 21h BRT (= 00h UTC do dia D+1, ver §7 da
spec), seleciona alunos com `expo_push_token` E proteína consumida
no dia < 70% de `profiles.protein_goal_g`, chama
`sendPushAi(type='protein_reminder', ctx)` com contexto rico.

**Where:**
- `supabase/functions/cron-protein-reminder/index.ts`
- `supabase/functions/cron-protein-reminder/deno.json`

**Depends:** T1, T2, T3.

**Done-when:**
- Função usa `food_logs` agregando `SUM(protein_g)` por dia BRT.
- Pula alunos sem `protein_goal_g` (skip_reason: `no_goal`).
- Resposta JSON inclui `processed`, `sent`, `skipped`,
  `skipReasons`.
- Smoke test `dry_run` em `send-push-ai` retorna 200 com title+body
  gerados.

---

## T6 — Edge Function `cron-daily-workout-check`

**What:** cron que roda 20h30 BRT, infere padrão semanal de treino
do aluno pelas últimas 4 semanas (28 dias), e envia push só se hoje
é dia típico de treino E não houve `workout_sessions` hoje.

**Where:**
- `supabase/functions/cron-daily-workout-check/index.ts`
- `supabase/functions/cron-daily-workout-check/deno.json`

**Depends:** T1, T2, T3.

**Done-when:**
- Calcula `pattern[1..7]` em memória (não precisa de novas tabelas).
- Pula se aluno tem < 28 dias de histórico (skip_reason:
  `not_enough_history`).
- Pula se hoje não é dia típico (skip_reason: `rest_day`).
- Pula se já houve treino hoje (skip_reason: `already_trained`).

---

## T7 — Edge Function `cron-streak-warning`

**What:** cron que roda 21h30 BRT, calcula streak terminando em
ONTEM, se >= 2 E nenhum registro hoje (food/water/workout), envia
push.

**Where:**
- `supabase/functions/cron-streak-warning/index.ts`
- `supabase/functions/cron-streak-warning/deno.json`

**Depends:** T1, T2, T3.

**Done-when:**
- Função reaproveita lógica de `currentStreak` (pode duplicar do
  `cron-streak-celebrations` ou extrair pra `_shared`).
- Pula se streak < 2 (skip_reason: `streak_too_short`).
- Pula se já houve registro hoje (skip_reason: `active_today`).

---

## T8 — `package.json` — script `fn:deploy`

**What:** adicionar os 4 novos nomes ao script `fn:deploy`.

**Where:** `/home/robson/www/_estudos/pessoal/nutrion/app/package.json`.

**Depends:** T4-T7 (precisa que as pastas existam pro deploy).

**Done-when:**
- Script lista todas as funções (ordem: água, proteína, workout
  check, streak warning).
- `npm run fn:deploy --dry-run` (se suportado) não acusa erro de
  pasta inexistente.

---

## T9 — `src/types/database.ts` — sincronizar tipos do cliente

**What:** adicionar `'protein_reminder' | 'daily_workout_check' |
'streak_warning'` ao `PushType` e os 3 novos motivos ao
`PushHistorySkipReason` (`'no_goal' | 'rest_day' |
'not_enough_history'` etc.).

**Where:** `src/types/database.ts`.

**Depends:** T1.

**Done-when:**
- `npm run typecheck` passa.
- `app/notificacoes.tsx` (T10) compila com os novos tipos.

---

## T10 — `app/notificacoes.tsx` — UI de preferências

**What:** adicionar 3 entradas ao array `ITEMS` para os tipos novos
(label PT-BR + descrição + audience). Ajustar descrição do
`water_reminder` pra refletir o novo posicionamento ("fim do dia"
em vez de "à tarde").

**Where:** `/home/robson/www/_estudos/pessoal/nutrion/app/app/notificacoes.tsx`.

**Depends:** T9.

**Done-when:**
- `npm run typecheck` passa.
- Renderiza no `(perfil) → notificações` sem warning.
- Toggle de cada novo tipo grava em `push_preferences` (verificado
  manualmente após deploy).

---

## T11 — Documentar Natação como sem imagem

**What:** adicionar comentário SQL em `exercises` ou em uma seção
de docs explicando que `Natação` fica com `image_urls IS NULL` por
design — a fonte CC0 usada (`yuhonas/free-exercise-db`) não tem.

**Where:** uma das opções:
- Comentário no topo de uma migration nova
  (`20260524000000_push_v3_new_types.sql` se quiser anexar) OU
- Bloco em `.specs/codebase/STRUCTURE.md` na seção do catálogo de
  exercícios.

**Depends:** —

**Done-when:**
- O comentário/docs deixa claro que não é bug.

---

## T12 — Verificação final (typecheck + lint)

**What:** rodar `npm run typecheck` e `npm run lint` na raiz.

**Where:** raiz do projeto.

**Depends:** T1-T11.

**Done-when:**
- `npm run typecheck` retorna 0.
- `npm run lint` retorna 0 (ou só warnings pré-existentes).

---

## Checklist pós-merge (não é task de código)

- [ ] `npm run db:push` para aplicar migration v3 + a v2 se ainda
      não foi aplicada.
- [ ] `npm run fn:deploy` para subir as 4 novas Edge Functions.
- [ ] No painel Supabase → Database → Cron Jobs, criar 4 jobs:
  - `cron-water-reminder` — `0 23 * * *` (20h BRT)
  - `cron-protein-reminder` — `0 0 * * *` (21h BRT)
  - `cron-daily-workout-check` — `30 23 * * *` (20h30 BRT)
  - `cron-streak-warning` — `30 0 * * *` (21h30 BRT)
- [ ] Confirmar (e agendar, se faltar) `cron-streak-celebrations`
      no painel — diário 23:30 UTC (20h30 BRT).
- [ ] Smoke test cada tipo via `send-push-ai` com `dry_run: true`.
- [ ] Validar imagens em produção:
  ```sql
  select name from public.exercises
  where image_urls is null order by name;
  ```
  Esperado: só `Natação`. Se mais, aplicar migrations idempotentes.
