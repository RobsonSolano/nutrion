# Feature: Push Notifications com IA

## 1. Visão e justificativa

Hoje o NutriOn tem **um único push automatizado**: `cron-inactivity-reminders`,
que dispara uma frase fixa ("Sentimos sua falta!") pra qualquer aluno com 2+
dias sem registro. Funciona, mas é genérico — todo aluno recebe a mesma
mensagem, todo dia, com o mesmo tom. Em pouco tempo o usuário ignora.

O objetivo dessa feature é transformar o sistema de push num **canal de
engajamento contextualizado por IA**, com várias trilhas (inatividade,
streak, treino do dia, resumo semanal, alertas pra coach), cada uma
personalizada com dados reais do aluno (nome, objetivo, frequência,
último treino, % de aderência).

### Gap vs MFIT

O MFIT (referência conhecida do mercado fitness BR) usa IA pra gerar push,
mas de forma **trivial**: o mesmo prompt fixo gera variações de uma
mensagem motivacional. Não há contexto real do usuário, não há diferentes
trilhas, não há alertas pro coach. É IA cosmética.

A proposta do NutriOn é diferente:

- **Múltiplas trilhas** com gatilhos distintos (inatividade, streak,
  resumo semanal, aderência caindo, novo plano do coach).
- **Contexto real** injetado no prompt (objetivo do aluno, último treino,
  % de consistência da semana, nome do coach).
- **Persona consistente** — o "voz" do app fica reconhecível, não é só
  texto motivacional aleatório.
- **Alertas operacionais pro coach** — IA não é só pro aluno; o coach
  recebe alertas quando aderência de um aluno cai, com sugestão de ação.
- **Opt-out granular** — usuário desliga *por tipo* de push, não tudo de
  uma vez (problema clássico do MFIT: o jeito é desligar push do app
  inteiro).

### Por que faz sentido agora

- Já temos infra de push (`expo_push_token` em `profiles`,
  `_shared/expoPush.ts`).
- Já temos pipeline de IA via Groq (3 features em produção: chat-ai,
  onboarding-plan, coach-generate-plan).
- Já temos `ai_usage_log` com tokens, duração, status — basta estender o
  `feature` enum.
- Groq é barato e rápido o suficiente pra rodar em batch (1k alunos em
  alguns minutos).

## 2. Tipos de push mapeados

| # | Tipo (slug) | Trigger | Audiência | Cooldown | IA? | Custo IA estimado | Prio |
|---|---|---|---|---|---|---|---|
| 1 | `inactivity_reminder` | Cron diário 12:00 BRT, alunos com 2+ dias sem registro | aluno | 1×/dia, máx 3×/semana por aluno | sim | ~250 tok in + 80 tok out = ~330 tok | **P0** |
| 2 | `streak_celebration` | Cron diário 19:00 BRT, alunos que fecharam X dias seguidos (3, 7, 14, 30, 60, 100) | aluno | 1×/marco, sem repetir o mesmo número | sim | ~200 tok in + 60 tok out = ~260 tok | **P0** |
| 3 | `daily_workout_reminder` | Cron 07:00 BRT (configurável por aluno), dias em que tem treino agendado e ainda não foi feito | aluno | 1×/dia | sim | ~300 tok in + 80 tok out = ~380 tok | P1 |
| 4 | `water_reminder` | Cron horário 10/14/17h BRT, aluno com `water_logs` < 50% da meta no horário | aluno | 1×/janela horária, máx 3×/dia | **não** (templates fixos rotativos) | 0 | P2 |
| 5 | `weekly_summary` | Cron domingo 18:00 BRT | aluno | 1×/semana | sim | ~500 tok in + 150 tok out = ~650 tok | P1 |
| 6 | `coach_adherence_alert` | Cron diário 09:00 BRT, alunos com aderência <50% nos últimos 7 dias e queda vs semana anterior | **coach** | 1×/aluno/semana, agrupado se múltiplos | sim | ~400 tok in + 120 tok out = ~520 tok | P1 |
| 7 | `coach_plan_update` | Evento: `student_plan_revisions` insert (coach publicou plano novo) | aluno | sem cooldown (raro) | sim | ~250 tok in + 80 tok out = ~330 tok | P1 |
| 8 | `goal_achieved` | Evento: `progress_entries` mostra peso = `goal_weight_kg` (±0.3kg) ou marco intermediário (50%, 75% do caminho) | aluno | 1×/marco, sem repetir | sim | ~300 tok in + 100 tok out = ~400 tok | P2 |

### Notas por tipo

**1. inactivity_reminder** — refator do cron existente. Prompt recebe
`full_name`, `goal_type`, dias inativo, último marco recente. Saída
varia: tom amigo se é a 1ª vez, tom direto se é a 3ª vez na semana.

**2. streak_celebration** — celebra marcos (3/7/14/30/60/100 dias com
pelo menos 1 registro qualquer — food, water ou workout). Garante não
repetir o mesmo marco com tabela `push_history`.

**3. daily_workout_reminder** — depende de `workout_routines` ter
`day_of_week`. Prompt cita o nome do treino de hoje e o objetivo do
aluno. Manhã, default 07:00, com `[CONFIRMAR]` se a horária deve ser
configurável por aluno no MVP ou só na v2.

**4. water_reminder** — **sem IA de propósito**. Templates fixos
rotativos ("Bora bater a meta de água? Já são X ml hoje.") porque (a)
chamada IA pra cada aluno × 3 horários × 1k alunos = 3k chamadas/dia
que não acrescentam valor nenhum, (b) frase de água é simples demais
pra IA fazer diferença.

**5. weekly_summary** — IA recebe contexto rico (treinos da semana,
calorias médias, água média, progresso de peso) e escreve 2-3 frases
celebrando o que deu certo + 1 frase de orientação. Domingo à noite
quando a pessoa tá planejando a semana.

**6. coach_adherence_alert** — IA gera uma mensagem **pro coach**
sugerindo ação ("Maria caiu pra 30% essa semana, chama ela. Última
queixa foi cansaço."). Se um coach tem 5 alunos em alerta no mesmo
dia, agrupa em 1 push: "5 alunos precisam de atenção essa semana".

**7. coach_plan_update** — quando coach publica plano novo, push pro
aluno: "Seu coach acabou de atualizar seu treino. Bora conferir?". IA
personaliza com o nome do coach e tipo de mudança (treino vs dieta vs
ambos).

**8. goal_achieved** — celebração de meta (peso atingido, marco
intermediário). Tom forte, curto, emocional.

## 3. User stories

| ID | Como | Quero | Pra |
|----|------|-------|-----|
| **PUSH-01** | aluno | receber lembrete personalizado quando fico 2+ dias sem registrar | voltar pro app sem ser tratado como número |
| **PUSH-02** | aluno | ser parabenizado quando bato marco de constância (3/7/14/30 dias) | sentir que o app reconhece meu esforço |
| **PUSH-03** | aluno | receber lembrete de manhã do meu treino do dia | não esquecer e não precisar abrir o app pra ver |
| **PUSH-04** | aluno | receber lembrete de água nos horários que esqueço | bater a meta diária |
| **PUSH-05** | aluno | receber resumo da minha semana no domingo à noite | refletir e ajustar a próxima semana |
| **PUSH-06** | coach | ser avisado quando aderência de um aluno cai | poder agir antes de perder o aluno |
| **PUSH-07** | aluno | ser avisado imediatamente quando meu coach atualiza meu plano | conferir o que mudou sem precisar checar o app toda hora |
| **PUSH-08** | aluno | ser parabenizado quando bato minha meta de peso (ou 50%/75% do caminho) | celebrar conquista |
| **PUSH-09** | aluno e coach | desligar **um tipo específico** de push sem desligar todos | ter controle granular |
| **PUSH-10** | aluno | que dois pushes diferentes não cheguem com 5min de diferença | não me sentir spammado |
| **PUSH-11** | admin | ver no log de IA quanto cada tipo de push está custando | tomar decisões de roadmap baseadas em dado |

## 4. Schema

### Decisão: tabela dedicada `push_preferences` (não JSON em profiles)

**Recomendação: tabela `push_preferences`.**

Razões:

- Cada tipo precisa de **mais que um boolean**: (a) habilitado, (b)
  horário preferido (pra `daily_workout_reminder` e `water_reminder`),
  (c) último envio (pra cooldown). JSON em profile vira cabeçudo
  rapidinho.
- Defaults via NOT EXISTS são mais limpos com tabela: se não tem linha,
  assume default true. Não precisa migrar JSON quando adicionar tipo
  novo.
- Query de "quais alunos opt-in pra streak_celebration" vira `JOIN`
  simples, índice trivial. Em JSON precisa parsear todos os profiles
  num cron — não escala.
- Auditoria: `updated_at` por tipo permite saber quando o usuário
  desativou cada um (útil pra produto entender churn de notificação).

### Migration `20260520000000_push_preferences.sql`

```sql
-- Tipos canônicos de push.
create type public.push_type as enum (
  'inactivity_reminder',
  'streak_celebration',
  'daily_workout_reminder',
  'water_reminder',
  'weekly_summary',
  'coach_adherence_alert',
  'coach_plan_update',
  'goal_achieved'
);

create table public.push_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.push_type not null,
  enabled boolean not null default true,
  preferred_time time, -- null = usar default global do tipo
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

-- Histórico de envios — pra cooldown e auditoria.
create table public.push_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.push_type not null,
  title text not null,
  body text not null,
  data jsonb,
  ai_generated boolean not null default false,
  ai_tokens int,
  expo_response jsonb,
  status text not null check (status in ('sent','failed','skipped')),
  skip_reason text, -- 'no_token' | 'opted_out' | 'cooldown' | 'rate_limit'
  sent_at timestamptz not null default now()
);

create index push_history_user_type_sent_idx
  on public.push_history (user_id, type, sent_at desc);

create index push_history_sent_at_idx
  on public.push_history (sent_at desc);

-- RLS: dono lê o próprio.
alter table public.push_preferences enable row level security;
alter table public.push_history enable row level security;

create policy "push_prefs_own" on public.push_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_history_select_own" on public.push_history
  for select using (auth.uid() = user_id);
-- Insert é só via service_role (edge function).
```

### Estende `ai_usage_log.feature`

```sql
alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in (
    'chat','sanity_check','onboarding_plan','coach_plan',
    'push_inactivity','push_streak','push_workout',
    'push_weekly_summary','push_coach_alert','push_plan_update',
    'push_goal_achieved'
  ));
```

> Por que slug separado por tipo (`push_inactivity` vs genérico `push`)?
> Pra conseguir agrupar custo/tokens **por tipo** no dashboard de admin
> sem precisar de coluna extra. Já fica filtrável por enum.

## 5. Edge Functions

### Decisão: função única `send-push-ai` parametrizada + crons finos

**Recomendação:** uma função core `send-push-ai` que recebe
`{ user_id, type, context }` e faz **todo o trabalho comum**:

1. Verifica `push_preferences.enabled` pro tipo.
2. Verifica cooldown via `push_history`.
3. Carrega prompt template do tipo (do código, não do banco — versão
   no git).
4. Chama Groq com contexto.
5. Envia via Expo Push.
6. Loga em `push_history` + `ai_usage_log`.

E **crons finos** que só fazem a query "quem deve receber esse tipo
hoje?" e iteram chamando `send-push-ai`:

- `cron-inactivity-reminders` — refatorada (mantém o nome, troca
  conteúdo). Itera alunos sem registro 2+ dias → chama `send-push-ai`
  com `type='inactivity_reminder'` e contexto.
- `cron-streak-celebrations` (nova) — itera alunos que bateram marco
  hoje → `send-push-ai`.
- `cron-daily-workout-reminders` (nova).
- `cron-water-reminders` (nova) — não chama `send-push-ai`, chama
  `send-push-template` (sem IA, mais barato).
- `cron-weekly-summary` (nova, domingo).
- `cron-coach-adherence-alerts` (nova, segunda 09h).

E **eventos** via Supabase Database Webhooks:

- `coach_plan_update` — webhook em `student_plan_revisions` insert
  → chama edge function `event-coach-plan-update` → `send-push-ai`.
- `goal_achieved` — webhook em `progress_entries` insert → calcula se
  bateu marco → `send-push-ai`.

### Vantagens da arquitetura

- DRY: lógica de cooldown, opt-out, log e Groq vive em um lugar só.
- Testável isoladamente: dá pra chamar `send-push-ai` direto sem cron
  pra testar prompt novo.
- Cron fica burro (só `SELECT` + loop), bug em prompt não derruba cron.
- Adicionar tipo novo = adicionar um cron/webhook + um template de
  prompt + uma linha no enum. Não toca o core.

### Estrutura de arquivos

```
supabase/functions/
  _shared/
    expoPush.ts              (existente)
    pushAi.ts                (novo: helper Groq + log)
    pushTemplates.ts         (novo: templates fixos do water_reminder)
    pushPrompts.ts           (novo: todos os prompts em um arquivo)
  send-push-ai/              (novo: core)
    index.ts
  cron-inactivity-reminders/ (refator)
    index.ts
  cron-streak-celebrations/  (novo)
  cron-daily-workout-reminders/ (novo)
  cron-water-reminders/      (novo, sem IA)
  cron-weekly-summary/       (novo)
  cron-coach-adherence-alerts/ (novo)
  event-coach-plan-update/   (novo)
  event-goal-achieved/       (novo)
```

## 6. Prompts da IA (PT-BR)

Persona base (aplicada em todos os prompts, ver seção 7):

```
Você é a voz do NutriOn — um app de nutrição e treino com pegada brasileira,
direta, sem fofura. Fala "você", não "tu". Não usa emoji. Não usa frases
clichês de coach motivacional ("acredite em você", "vamos juntos"). É um
amigo que entende do assunto: curto, específico, e que conhece a pessoa.

Limites duros:
- Push tem TÍTULO até 50 caracteres e CORPO até 120 caracteres.
- Devolve JSON: { "title": "...", "body": "..." }.
- Sem markdown, sem emoji, sem aspas dentro do texto.
- Português brasileiro com acentuação correta.
```

### inactivity_reminder

```
Contexto:
- Nome: {full_name}
- Objetivo: {goal_type} ({goal_weight_kg} kg até {goal_target_date})
- Dias sem registrar nada: {days_inactive}
- Última atividade: {last_activity_summary}
- É a {nth_inactivity_reminder_in_week}ª vez essa semana

Gere um push lembrando a pessoa de voltar a registrar. Se for a 1ª vez
da semana, tom amigo. Se for 3ª, tom mais direto sem ser passivo-agressivo.
Cita o objetivo dela quando faz sentido.
```

### streak_celebration

```
Contexto:
- Nome: {full_name}
- Marco: {streak_days} dias seguidos com registro
- Tipo de registro mais frequente: {dominant_log_type}

Gere um push parabenizando pelo marco. Curto, específico, sem clichê.
Cita o número exato. Não fala "continue assim", fala algo concreto sobre
o próximo marco ou sobre o hábito.
```

### daily_workout_reminder

```
Contexto:
- Nome: {full_name}
- Treino de hoje: {today_workout_name} ({today_workout_focus})
- Objetivo: {goal_type}
- Constância da semana: {weekly_adherence_pct}%

Gere um push de manhã lembrando do treino. Cita o nome do treino. Tom
varia com a constância: alta = celebra; baixa = chamada direta sem
culpar.
```

### weekly_summary

```
Contexto da semana (segunda a domingo):
- Nome: {full_name}
- Treinos feitos: {workouts_done}/{workouts_planned}
- Refeições registradas: {meals_logged} (média/dia: {meals_avg})
- Água média/dia: {water_avg_ml} ml (meta: {water_goal_ml})
- Variação de peso: {weight_delta_kg} kg
- Maior conquista da semana: {top_win}
- Maior gap: {top_gap}

Gere um push de domingo à noite com o resumo. Título celebra o top_win
em poucas palavras. Corpo: 1 número que importa + 1 orientação concreta
pra próxima semana. Não é parágrafo motivacional.
```

### coach_adherence_alert

```
Você está escrevendo pra um PROFESSOR (coach), não pro aluno.

Contexto:
- Coach: {coach_name}
- Aluno: {student_name}
- Aderência últimos 7 dias: {adherence_7d}% (semana anterior: {adherence_prev}%)
- Última atividade: {last_activity_summary}
- Última nota do coach: {last_coach_note}

Gere um push curto e operacional pro coach. Título sinaliza qual aluno.
Corpo dá um dado e sugere uma ação ("Chama a Maria" / "Vale revisar a
carga"). NÃO usa tom motivacional — é alerta de gestão.
```

### coach_plan_update

```
Contexto:
- Aluno: {student_name}
- Coach: {coach_name}
- Tipo de mudança: {change_type} (treino|dieta|ambos)
- Resumo do que mudou: {change_summary}

Gere um push pro aluno avisando que o coach atualizou o plano. Cita
o nome do coach. Curto, convida a abrir o app.
```

### goal_achieved

```
Contexto:
- Nome: {full_name}
- Tipo de meta: {goal_type}
- Marco atingido: {milestone} (ex: "50% do caminho", "meta atingida")
- Peso inicial → atual: {start_weight} → {current_weight}
- Tempo até o marco: {days_to_milestone} dias

Gere um push celebrando o marco. Forte, curto, específico. Cita o
número (kg, dias). Sem clichê motivacional.
```

> **Modelo Groq**: `llama-3.3-70b-versatile` pra todos os tipos com IA.
> Llama 4 Scout fica de reserva pra weekly_summary (que tem contexto
> mais rico) — `[CONFIRMAR]` na fase de implementação se a qualidade
> do 70B já é boa o bastante (provavelmente sim, dado o tamanho do
> contexto).

## 7. Persona da IA

**Recomendação: persona única do NutriOn no MVP.**

Razões:

- Implementar persona customizável por coach é uma feature inteira
  (UI de edição, validação, A/B). Não cabe no MVP de push.
- Persona customizada faz sentido pros pushes que vêm do coach
  (`coach_plan_update`, `coach_adherence_alert`), mas:
  - `coach_plan_update` o coach é citado pelo nome — já dá identidade.
  - `coach_adherence_alert` vai pro próprio coach — persona é da
    plataforma, não do coach.
- Pra v2: dá pra adicionar coluna `coaches.push_persona_prompt`
  (texto livre de até 500 chars que é prependado ao prompt base).

**Decisão MVP:** persona única, hardcoded em `_shared/pushPrompts.ts`.

## 8. Cooldowns e rate limits

### Regras globais (anti-spam)

| Regra | Valor | Implementação |
|---|---|---|
| Máx pushes/dia por usuário | 3 (4 se incluir water) | Query em `push_history` pré-envio |
| Janela mínima entre 2 pushes | 30 minutos | Idem (exceto alertas críticos) |
| Tipos críticos (ignoram limite global) | `coach_plan_update`, `goal_achieved` | Flag no código |
| Hora silenciosa | 22:00–07:00 BRT | Cron não roda nessa janela; se evento dispara, agenda pra 07:00 |

### Cooldown por tipo

| Tipo | Cooldown |
|---|---|
| `inactivity_reminder` | 24h por usuário; máx 3×/semana |
| `streak_celebration` | 1× por marco (3/7/14/30/60/100) — nunca repete o mesmo número |
| `daily_workout_reminder` | 24h por usuário |
| `water_reminder` | 4h entre lembretes; máx 3×/dia |
| `weekly_summary` | 7 dias |
| `coach_adherence_alert` | 7 dias por (coach, aluno) |
| `coach_plan_update` | sem cooldown |
| `goal_achieved` | 1× por marco |

### Implementação no `send-push-ai`

```ts
async function checkCooldown(userId, type) {
  const last = await supabase
    .from('push_history')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return last ? withinCooldown(last.sent_at, COOLDOWNS[type]) : false;
}
```

Se em cooldown, registra em `push_history` com `status='skipped'`,
`skip_reason='cooldown'` (não envia, mas loga pra debug).

## 9. Custos esperados

### Premissas

- Groq pricing (Llama 3.3 70B Versatile, novembro 2026): **input $0,59
  / 1M tokens, output $0,79 / 1M tokens** (`[CONFIRMAR]` no momento da
  implementação — Groq mexe em pricing).
- 1.000 alunos ativos.
- Distribuição realista de quantos recebem cada tipo (não é todo dia,
  todo aluno).

### Estimativa diária (1k alunos ativos)

| Tipo | Volume/dia | Tokens médios | Tokens/dia | Custo/dia (USD) |
|---|---|---|---|---|
| `inactivity_reminder` | 200 (20% inativos) | 330 (250 in + 80 out) | 66.000 | $0,043 |
| `streak_celebration` | 80 (8% bate marco/dia) | 260 (200 + 60) | 20.800 | $0,014 |
| `daily_workout_reminder` | 600 (60% têm treino agendado) | 380 (300 + 80) | 228.000 | $0,143 |
| `water_reminder` | (sem IA) | 0 | 0 | $0 |
| `weekly_summary` | 1000/7 (média diária) | 650 (500 + 150) | 92.857 | $0,058 |
| `coach_adherence_alert` | 30 (3% alunos em queda/dia) | 520 (400 + 120) | 15.600 | $0,011 |
| `coach_plan_update` | 50 (eventos/dia) | 330 | 16.500 | $0,011 |
| `goal_achieved` | 5 (raro) | 400 | 2.000 | $0,001 |
| **Total/dia** | — | — | ~441 mil | **~$0,28/dia** |

### Estimativa mensal

- **~$8,40/mês pra 1.000 alunos ativos** (todos os tipos com IA).
- Por aluno/mês: **~$0,008** (menos de 1 centavo).
- 10× alunos (10k) = ~$84/mês — ainda barato.

### Custo do Llama 4 Scout 17B (caso usemos pro weekly_summary)

Pricing Scout: ~$0,11 in / $0,34 out (mais barato que 70B). Pra weekly
seria ~$0,02/dia em vez de $0,058. Ganho marginal — manter 70B no MVP.

### Conclusão

Custo de IA não é gargalo. O que importa monitorar:

1. **Custo de Edge Function invocations** (Supabase cobra por execução,
   não por tempo). 1k alunos × 6 tipos = 6k invocations/dia = 180k/mês.
   Free tier Supabase: 500k/mês. Cabe.
2. **Quota Groq** — free tier Groq tem rate limit por minuto. Em batch
   de 1k alunos pode estourar. Solução: throttle na função core
   (delay 100ms entre chamadas) ou conta paga.

## 10. Estimativa

| Fase | Escopo | Estimativa |
|---|---|---|
| **Fase 1 — Schema + core** | Migration `push_preferences` + `push_history`, extender `ai_usage_log`. Helper `pushAi.ts` + `pushPrompts.ts`. Core `send-push-ai` com cooldown, opt-out, log. Tela de preferências de push em `(perfil)/notificacoes`. | **2 dias** |
| **Fase 2 — P0 (MVP)** | Refator `cron-inactivity-reminders` (IA). Novo `cron-streak-celebrations`. Cron jobs configurados. | **1,5 dia** |
| **Fase 3 — P1** | `cron-daily-workout-reminders`, `cron-weekly-summary`, `cron-coach-adherence-alerts`, `event-coach-plan-update` (webhook). | **2,5 dias** |
| **Fase 4 — P2** | `cron-water-reminders` (templates), `event-goal-achieved`. | **1 dia** |
| **Fase 5 — Observabilidade** | Dashboard admin (custo por tipo, taxa de delivery, opt-out por tipo). | **1 dia** |
| **Total** | — | **~8 dias úteis** |

MVP enxuto (Fases 1+2) entrega valor em **3,5 dias** e já justifica a
feature do ponto de vista de produto.

## 11. Pontos a confirmar

- `[CONFIRMAR]` **Horários de cron em BRT vs UTC.** Edge Functions
  rodam em UTC. Alinhar conversão (12:00 BRT = 15:00 UTC, considerando
  fuso fixo de Brasília sem horário de verão).
- `[CONFIRMAR]` **`daily_workout_reminder` aceita configuração de
  horário por aluno no MVP** ou só global? Sugestão: começa global
  (07:00 BRT), v2 vira por aluno via `push_preferences.preferred_time`.
- `[CONFIRMAR]` **Modelo Groq pro weekly_summary** — manter
  Llama 3.3 70B ou testar Scout 17B? Recomendado: 70B no MVP.
- `[CONFIRMAR]` **Pricing Groq** vigente no momento da implementação
  (mudou ao longo de 2025/2026).
- `[CONFIRMAR]` **Hora silenciosa: usuário pode customizar?** MVP:
  global 22h–7h BRT. v2: por aluno.
- `[CONFIRMAR]` **Database Webhooks** vs **trigger SQL → pg_net**
  pros eventos (`coach_plan_update`, `goal_achieved`). Webhook é mais
  simples mas ainda em beta na Supabase. Default: webhook.
- `[CONFIRMAR]` **Throttling Groq** — começar com 100ms entre chamadas
  no batch ou só observar e ajustar?
- `[CONFIRMAR]` **Marco de streak** — usar 3/7/14/30/60/100 ou outro
  conjunto (5/10/30/100)?
- `[CONFIRMAR]` **`coach_adherence_alert` agrupado vs separado** —
  quando coach tem 5 alunos em alerta, é 1 push agrupado ou 5 pushes?
  Recomendado: agrupado se >2 no mesmo dia.
- `[CONFIRMAR]` **Persona customizável por coach na v2** —
  manter no roadmap?
- `[CONFIRMAR]` **Conteúdo do push em `push_history`** — guardamos
  texto integral por tempo indeterminado ou só 30 dias? LGPD
  recomenda janela curta. Sugestão: 90 dias com job de cleanup.
- `[CONFIRMAR]` **Tela de preferências granulares** entra junto no
  MVP ou opt-out só via "desativar tudo" no profile? Recomendado:
  granular já no MVP (é diferencial vs MFIT).
