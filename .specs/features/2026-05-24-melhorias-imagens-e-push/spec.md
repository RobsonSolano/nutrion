# Melhorias de imagens de exercícios e novos pushes contextuais

> Branch: `feature/melhorias-imagens-e-push`
> Criada em: 2026-05-24

## 1. Contexto e motivação

Duas frentes correlacionadas que apareceram após a entrega da feature anterior
de push (`push-ai-notifications`) e da integração com YouTube por exercício:

### Frente A — imagens de exercícios

Mesmo após a migration `20260519000000_exercise_images_v2.sql` (que mapeou
exercícios faltantes), o usuário percebeu rotinas com exercícios "sem
imagem". A suspeita era que itens simples (cadeira adutora/abdutora) não
tivessem imagem na lib gratuita.

**Constatação após auditoria (este documento):**

- Cruzando os mapeamentos das 3 migrations que populam imagens
  (`20260423140000`, `20260428130000`, `20260519000000`) contra a lista
  de exercícios das seeds, **apenas `Natação` permanece sem
  mapeamento**. A `yuhonas/free-exercise-db` (CC0) usada como fonte
  primária não tem natação por design (foco em musculação/calistenia).
- `Cadeira adutora` e `Cadeira abdutora` JÁ estão mapeadas
  (`Thigh_Adductor`, `Thigh_Abductor`) na v2.
- Hipótese mais provável pro relato do usuário: **a migration v2 ainda
  não foi aplicada em produção** (Supabase remoto), apesar de estar no
  repo. Item de verificação obrigatório antes de implementar.

### Frente B — apenas 1 tipo de push chegando

O usuário só recebe o push de inatividade (2+ dias sem registro). A spec
anterior (`push-ai-notifications`) listava 8 tipos previstos, mas só dois
chegaram a virar Edge Function:

- `cron-inactivity-reminders` (rodando, agendado no painel Supabase) ✅
- `cron-streak-celebrations` (existe mas só dispara em marcos
  3/7/14/30/60/100 — dias intermediários não geram push) ✅

Os demais tipos planejados (`daily_workout_reminder`, `water_reminder`,
`weekly_summary`, `coach_adherence_alert`, `coach_plan_update`,
`goal_achieved`) **nunca foram implementados**.

O usuário pediu especificamente:

- Aviso de fim de dia se **água** não bateu meta.
- Aviso de fim de dia se **proteína** não bateu meta.
- "Eii, não treinou hoje?" — respeitando dias de descanso.
- Aviso quando estiver a 1 dia de quebrar uma sequência ("já são 6/7,
  não quebre a semana perfeita").

## 2. User stories

| ID | Como | Quero | Pra |
|----|------|-------|-----|
| **IMG-01** | usuário | que todos os exercícios catalogados com mapeamento conhecido tenham `image_urls` em produção | a UI não cair no fallback "sem imagem" desnecessariamente |
| **IMG-02** | usuário | que Natação seja tratada explicitamente como sem imagem disponível (não é gap de mapeamento) | parar de procurar imagem que não existe na lib usada |
| **PUSH-W1** | aluno | receber um lembrete às 20h quando ainda não bati a meta de água | poder corrigir antes de fechar o dia |
| **PUSH-P1** | aluno | receber um lembrete às 21h quando ainda não bati a meta de proteína | corrigir via última refeição ou pelo menos saber do gap |
| **PUSH-T1** | aluno | receber um lembrete na noite se hoje é um dia em que costumo treinar e não treinei | não furar a semana sem perceber |
| **PUSH-T2** | aluno | NÃO receber lembrete de treino em dias que costumam ser de descanso pra mim | que o app respeite meu padrão |
| **PUSH-S1** | aluno | receber um aviso quando estou em uma sequência de registros e ainda não registrei hoje | não quebrar a streak por esquecimento |
| **PUSH-S2** | aluno | que esse aviso de streak não venha junto com outros pushes do dia | não me sentir spammado |

## 3. Critérios de aceite (rastreáveis)

### Imagens

- **IMG-01.1** QUANDO eu (dev) rodar a query
  `SELECT name FROM exercises WHERE image_urls IS NULL ORDER BY name`
  na produção, ENTÃO o resultado deve conter apenas `Natação`.
- **IMG-01.2** SE a query retornar mais de 1 linha, ENTÃO a migration
  v2 ainda não foi aplicada — aplicar via `npm run db:push` antes de
  prosseguir com a frente de push.
- **IMG-02.1** QUANDO a UI renderizar uma rotina contendo `Natação`,
  ENTÃO ela deve exibir o fallback existente (nome + botão YouTube)
  sem warning no console — comportamento atual aceito.
- **IMG-02.2** Documentar `Natação` em `_shared/` ou em comentário SQL
  como "sem imagem por design" pra não voltar como bug.

### Pushes — `water_reminder` (fim de dia)

Reaproveita o slug `water_reminder` já presente no enum
`push_type`. **Reposicionado**: não é mais "lembrete horário no meio
do dia" (spec antiga); é "alerta de fim de dia se não bateu meta".

- **PUSH-W1.1** QUANDO o cron rodar às 20h BRT (23h UTC), ENTÃO ele
  deve selecionar alunos com `expo_push_token IS NOT NULL` E
  `water_logs.volume_ml` do dia < 50% de `profiles.water_goal_ml`.
- **PUSH-W1.2** Texto é template fixo (sem IA): título
  `"Faltando água"`, corpo
  `"Você bebeu Xml de Yml hoje. Ainda dá tempo."`.
- **PUSH-W1.3** Cooldown: 1×/dia. Não envia se já existe um
  `push_history` com `type='water_reminder'` E `status='sent'` E
  `sent_at >= hoje_brt`.
- **PUSH-W1.4** Respeita opt-out via `push_preferences.enabled=false`.
- **PUSH-W1.5** Registra envio em `push_history` com `ai_generated=false`,
  sem custo em `ai_usage_log`.

### Pushes — `protein_reminder` (NOVO)

- **PUSH-P1.1** QUANDO o cron rodar às 21h BRT (00h UTC do dia
  seguinte), ENTÃO ele deve selecionar alunos com
  `expo_push_token IS NOT NULL` E `SUM(food_logs.protein_g) WHERE
  created_at::date = hoje_brt` < 70% de `profiles.protein_goal_g`.
- **PUSH-P1.2** Conteúdo gerado por IA (Llama 3.3 70B via Groq).
  Contexto injetado no prompt: `full_name`, `protein_consumed_g`,
  `protein_goal_g`, `meals_logged_today`, `goal_type`.
- **PUSH-P1.3** Tom: não punitivo. Cita o número (gap em gramas) e
  sugere ação concreta (ex: "faltam 40g, um shake resolve"). Sem
  emoji, sem clichê motivacional — segue a persona do app.
- **PUSH-P1.4** Cooldown: 1×/dia.
- **PUSH-P1.5** Adicionar `'protein_reminder'` ao enum
  `public.push_type` e `'push_protein'` ao check
  `ai_usage_log_feature_check`.
- **PUSH-P1.6** Respeita opt-out via `push_preferences`.
- **PUSH-P1.7** Se a meta `profiles.protein_goal_g` for NULL OU
  `<= 0`, o aluno é PULADO (skip_reason: `no_goal`). Não tentar
  inferir.

### Pushes — `daily_workout_check` (NOVO — "não treinou hoje?")

Inferência de padrão sem mudar schema (`workout_routines` não tem
`day_of_week`).

- **PUSH-T1.1** QUANDO o cron rodar às 20h30 BRT (23h30 UTC), ENTÃO
  pra cada aluno com `expo_push_token IS NOT NULL`:
  - Calcula `pattern[1..7]` = pra cada dia da semana, quantos
    `workout_sessions` houve nas últimas 4 semanas (28 dias).
  - O dia da semana de hoje (BRT) é considerado **dia típico de
    treino** SE `pattern[dia_de_hoje] >= 2`. (Pelo menos 2 das 4
    últimas semanas treinou nesse dia.)
  - SE hoje é dia típico E `count(workout_sessions WHERE day = hoje_brt) = 0`,
    enviar push.
- **PUSH-T1.2** Conteúdo por IA. Contexto: `full_name`, dia da
  semana de hoje em PT-BR, `weekly_workouts_done` (esta semana
  ISO), `weekly_workouts_pattern` (média histórica), `goal_type`.
- **PUSH-T1.3** Tom: leve, não cobrador. Reconhece que pode ser
  descanso ("se hoje é descanso, ignora — mas geralmente você
  treina às terças").
- **PUSH-T1.4** Cooldown: 1×/dia.
- **PUSH-T2.1** QUANDO o dia de hoje NÃO é dia típico
  (`pattern[dia_de_hoje] < 2`), ENTÃO não envia push (skip_reason:
  `rest_day`).
- **PUSH-T2.2** QUANDO o aluno tem MENOS de 28 dias de histórico
  total, ENTÃO não envia push (skip_reason: `not_enough_history`).
- **PUSH-T1.5** Adicionar `'daily_workout_check'` ao enum
  `push_type` e `'push_workout_check'` ao
  `ai_usage_log_feature_check`.
- **PUSH-T1.6** Respeita opt-out.

### Pushes — `streak_warning` (NOVO — "não quebre a sequência")

- **PUSH-S1.1** QUANDO o cron rodar às 21h30 BRT (00h30 UTC), ENTÃO
  pra cada aluno com `expo_push_token IS NOT NULL`:
  - Calcula `streak_ate_ontem` = nº de dias consecutivos com
    registro (food/water/workout) terminando ontem.
  - SE `streak_ate_ontem >= 2` E **não houve nenhum registro hoje**
    (food/water/workout), enviar push.
- **PUSH-S1.2** Conteúdo por IA. Contexto: `full_name`,
  `current_streak` (= `streak_ate_ontem`), `goal_type`.
- **PUSH-S1.3** Tom: urgente mas não dramático. Cita o número exato
  da sequência. Ex.: "6 dias seguidos — falta 1 registro pra
  fechar o dia".
- **PUSH-S1.4** Cooldown: 1×/dia.
- **PUSH-S2.1** Sem janela de quiet hours adicional: o cron já
  roda no horário-limite (21h30). Confiar no `_shared/pushAi.ts`
  existente pra respeitar a regra global anti-spam.
- **PUSH-S1.5** Adicionar `'streak_warning'` ao enum `push_type` e
  `'push_streak_warning'` ao `ai_usage_log_feature_check`.
- **PUSH-S1.6** Respeita opt-out.

## 4. Mudanças de schema

Uma única migration nova:
`supabase/migrations/20260524000000_push_v3_new_types.sql`

### 4.1 Estender enum `push_type`

Tipos a adicionar:

- `protein_reminder`
- `daily_workout_check`
- `streak_warning`

> Postgres permite `ALTER TYPE ... ADD VALUE` apenas fora de
> transação. Migration usa bloco `COMMIT;` explícito ou run-section
> com `IF NOT EXISTS` (Postgres 12+). Tratar de forma idempotente
> via `pg_enum` lookup.

### 4.2 Estender `ai_usage_log_feature_check`

Adicionar slugs:

- `push_protein`
- `push_workout_check`
- `push_streak_warning`

Implementação: drop + recreate do CHECK constraint com lista
completa atualizada (segue padrão das migrations anteriores
`20260512000000` e `20260521000000`).

### 4.3 Sem novas tabelas

Reutilizamos integralmente `push_preferences` e `push_history`. Os
campos existentes (`type`, `enabled`, `preferred_time`, `status`,
`skip_reason`, etc.) já comportam os novos tipos.

## 5. Mudanças de código

### 5.1 `_shared/pushPrompts.ts`

- Estender o tipo `PushType` adicionando os 3 novos slugs.
- Adicionar `aiUsageFeature(type)` para retornar
  `push_protein` / `push_workout_check` / `push_streak_warning`.
- Adicionar `buildUserPrompt(type, ctx)` para os 3 novos tipos
  (prompts em PT-BR, persona-aware — texto-base em §6).
- Adicionar `staticTemplate(type, ctx)` para fallback de cada novo
  tipo (usado quando IA falha) + para `water_reminder` reposicionar
  o template existente pra "fim de dia" em vez de "horário do dia".

### 5.2 `_shared/pushAi.ts`

Verificar se a tabela `COOLDOWNS` ou similar já existe lá. Adicionar
cooldown de 24h para os 4 tipos (`water_reminder` reaproveitado,
`protein_reminder`, `daily_workout_check`, `streak_warning`).

> Item a confirmar na fase Execute: ler o estado atual de
> `pushAi.ts` (não inspecionado nesta spec). Pode ser que o cooldown
> seja resolvido por consulta dinâmica em `push_history`, sem
> tabela de configuração.

### 5.3 Novas Edge Functions

Quatro funções novas seguindo o padrão de
`cron-inactivity-reminders` / `cron-streak-celebrations`:

```
supabase/functions/
  cron-water-reminder/         (template fixo, sem IA)
    index.ts
    deno.json
  cron-protein-reminder/       (IA)
    index.ts
    deno.json
  cron-daily-workout-check/    (IA + inferência de padrão)
    index.ts
    deno.json
  cron-streak-warning/         (IA)
    index.ts
    deno.json
```

Estrutura comum:

1. CORS + autenticação via `X-Cron-Secret`.
2. Cliente Supabase com `SERVICE_ROLE_KEY`.
3. Query de seleção (alunos elegíveis pro tipo do dia).
4. Loop com `THROTTLE_MS = 100` entre chamadas.
5. Cada iteração chama `sendPushAi(supabase, userId, type, ctx)`.
6. Resposta JSON com `processed`, `sent`, `skipped`, `skipReasons`.

### 5.4 `package.json` — script `fn:deploy`

Adicionar os 4 novos nomes ao script existente para que
`npm run fn:deploy` continue cobrindo o conjunto completo.

### 5.5 SEM mudanças na UI

A tela de preferências de push (se existir em `(perfil)/notificacoes`)
**não** precisa ser alterada nesta feature — `push_preferences` já é
genérico por tipo e a tela presumivelmente itera sobre o enum. Item
a verificar na fase Execute.

## 6. Prompts da IA (PT-BR)

Todos os prompts herdam a `PERSONA_SYSTEM` já definida em
`pushPrompts.ts`. Limites duros: título ≤ 50 chars, corpo ≤ 120,
JSON, sem emoji/markdown, PT-BR com acentuação.

### `protein_reminder`

```
Contexto:
- Nome: {full_name}
- Proteína consumida hoje: {protein_consumed_g}g
- Meta diária: {protein_goal_g}g
- Gap: {gap_g}g
- Refeições registradas hoje: {meals_logged_today}
- Objetivo: {goal_type}

Gere um push avisando do gap de proteína. Cita o número em gramas. Sugere
ação prática (shake, ovos, atum, frango). Não culpa nem moraliza. Se o
gap é pequeno (<20g), tom leve; se é grande (>50g), tom mais direto.
```

### `daily_workout_check`

```
Contexto:
- Nome: {full_name}
- Hoje é: {weekday_pt} ({date_brt})
- Treinos esta semana: {weekly_workouts_done}
- Padrão (últimas 4 semanas): você costuma treinar em {typical_weekdays_pt}
- Objetivo: {goal_type}

Gere um push perguntando se hoje é descanso ou esquecimento. Reconhece
que pode ser descanso planejado. Curto e leve. Não cobra.
```

### `streak_warning`

```
Contexto:
- Nome: {full_name}
- Sequência atual (até ontem): {current_streak} dias
- Objetivo: {goal_type}

Gere um push avisando que a sequência pode quebrar se não houver
registro hoje. Cita o número exato. Tom de "alerta de amigo" — sem
desespero. Sugere ação rápida (água, refeição ou treino).
```

### `water_reminder` (reposicionado)

Continua sem IA. Atualizar `staticTemplate` em `pushPrompts.ts`:

```ts
case 'water_reminder':
  return {
    title: 'Faltando água',
    body: `Você bebeu ${ctx.water_now_ml ?? 0}ml de ${ctx.water_goal_ml ?? 2500}ml hoje. Ainda dá tempo.`,
  };
```

## 7. Agendamento dos crons (painel Supabase)

Manter no painel (Dashboard → Database → Cron Jobs), padrão atual do
projeto. Documentar agendamentos a criar:

| Função | Cron (UTC) | Horário BRT (UTC-3) |
|---|---|---|
| `cron-water-reminder` | `0 23 * * *` | 20:00 |
| `cron-protein-reminder` | `0 0 * * *` | 21:00 (mesmo dia) |
| `cron-daily-workout-check` | `30 23 * * *` | 20:30 |
| `cron-streak-warning` | `30 0 * * *` | 21:30 (mesmo dia) |

Cada job faz `POST` para
`https://<project>.supabase.co/functions/v1/<nome-da-funcao>` com
header `X-Cron-Secret: <CRON_SECRET>`.

> **Atenção a um detalhe operacional já registrado em memória:**
> `net.http_post` no Supabase Cron tem timeout máximo de 5000ms.
> Tratar essas funções como fire-and-forget e auditar resultados via
> `push_history`. Já é o padrão dos crons existentes.

## 8. Por que só recebia 1 push (diagnóstico)

Para o usuário entender o estado atual antes da implementação:

1. `cron-inactivity-reminders` — agendado no painel, roda diariamente,
   manda push sempre que há aluno com 2+ dias sem registro. Por isso é
   o único que chega.
2. `cron-streak-celebrations` — **existe como Edge Function**, mas
   **só dispara em marcos específicos** (3, 7, 14, 30, 60, 100 dias).
   Dias intermediários não geram push. **A confirmar**: este job está
   agendado no painel? Se não, nunca rodou.
3. Todos os outros tipos da spec antiga (`daily_workout_reminder`,
   `water_reminder`, `weekly_summary`, etc.) **nunca foram
   implementados como Edge Function** — estão só no enum.

Esta feature implementa 4 tipos novos (sendo um deles uma releitura
de `water_reminder`) e deixa os outros 4 da spec antiga
(`daily_workout_reminder` manhã, `weekly_summary`,
`coach_adherence_alert`, `coach_plan_update`, `goal_achieved`) para
features futuras.

## 9. Pontos a confirmar na fase Execute

- `[CONFIRMAR]` Rodar query em produção para validar que apenas
  `Natação` está com `image_urls IS NULL`. Se houver outros, aplicar
  `npm run db:push` (idempotente).
- `[CONFIRMAR]` `cron-streak-celebrations` está realmente agendado no
  painel? Se não, agendar junto com os 4 novos.
- `[CONFIRMAR]` Ler o estado atual de `_shared/pushAi.ts` antes de
  ajustar cooldowns — pode já estar implementado por consulta dinâmica
  e dispensar mudança.
- `[CONFIRMAR]` A tela de preferências de push existe e itera sobre o
  enum dinamicamente? Se não, ajustar pra incluir os 3 novos rótulos
  PT-BR.
- `[CONFIRMAR]` Threshold de 70% pra `protein_reminder` e 50% pra
  `water_reminder` — números razoáveis pro MVP, podemos ajustar após
  observar comportamento real.
- `[CONFIRMAR]` `streak_warning` X-1: o critério é
  `streak_ate_ontem >= 2` (= a partir do 3º dia em diante). Em uma
  sequência de 6 dias, o aviso vem no dia 7 caso não tenha registro
  ainda às 21h30 — coerente com o relato do usuário ("6/7").

## 10. Escopo explícito FORA desta feature

- Imagem específica pra `Natação` (lib usada não tem, e ficou
  acordado deixar o fallback YouTube).
- Adicionar `day_of_week` em `workout_routines` (preterido pela
  inferência de padrão histórico).
- `daily_workout_reminder` (manhã com nome do treino) — depende de
  `day_of_week` em rotinas, fica pra v2.
- `weekly_summary`, `coach_adherence_alert`, `coach_plan_update`,
  `goal_achieved` — features separadas.
- Persona customizável por coach — fora do MVP, segue como item de
  roadmap futuro.
- Configuração granular de horários por aluno (`preferred_time` em
  `push_preferences`) — já há coluna no schema, mas a UI/lógica para
  honrar fica pra v2.

## 11. Estimativa

| Bloco | Estimativa |
|---|---|
| Migration `20260524000000_push_v3_new_types.sql` + validação prod | 0,5d |
| `pushPrompts.ts` + ajustes em `pushAi.ts` | 0,5d |
| 4 Edge Functions (cron-*) | 2d |
| Atualização `package.json` deploy + smoke tests via `dry_run` | 0,5d |
| Documentação e agendamento manual no painel | 0,5d |
| **Total** | **~4 dias úteis** |
