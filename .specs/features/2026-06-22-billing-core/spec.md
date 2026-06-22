# Spec — billing-core

> Spec #1 da iniciativa de assinatura (ver `.specs/features/billing/`). Fundação
> server-side do entitlement: tabela `subscriptions`, RPC `resolve_entitlement` e
> gating autoritativo nas edge functions de IA. **Não** depende da Play Console.
>
> Status: **especificação** · Branch: `feature/implementacao-assinatura-paginas-auxiliares`
> · Escopo: **Complex** · Idioma: PT-BR.

## Objetivo

Criar a **fonte de verdade do "o que esse usuário pode fazer agora"** no Supabase e
ligar o gating de IA no servidor, de forma que a UI (spec #2) e a integração com a
loja (spec #5) só precisem ler/escrever — sem reimplementar regra de acesso.

`billing-core` é **tier-based e price-agnostic**: guarda `tier` (free/pro/premium),
não preço. Preços, cupons e produtos vivem na loja/RevenueCat (specs #2/#5) e não
afetam esta spec.

## Decisões aprovadas (2026-06-22)

| # | Decisão | Efeito nesta spec |
|---|---------|-------------------|
| D1 | **Entitlement é a autoridade do limite de alunos** | `coach-create-student` passa a consultar `resolve_entitlement.student_limit` (free=5 · pro=20 · premium=∞). `coaches.max_students` deixa de reger o gating (fica como legado/override; ver D5). |
| D2 | **Grandfather = todos os usuários atuais** | Backfill: todo profile existente no deploy ganha `subscriptions(source='grandfather')` → IA pessoal grátis pra sempre. Só novos usuários (pós-deploy) enfrentam o paywall. |
| D3 | **Grandfather/early-adopter cobre só IA pessoal** | `grandfather`/`is_early_adopter` ⇒ `ai_personal=true`, mas **não** concede `ai_coach` nem expande `student_limit` (esses seguem o tier). |
| D4 | **Trial: só leitura** | `resolve_entitlement` honra `source='server_trial'` + `trial_end` (lê trial ativo), mas o fluxo que **concede** trial é a spec #3. |
| D5 | **Professor existente acima do limite free** | Tratamento **não-destrutivo**: alunos atuais permanecem (sem unlink forçado); só **bloqueia adicionar novos** além do `student_limit`. O fluxo "escolhe quem fica" é a spec #3. IA de coach desses professores passa a exigir tier pago (consequência de D3). |

## Fora de escopo

- UI / paywall / telas "seja Pro" (spec #2 `paywall-ui`).
- **Concessão** de trial, fluxo ex-aluno, downgrade "escolhe quem fica" (spec #3).
- Documentos legais / aceite (spec #4).
- SDK RevenueCat, webhook, compra real, **cupons**, preços (spec #5).
- Forçar unlink de alunos excedentes (spec #3).

## Modelo de dados

```
subscriptions (user_id uuid PK → profiles.id, on delete cascade)
  tier            text  check (tier in ('free','pro','premium'))           default 'free'
  source          text  check (source in ('store_play','store_apple','stripe','server_trial','grandfather'))  null
  status          text  check (status in ('active','in_trial','canceled','expired'))  default 'active'
  trial_end       timestamptz null     -- só p/ source='server_trial'
  period_end      timestamptz null     -- vem da loja (spec #5)
  rc_app_user_id  text null            -- id no RevenueCat (= profiles.id); spec #5
  trial_consumed  boolean not null default false   -- anti-abuso (granting na #3)
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
```

Ausência de linha = `free`/`source=none` (usuário novo pós-deploy sem assinatura).

### Contrato do `resolve_entitlement()` (RPC, SECURITY DEFINER, sem args — usa `auth.uid()`)

Retorna JSON:
```
{
  tier:          'free' | 'pro' | 'premium',
  source:        'store_play'|'store_apple'|'stripe'|'server_trial'|'grandfather'|'none',
  ai_personal:   boolean,        -- chat IA + sanity check
  ai_coach:      boolean,        -- coach-generate-plan + coach-import-workout-ai (só professor)
  student_limit: number | null,  -- null = ilimitado (só professor; null p/ comum/aluno)
  trial_end:     string | null
}
```

Regras de resolução por `profiles.role`:

| role | `ai_personal` | `ai_coach` | `student_limit` |
|------|---------------|------------|-----------------|
| `comum` | tier∈{pro,premium} **OU** trial ativo **OU** grandfather **OU** early_adopter | `false` | `null` |
| `aluno` | **herdado**: = `ai_personal` do coach (`profiles.coach_id`) | `false` | `null` |
| `professor` | tier∈{pro,premium} **OU** trial ativo **OU** grandfather **OU** early_adopter | tier∈{pro,premium} **OU** trial ativo (NÃO grandfather/early — D3) | free→5 · pro→20 · premium→`null` |

"trial ativo" = `source='server_trial' AND status='in_trial' AND trial_end > now()`.

## Requisitos

### Dados & RPC

- **[BILL]-01** — Migration cria `subscriptions` conforme o modelo (idempotente, padrão do projeto).
  - QUANDO a migration roda em base limpa ENTÃO a tabela existe com os checks e defaults definidos.
  - QUANDO a migration roda duas vezes ENTÃO não falha (idempotente).

- **[BILL]-02** — RLS de `subscriptions`: dono **lê** a própria linha; **escrita só via service_role** (edge functions / webhook).
  - QUANDO um usuário autenticado faz `select` ENTÃO vê apenas a própria linha (`auth.uid() = user_id`).
  - QUANDO um usuário tenta `insert`/`update`/`delete` via client ENTÃO é negado por RLS.

- **[BILL]-03** — Backfill grandfather (D2): toda linha de `profiles` existente ganha `subscriptions(tier='free', source='grandfather', status='active')`.
  - QUANDO a migration roda ENTÃO existe 1 linha de subscription por profile existente, com `source='grandfather'`.
  - QUANDO um profile novo é criado após o deploy ENTÃO **não** recebe linha automaticamente (resolve trata ausência como free/none).

- **[BILL]-04** — `resolve_entitlement()` para `comum` (D3): honra tier, trial ativo, grandfather e early_adopter.
  - QUANDO um comum sem assinatura e sem grandfather chama ENTÃO `ai_personal=false`, `tier='free'`, `source='none'`.
  - QUANDO um comum grandfather/early_adopter chama ENTÃO `ai_personal=true` (mesmo com `tier='free'`).
  - QUANDO um comum com `server_trial` ativo chama ENTÃO `ai_personal=true`, `source='server_trial'`, `trial_end` preenchido.
  - QUANDO o trial expirou (`trial_end < now()`) ENTÃO `ai_personal=false`, `tier='free'`.

- **[BILL]-05** — `resolve_entitlement()` para `aluno`: herda `ai_personal` do coach (`profiles.coach_id`).
  - QUANDO o coach tem `ai_personal=true` ENTÃO o aluno tem `ai_personal=true`.
  - QUANDO o coach é free (sem grandfather/pro) ENTÃO o aluno tem `ai_personal=false`.
  - QUANDO o aluno não tem `coach_id` ENTÃO `ai_personal=false` (resolve como comum free).

- **[BILL]-06** — `resolve_entitlement()` para `professor`: `ai_coach` e `student_limit` por tier; grandfather/early **não** concede coach (D3).
  - QUANDO professor `tier='pro'` ENTÃO `ai_coach=true`, `student_limit=20`.
  - QUANDO professor `tier='premium'` ENTÃO `ai_coach=true`, `student_limit=null`.
  - QUANDO professor free **grandfather** ENTÃO `ai_personal=true`, **`ai_coach=false`**, `student_limit=5`.
  - QUANDO professor `server_trial` ativo ENTÃO `ai_coach=true` e `student_limit` do tier do trial.

### Gating server-side (402 needs_upgrade)

> Padrão de resposta: `402 { error: 'needs_upgrade', feature: '<chave>' }`. O check
> roda **após** `getUser()` e **antes** de gastar token de IA / criar recurso.
> Helper compartilhado em `_shared/entitlement.ts`.

- **[BILL]-07** — Helper `_shared/entitlement.ts`: função que chama `resolve_entitlement` com o JWT do usuário e retorna o objeto tipado.
  - QUANDO uma edge function chama o helper com um JWT válido ENTÃO recebe o `Entitlement` tipado.

- **[BILL]-08** — `chat-ai` modo `chat`: exige `ai_personal`.
  - QUANDO usuário sem `ai_personal` chama o chat ENTÃO recebe `402 needs_upgrade` (feature `chat`) e **nenhum** token de Groq é gasto.
  - QUANDO usuário com `ai_personal` chama ENTÃO o fluxo atual segue inalterado.

- **[BILL]-09** — `chat-ai` modo `sanity_check`: exige `ai_personal`.
  - QUANDO usuário sem `ai_personal` faz sanity check ENTÃO `402 needs_upgrade` (feature `sanity_check`) sem chamar o modelo.

- **[BILL]-10** — `coach-generate-plan`: exige `ai_coach`.
  - QUANDO professor sem `ai_coach` chama ENTÃO `402 needs_upgrade` (feature `coach_generate_plan`) sem gastar token.

- **[BILL]-11** — `coach-import-workout-ai`: exige `ai_coach`.
  - QUANDO professor sem `ai_coach` chama ENTÃO `402 needs_upgrade` (feature `coach_import_workout`) sem gastar token.

- **[BILL]-12** — `coach-create-student`: limite passa a usar `resolve_entitlement.student_limit` (D1/D5).
  - QUANDO o nº de alunos atual `>= student_limit` ENTÃO `402 needs_upgrade` (feature `student_limit`), sem criar aluno.
  - QUANDO `student_limit=null` (premium) ENTÃO nunca bloqueia por limite.
  - QUANDO professor grandfather/free já tem mais alunos que o limite ENTÃO os existentes permanecem; apenas a criação de novos é bloqueada (D5, não-destrutivo).

## Restrições de implementação / deploy

- **Ordem de deploy (CONCERN):** o gating server-side só vai pra produção **junto** do
  build do app que trata `402 needs_upgrade` (spec #2 `paywall-ui`). Como grandfather
  cobre todos os usuários atuais, o risco real é para **novos cadastros** pós-deploy
  sem UI de paywall. Registrar em STATE.md; não fazer `fn:deploy` isolado em prod antes da #2.
- Migrations idempotentes em `supabase/migrations/`.
- RLS sempre por `auth.uid() = user_id`; escrita de `subscriptions` só por service_role.
- Reusar o padrão das edge functions (createClient + getUser + helper `json()`).

## Rastreabilidade

| ID | Descrição | Status |
|----|-----------|--------|
| [BILL]-01 | Tabela `subscriptions` | Pending |
| [BILL]-02 | RLS subscriptions | Pending |
| [BILL]-03 | Backfill grandfather | Pending |
| [BILL]-04 | resolve_entitlement — comum | Pending |
| [BILL]-05 | resolve_entitlement — aluno (herança) | Pending |
| [BILL]-06 | resolve_entitlement — professor | Pending |
| [BILL]-07 | Helper `_shared/entitlement.ts` | Pending |
| [BILL]-08 | Gating chat-ai (chat) | Pending |
| [BILL]-09 | Gating chat-ai (sanity_check) | Pending |
| [BILL]-10 | Gating coach-generate-plan | Pending |
| [BILL]-11 | Gating coach-import-workout-ai | Pending |
| [BILL]-12 | coach-create-student usa student_limit | Pending |
