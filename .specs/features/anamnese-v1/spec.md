# Feature: Anamnese Estendida V1

> Status: rascunho de spec — itens marcados `[CONFIRMAR]` aguardam decisão do dev.
> Escopo desta versão: anamnese **fixa** (sem templates customizáveis por coach).

---

## 1. Visão

Hoje o NutriOn coleta apenas o essencial pra montar plano de IA: dados
biométricos (`sex`, `birth_year`, `weight_kg`, `height_cm`), objetivo
(`goal_type`, `goal_target_date`), prática esportiva (`practices_sport`,
`sports`, `weekly_frequency`), e dois textos livres em
`profiles.allergies` e `profiles.physical_limitations` (vide
`supabase/migrations/20260423120000_onboarding_fields.sql`).

Isso cobre o caso "usuário comum querendo plano de IA", mas é **insuficiente
pra contexto profissional coach↔aluno**. Quando um personal/nutricionista
recebe um aluno, ele precisa fazer uma **anamnese clínica** antes de
prescrever — protocolo padrão na área.

### Gap vs MFIT

O MFIT (concorrente direto) oferece **11 protocolos prontos** de anamnese
(treino, nutrição, cardio, gestante, idoso, lesionado, etc.) **+** templates
customizáveis pelo coach. Replicar tudo isso de cara é over-engineering pra
NutriOn que ainda está em MVP e não tem nem 1 coach pagante validado em
escala.

### Decisão V1

V1 entrega **uma anamnese única e fixa**, com os campos clínicos mínimos que
todo coach pede no primeiro atendimento. O input é **estruturado** (não texto
livre solto) pra que a IA do `coach-generate-plan` consiga consumir e o coach
filtre/visualize sem ler parágrafos.

V2 (depois de feedback real de 5+ coaches) decide se vale construir templates
customizáveis. Não fazer isso agora.

### Princípios

- **Fixo, mas extensível**: schema modela campos individuais (não JSON solto),
  pra evoluir adicionando colunas em vez de migrar JSON depois.
- **Aluno é dono**: aluno pode preencher e atualizar a qualquer momento. Coach
  edita também (quando criou a conta ou no acompanhamento).
- **IA usa, mas não inventa contraindicação**: passamos a anamnese pro prompt
  como contexto seguro; se faltar dado, IA segue o fluxo normal.
- **Privacidade**: dados clínicos. RLS estrita: aluno + seu coach. Mais
  ninguém.

---

## 2. User stories

| ID       | Como             | Quero                                                                   | Pra                                                              |
|----------|------------------|-------------------------------------------------------------------------|------------------------------------------------------------------|
| ANAM-01  | Aluno individual | Preencher anamnese clínica durante o onboarding (opcional/skippable)    | Receber plano de IA mais seguro                                  |
| ANAM-02  | Aluno individual | Editar anamnese depois (mudou medicação, nova lesão, fez cirurgia)      | Manter plano alinhado com minha realidade atual                  |
| ANAM-03  | Aluno de coach   | Visualizar a anamnese que o coach preencheu por mim                     | Conferir o que ele anotou e completar lacunas                    |
| ANAM-04  | Coach            | Preencher anamnese ao criar aluno via `coach-create-student`            | Já entrar com ficha clínica completa antes de gerar plano        |
| ANAM-05  | Coach            | Editar/atualizar anamnese do aluno na aba de perfil dele                | Refletir mudanças que o aluno me reportou no atendimento         |
| ANAM-06  | Coach            | Ver anamnese consolidada num bloco da tela do aluno                     | Consultar rapidamente antes/durante avaliação física             |
| ANAM-07  | Coach            | Que a IA do `coach-generate-plan` use a anamnese ao montar plano        | Evitar exercício contraindicado (ex: agachamento c/ lesão joelho)|
| ANAM-08  | Aluno individual | Que a IA do onboarding pessoal também leve a anamnese em conta          | Não receber treino que machuque                                  |
| ANAM-09  | Aluno            | Marcar campos sensíveis como "prefiro não responder"                    | Manter privacidade sem travar o fluxo                            |
| ANAM-10  | Aluno/Coach      | Cadastrar contato de emergência                                         | Ter quem acionar se acontecer algo durante treino                |

`[CONFIRMAR ANAM-09]` Vale a complexidade de UI pra "prefiro não responder" em
V1, ou tudo é simplesmente opcional (nullable) e ponto?

---

## 3. Campos propostos

Cada campo abaixo lista: **descrição**, **tipo proposto**, **obrigatoriedade
em V1**, **justificativa** e **`[CONFIRMAR]`** quando há decisão pendente.

Convenção: todo campo é **nullable** no banco. "Obrigatório" no app significa
que o **fluxo guiado** pede, não que o banco bloqueia.

### 3.1 Lesões / limitações ortopédicas

- **Campo:** `injuries`
- **Tipo:** `text[]` (tags pré-definidas) **+** `injuries_notes text` (observação livre).
- **Tags propostas:** `ombro_d`, `ombro_e`, `cotovelo_d`, `cotovelo_e`,
  `punho_d`, `punho_e`, `lombar`, `cervical`, `quadril_d`, `quadril_e`,
  `joelho_d`, `joelho_e`, `tornozelo_d`, `tornozelo_e`, `outros`.
- **Justificativa:** Hoje já existe `physical_limitations text` puro. O
  problema é que IA e UI não conseguem filtrar/agrupar texto livre. Tags
  estruturadas resolvem (ex: prompt: "Aluno com lesão em joelho_d, evitar
  agachamento profundo, leg press unilateral, etc.").
- **Migração:** manter `physical_limitations` por compat e migrar gradual; em
  V1 popular `injuries_notes` a partir de `physical_limitations` legado.
- `[CONFIRMAR]` Lista de tags acima é boa pra V1 ou simplifica pra
  `ombro/cotovelo/punho/lombar/cervical/quadril/joelho/tornozelo/outros`
  (sem lateralidade)? Lateralidade dobra a lista mas é clínicamente útil.

### 3.2 Cirurgias prévias

- **Campo:** `surgeries jsonb` — array de `{date: 'YYYY-MM' | 'YYYY', type: string, notes?: string}`.
- **Multi-entry**: aluno pode adicionar 0..N.
- **Justificativa:** Cirurgia é evento datado, não tag. Coach precisa saber
  "fez meniscectomia em 2022" pra liberar exercício. JSON aqui é OK porque é
  lista de objetos curtos e raramente filtramos por dentro.
- `[CONFIRMAR]` Aceita data parcial (só ano) ou exige mês/ano? Sugiro
  `YYYY-MM` no app, salvo como string.

### 3.3 Doenças crônicas

- **Campo:** `chronic_conditions text[]` (multi-select) **+**
  `chronic_conditions_notes text`.
- **Opções V1:** `hipertensao`, `diabetes_t1`, `diabetes_t2`,
  `hipotireoidismo`, `hipertireoidismo`, `asma`, `cardiopatia`,
  `dislipidemia`, `artrose`, `artrite`, `fibromialgia`, `epilepsia`,
  `depressao`, `ansiedade`, `outros`.
- **Justificativa:** Lista das doenças crônicas mais comuns que afetam
  prescrição. Hipertensão, diabetes, cardiopatia e tireoide são as que mais
  pedem ajuste. Se "outros", aluno descreve em `chronic_conditions_notes`.
- `[CONFIRMAR]` Incluir `depressao`/`ansiedade` em V1? São relevantes pro
  coach (afeta motivação, adesão), mas dado sensível. Talvez deixar pra V2 e
  V1 só físicas.

### 3.4 Medicamentos em uso

- **Campo:** `medications text` (multi-line, livre, max 1000 chars).
- **Justificativa:** Não vale modelar como tabela em V1. Coach precisa só
  ler. Format: "AAS 100mg/dia, Losartana 50mg 2x/dia". IA não deve usar
  isso pra decisão automática (risco de erro), só passar pro coach.
- `[CONFIRMAR]` IA deve receber `medications` no prompt do `coach-generate-plan`?
  Pró: contexto extra. Contra: aumenta tokens e o LLM pode "alucinar"
  contraindicação. Sugiro **não** passar pra IA em V1 — só coach lê.

### 3.5 Alergias

- **Campos:**
  - `allergy_food text` — alergias/intolerâncias alimentares (substitui o
    atual `allergies` que é genérico).
  - `allergy_medication text` — alergias medicamentosas.
  - `allergy_environmental text` — pó, pólen, picada de inseto, etc.
- **Justificativa:** Hoje `profiles.allergies` é texto único. Separar em 3
  permite IA usar **só `allergy_food`** pra dieta/suplementação sem cruzar
  com pólen.
- **Migração:** copiar `profiles.allergies` legado pra `allergy_food` e
  manter `allergies` como deprecated por 2 versões (não breaking).
- `[CONFIRMAR]` Vale separar agora ou junta tudo em `allergies` mantendo o
  campo atual? Separar parece valer pelo uso da IA.

### 3.6 Restrições alimentares

- **Campo:** `dietary_restrictions text[]` (multi-select) + `dietary_notes text`.
- **Opções V1:** `vegetariano`, `vegano`, `ovolactovegetariano`, `pescetariano`,
  `sem_gluten`, `sem_lactose`, `low_carb`, `kosher`, `halal`,
  `jejum_intermitente`, `outros`.
- **Justificativa:** IA usa direto na geração de plano alimentar (futuro
  módulo de nutrição). Hoje o `coach-generate-plan` ainda não gera plano
  alimentar detalhado, mas já vale modelar.
- `[CONFIRMAR]` Incluir `jejum_intermitente`? É escolha, não restrição.
  Talvez pertença a `bio` e não aqui. Idem `low_carb`.

### 3.7 Contato de emergência

- **Campos:**
  - `emergency_contact_name text`
  - `emergency_contact_phone text` (validar formato E.164 no app, salvar livre)
  - `emergency_contact_relation text` (livre: "esposa", "pai", "amigo")
- **Justificativa:** Padrão de academia/box. Útil principalmente pra coaches
  que treinam presencial. Aluno só vê pra preencher; coach lê.
- `[CONFIRMAR]` Em V1 já vale isso ou é V2? Pra app puramente remoto/digital
  parece menos crítico. Sugiro manter — custo de implementação é baixo.

### 3.8 Histórico de prática esportiva

- **Campo:** `sport_history text` (multi-line, max 1000 chars).
- **Justificativa:** Diferente de `practices_sport` (boolean atual) e `sports`
  (array atual, qual esporte). Aqui é "fui jogador de futebol 10 anos, parei
  em 2018, voltei a treinar academia em 2023". Contexto qualitativo que muda
  prescrição (aluno destreinado vs ex-atleta).
- `[CONFIRMAR]` `sport_history` deve entrar no prompt da IA? Sim, é alto
  sinal e poucos tokens.

### 3.9 Objetivo específico complementar

- **Campo:** `goal_notes text` (multi-line, max 500 chars).
- **Justificativa:** `goal_type` é categórico (4 opções). Aluno costuma
  querer detalhar: "quero perder 8kg até casamento em outubro, foco em
  abdome e braços". IA usa direto.
- **Relação com `bio`:** `bio` (já existe) é "conta sobre você" genérico —
  rotina, motivação, sono. `goal_notes` é especificamente sobre objetivo.
  `[CONFIRMAR]` se vale a separação ou é redundante com `bio`. Sugiro
  manter separado pq tem semântica diferente e UX mais focada.

### 3.10 Avisos médicos / liberação

- **Campos:**
  - `has_medical_clearance boolean` — "tem laudo médico autorizando atividade física?"
  - `medical_clearance_notes text` — detalhes (data do laudo, restrições do médico).
- **Justificativa:** Coach **idealmente** não prescreve pra aluno com
  cardiopatia/hipertensão sem liberação médica. Boolean explícito documenta
  responsabilidade.
- `[CONFIRMAR]` Em V1 implementamos só os 2 campos, ou adicionamos upload de
  PDF do laudo? Sugiro **só campos texto/boolean** em V1 (storage de
  documento clínico envolve LGPD/criptografia que não vamos resolver agora).

### 3.11 Resumo dos campos (tabela)

| Campo                          | Tipo                       | UI                | Vai pro prompt da IA? |
|--------------------------------|----------------------------|-------------------|------------------------|
| `injuries`                     | `text[]`                   | Multi-select tags | Sim                    |
| `injuries_notes`               | `text`                     | Textarea          | Sim                    |
| `surgeries`                    | `jsonb` (array de objetos) | Lista dinâmica    | Sim (resumido)         |
| `chronic_conditions`           | `text[]`                   | Multi-select      | Sim                    |
| `chronic_conditions_notes`     | `text`                     | Textarea          | Sim                    |
| `medications`                  | `text`                     | Textarea          | Não (V1)               |
| `allergy_food`                 | `text`                     | Textarea          | Sim                    |
| `allergy_medication`           | `text`                     | Textarea          | Não                    |
| `allergy_environmental`        | `text`                     | Textarea          | Não                    |
| `dietary_restrictions`         | `text[]`                   | Multi-select      | Sim                    |
| `dietary_notes`                | `text`                     | Textarea          | Sim                    |
| `emergency_contact_name`       | `text`                     | Input             | Não                    |
| `emergency_contact_phone`      | `text`                     | Input (telefone)  | Não                    |
| `emergency_contact_relation`   | `text`                     | Input             | Não                    |
| `sport_history`                | `text`                     | Textarea          | Sim                    |
| `goal_notes`                   | `text`                     | Textarea          | Sim                    |
| `has_medical_clearance`        | `boolean`                  | Switch            | Sim                    |
| `medical_clearance_notes`      | `text`                     | Textarea          | Sim                    |
| `anamnese_filled_at`           | `timestamptz`              | (auto)            | —                      |
| `anamnese_updated_at`          | `timestamptz`              | (auto, trigger)   | —                      |

---

## 4. Schema — Opção A vs Opção B

### Opção A — colunas em `profiles`

**Prós:**
- Reusa joins existentes; `coach-generate-plan` faz `select * from profiles`
  e já recebe tudo.
- RLS já está configurada e validada em `profiles`.
- Migração mais simples (1 ALTER TABLE com 19 colunas).

**Contras:**
- `profiles` já tem ~25 colunas e ficaria com **44+** após anamnese. Tabela
  obesa, queries `select *` mais caras, snapshot pesado no `useProfile`
  hook (carrega tudo na sessão do app, mesmo quando não precisa).
- `surgeries jsonb` num registro cacheado a cada login parece desperdício.
- Atualizar anamnese dispara write em `profiles` inteiro, invalidando cache.

### Opção B — tabela nova `student_anamneses`

```sql
create table public.student_anamneses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- 1:1 com profile (PK = user_id)
  injuries text[] default '{}',
  injuries_notes text,
  surgeries jsonb default '[]'::jsonb,
  chronic_conditions text[] default '{}',
  chronic_conditions_notes text,
  medications text,
  allergy_food text,
  allergy_medication text,
  allergy_environmental text,
  dietary_restrictions text[] default '{}',
  dietary_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  sport_history text,
  goal_notes text,
  has_medical_clearance boolean,
  medical_clearance_notes text,
  filled_at timestamptz,
  updated_at timestamptz not null default now()
);
```

**Prós:**
- Separa concern. Profile fica enxuto.
- Lazy load: app só busca anamnese quando aluno entra em "Editar Anamnese"
  ou quando coach abre tela do aluno.
- Permite versionar/auditar depois (V2 pode adicionar `student_anamnese_revisions`).
- Dado clínico isolado facilita LGPD: política de retenção/exportação
  específica.

**Contras:**
- Mais 1 query no `coach-generate-plan` (join ou select extra).
- Mais policy RLS pra escrever/manter.
- 1 migration nova + ajustes nas Edge Functions.

### Recomendação: **Opção B**

Os ganhos (profile leve, lazy load, separação de concern clínico) superam o
custo da query extra. O hook `useAnamnese(userId)` é trivial e o
`coach-generate-plan` já carrega N coisas — adicionar 1 select em paralelo é
ruído baixo. Além disso, **dados clínicos pedem isolamento** por LGPD e a
estrutura facilita V2 (versionamento, exportação, anonimização).

`[CONFIRMAR]` Aceita Opção B? Se preferir A, ajusto a spec.

### Migration esboço (Opção B)

Arquivo: `supabase/migrations/20260520000000_student_anamneses.sql`.

```sql
create table public.student_anamneses (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  injuries text[] not null default '{}',
  injuries_notes text,
  surgeries jsonb not null default '[]'::jsonb,
  chronic_conditions text[] not null default '{}',
  chronic_conditions_notes text,
  medications text,
  allergy_food text,
  allergy_medication text,
  allergy_environmental text,
  dietary_restrictions text[] not null default '{}',
  dietary_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  sport_history text,
  goal_notes text,
  has_medical_clearance boolean,
  medical_clearance_notes text,
  filled_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Triggers / índices
create trigger student_anamneses_set_updated_at
  before update on public.student_anamneses
  for each row execute function public.set_updated_at();

-- Backfill: cria linha vazia pra todo aluno existente (idempotente)
insert into public.student_anamneses (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- Trigger pra criar linha automática quando novo profile é criado
-- (espelha handle_new_user — `[CONFIRMAR]` se cria no trigger ou on-demand
-- na primeira escrita)

-- Constraints de tamanho
alter table public.student_anamneses
  add constraint anamnese_injuries_notes_len check (char_length(injuries_notes) <= 1000),
  add constraint anamnese_chronic_notes_len check (char_length(chronic_conditions_notes) <= 1000),
  add constraint anamnese_medications_len check (char_length(medications) <= 1000),
  add constraint anamnese_allergy_food_len check (char_length(allergy_food) <= 500),
  add constraint anamnese_allergy_med_len check (char_length(allergy_medication) <= 500),
  add constraint anamnese_allergy_env_len check (char_length(allergy_environmental) <= 500),
  add constraint anamnese_dietary_notes_len check (char_length(dietary_notes) <= 500),
  add constraint anamnese_sport_history_len check (char_length(sport_history) <= 1000),
  add constraint anamnese_goal_notes_len check (char_length(goal_notes) <= 500),
  add constraint anamnese_med_clear_notes_len check (char_length(medical_clearance_notes) <= 500),
  add constraint anamnese_emerg_name_len check (char_length(emergency_contact_name) <= 80),
  add constraint anamnese_emerg_phone_len check (char_length(emergency_contact_phone) <= 30),
  add constraint anamnese_emerg_rel_len check (char_length(emergency_contact_relation) <= 30);
```

---

## 5. UX

### 5.1 Aluno — onde aparece

**Decisão:** Anamnese **não entra como step obrigatório no onboarding atual**.
O onboarding hoje tem 6 steps focados em IA gerar plano (dados → objetivo →
esporte → hábitos → bio → resultado). Adicionar 6 accordions de anamnese
estouraria UX e taxa de skip iria pro alto.

Em vez disso:

1. **Onboarding atual:** mantém-se igual. Após `loading.tsx`/`resultado.tsx`,
   aparece um **CTA opcional** "Completar anamnese clínica (recomendado)" com
   estimativa de tempo (~3 min).
2. **Tela dedicada:** `app/(tabs)/perfil/anamnese.tsx` (nova) com formulário
   organizado em **accordions**:
   - Lesões e cirurgias
   - Saúde geral (doenças crônicas, medicamentos, liberação médica)
   - Alergias e alimentação
   - Histórico esportivo e objetivo
   - Contato de emergência
3. **Editar Perfil:** botão "Anamnese clínica" leva pra mesma tela.
4. **Indicador de pendência:** badge "completar anamnese" no card do perfil
   enquanto `filled_at is null`. Some quando preencheu.

`[CONFIRMAR UX-1]` Concorda com não enfiar no onboarding? Alternativa: step 7
opcional/skippable explícito no onboarding.

### 5.2 Coach — onde aparece

1. **Criar aluno** (`(coach)/aluno/novo` ou similar): seção opcional/colapsada
   "Anamnese clínica" no form, salva junto via `coach-create-student` (ver §6).
2. **Editar aluno** (`app/(coach)/aluno/[id]/editar.tsx` — já existe): adicionar
   nova aba ou seção "Anamnese", reusando o componente do form do aluno.
3. **Tela do aluno** (`app/(coach)/aluno/[id]/index.tsx`): bloco read-only
   "Anamnese clínica" com resumo (lesões em badges, doenças em badges, contato
   emergência). Botão "Editar" abre o form completo.

### 5.3 Layout do form (accordions)

```
┌─────────────────────────────────────────┐
│ Anamnese clínica                        │
│ Última atualização: 5 mai 2026          │
├─────────────────────────────────────────┤
│ ▼ Lesões e cirurgias                    │
│   [Tags: ombro_d, joelho_e]             │
│   Observações: textarea                 │
│   Cirurgias: + Adicionar                │
├─────────────────────────────────────────┤
│ ▶ Saúde geral                           │
├─────────────────────────────────────────┤
│ ▶ Alergias e alimentação                │
├─────────────────────────────────────────┤
│ ▶ Histórico esportivo e objetivo        │
├─────────────────────────────────────────┤
│ ▶ Contato de emergência                 │
└─────────────────────────────────────────┘
[ Salvar ]
```

- Cada accordion mostra contador "X de Y campos preenchidos" no header.
- Salvar é **incremental por seção** (auto-save no blur) ou botão único no fim?
  `[CONFIRMAR UX-2]` Sugiro **botão único** no fim — mais simples, menos
  edge cases de "salvou só metade".

### 5.4 Acessibilidade / mobile

- Multi-select de tags: usar componente `Chip` (provável já existe no
  design system). `[CONFIRMAR]` componente exato.
- Lista dinâmica de cirurgias: row com data (`MonthYearPicker`) + tipo +
  botão remover.
- Toda label suporta "prefiro não responder" via blank? Ou checkbox? Ver
  ANAM-09.

---

## 6. Integração com IA

### 6.1 `coach-generate-plan`

Hoje o `PlanInput` tem 13 campos do `profiles`. Adicionar:

```ts
type PlanInput = {
  // ... existentes
  injuries: string[] | null;
  injuries_notes: string | null;
  surgeries_summary: string | null;       // join formatado
  chronic_conditions: string[] | null;
  chronic_conditions_notes: string | null;
  allergy_food: string | null;
  dietary_restrictions: string[] | null;
  dietary_notes: string | null;
  sport_history: string | null;
  goal_notes: string | null;
  has_medical_clearance: boolean | null;
  medical_clearance_notes: string | null;
};
```

### 6.2 Estratégia anti-bloat de tokens

Resumir antes de mandar pro prompt:

- `surgeries jsonb` → string formatada: `"meniscectomia 2022, hérnia de disco 2019"`. Não manda JSON cru.
- Tags vão como lista PT-BR humanizada: `injuries: ["joelho_e", "ombro_d"]` →
  prompt: `"Lesões: joelho esquerdo, ombro direito"`.
- Campos vazios são **omitidos** do prompt (não mandar `"Lesões: nenhuma"`).
- Hard limit: se anamnese resumida > 500 tokens, truncar `*_notes` em 200 chars cada.
- **Bloco no prompt:**
  ```
  ## Anamnese clínica
  - Lesões: joelho esquerdo, ombro direito (dor ao agachar fundo)
  - Cirurgias prévias: meniscectomia 2022
  - Doenças: hipertensão controlada
  - Restrições alimentares: sem lactose
  - Liberação médica: sim
  - Histórico esportivo: ex-jogador de futebol amador, parou 2018
  - Objetivo detalhado: perder 8kg até dezembro
  ```

### 6.3 Regras de prompt

Adicionar ao system prompt do `_shared/plan-generator.ts`:

> "Se a anamnese indicar **lesão** em região X, evite exercícios que
> sobrecarreguem X (ex: lesão joelho → evite agachamento profundo, leg
> press unilateral pesado, salto). Se houver **doença crônica
> cardiovascular sem liberação médica**, mantenha intensidade moderada
> (RPE máx 7) e priorize aeróbio leve. Se houver **restrição alimentar**,
> reflita nas metas (ex: sem lactose → não sugerir whey de leite)."

`[CONFIRMAR]` Texto exato do prompt — vale revisar com um coach real antes
de colar em produção.

### 6.4 Onboarding pessoal (não-coach)

O fluxo de onboarding pessoal hoje gera plano via outra Edge Function (`generate-plan`/similar). Mesma integração: `PlanInput` recebe campos da anamnese se
`student_anamneses` existir pro user. `[CONFIRMAR]` qual é o nome exato da
Edge Function de onboarding pessoal — não estava nos arquivos lidos nesta
spec.

### 6.5 `coach-create-student`

Adicionar ao `Body` os mesmos campos da anamnese; após criar profile,
inserir/upsert em `student_anamneses` numa transação lógica (não-atômica
real — Edge Function não tem transação cross-table, então fazer rollback
manual em caso de falha, igual ao pattern atual de deletar `auth.users`
no erro).

---

## 7. RLS

Mesmo padrão do `progress_entries` (vide `20260518000000_progress_entries.sql`):

```sql
alter table public.student_anamneses enable row level security;

-- SELECT: dono ou coach do dono
create policy "anamnese_select_own_or_coach" on public.student_anamneses
  for select using (
    (select auth.uid()) = user_id
    or user_id in (
      select id from public.profiles
       where coach_id = (select auth.uid())
    )
  );

-- INSERT: dono insere o próprio
create policy "anamnese_insert_own" on public.student_anamneses
  for insert with check ((select auth.uid()) = user_id);

-- INSERT: coach insere pelo aluno (necessário pro coach-create-student
-- via service_role — o service_role bypassa RLS, mas se algum dia o coach
-- escrever via cliente normal, esta policy cobre)
create policy "anamnese_insert_coach" on public.student_anamneses
  for insert with check (
    user_id in (
      select id from public.profiles
       where coach_id = (select auth.uid())
    )
  );

-- UPDATE: dono OU coach do dono
create policy "anamnese_update_own_or_coach" on public.student_anamneses
  for update using (
    (select auth.uid()) = user_id
    or user_id in (
      select id from public.profiles
       where coach_id = (select auth.uid())
    )
  );

-- DELETE: só dono (coach não apaga histórico clínico)
create policy "anamnese_delete_own" on public.student_anamneses
  for delete using ((select auth.uid()) = user_id);
```

`[CONFIRMAR RLS-1]` Coach pode UPDATE? Sim, segundo ANAM-05 — confirma.

`[CONFIRMAR RLS-2]` Coach pode INSERT direto via cliente (sem passar pela
Edge Function)? Hoje `coach-create-student` usa service_role e contorna RLS.
A policy `anamnese_insert_coach` é defesa em profundidade pra V2 — pode
remover de V1 se preferir mínimo.

---

## 8. Estimativa

| Bloco                                                                            | Estimativa     |
|----------------------------------------------------------------------------------|----------------|
| Migration `student_anamneses` + RLS + backfill                                   | 0.5 dia        |
| Tipos TypeScript + `useAnamnese` hook (read/write)                               | 0.5 dia        |
| UI form do aluno (5 accordions, multi-select, lista dinâmica de cirurgias)        | 2 dias         |
| Integração tela perfil aluno (CTA + badge pendência)                              | 0.5 dia        |
| UI coach: novo aluno (form integrado) + editar (aba) + bloco read-only no perfil  | 1.5 dia        |
| Atualizar `coach-create-student` Edge Function (body + insert)                    | 0.5 dia        |
| Atualizar `coach-generate-plan` (load anamnese + prompt builder)                  | 1 dia          |
| Atualizar Edge Function de onboarding pessoal (mesmo prompt builder)              | 0.5 dia        |
| Testes manuais + revisão com 1 coach beta                                         | 1 dia          |
| **Total**                                                                         | **~8 dias úteis** |

Equivale a **1 sprint** (1.5–2 semanas com ajustes).

---

## 9. Pontos a confirmar `[CONFIRMAR]` (consolidado)

1. `[ANAM-09]` UX de "prefiro não responder": implementar ou só nullable?
2. `[Tags lesões]` Manter lateralidade (D/E) ou simplificar?
3. `[Cirurgias]` Aceitar data parcial só com ano?
4. `[Doenças crônicas]` Incluir saúde mental (depressão, ansiedade) em V1?
5. `[Medicamentos]` Passar `medications` no prompt da IA ou só coach lê?
6. `[Alergias]` Separar em 3 campos (food/medication/environmental) ou manter campo único?
7. `[Restrições alimentares]` Incluir `low_carb` e `jejum_intermitente` (escolha vs restrição)?
8. `[Contato emergência]` Manter em V1 ou empurrar pra V2?
9. `[goal_notes vs bio]` Separar ou consolidar em `bio`?
10. `[Liberação médica]` Suportar upload de PDF do laudo em V1?
11. `[Schema]` Aceita Opção B (tabela nova `student_anamneses`)?
12. `[UX-1]` Anamnese fica fora do onboarding (CTA pós-resultado) ou step opcional 7?
13. `[UX-2]` Salvar incremental por seção ou botão único no final?
14. `[Componente Chip]` Já existe no design system? Qual o caminho?
15. `[Prompt IA]` Texto sugerido em §6.3 — revisar com coach real?
16. `[Edge Function onboarding pessoal]` Nome exato?
17. `[RLS-1]` Coach pode UPDATE confirmado?
18. `[RLS-2]` Manter `anamnese_insert_coach` ou remover (pq Edge Function usa service_role)?
19. `[Trigger create row]` Criar linha automática em `student_anamneses` quando profile nasce, ou on-demand na primeira escrita?
20. `[Migração legado]` Copiar `profiles.physical_limitations` → `injuries_notes` e `profiles.allergies` → `allergy_food` automaticamente, e deprecar os antigos?

---

## 10. Fora de escopo (V2 ou depois)

- Templates customizáveis de anamnese por coach (vários protocolos, MFIT-style).
- Upload de exames/laudos médicos (PDFs, imagens).
- Versionamento (`student_anamnese_revisions` com diff temporal).
- Importar/exportar anamnese (PDF pro aluno, CSV pro coach).
- Lembrete automático "atualize sua anamnese a cada 6 meses".
- Integração com wearables (frequência cardíaca de repouso, etc.).
- Anamnese de gestante / idoso / atleta de alto rendimento (protocolos
  especializados).
