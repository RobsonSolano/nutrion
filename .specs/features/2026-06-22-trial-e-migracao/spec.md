# Spec — trial-e-migração

> Spec #3 da iniciativa de assinatura. **Concede** o trial de servidor (7 dias) que o
> `billing-core` (#1) já sabe ler, e liga o fluxo de ex-aluno. **Não** depende da loja.
>
> Status: **especificação** · Branch: a criar (`feature/billing-trial-e-migracao`)
> · Escopo: **Large** · Idioma: PT-BR. Decisões em `context.md` (T1–T7).

## Objetivo

Dar vida ao `server_trial`: **conceder** 7 dias de acesso pro (IA pessoal) a **comum novo**
(ao concluir onboarding) e a **ex-aluno** (ao ser desvinculado), com **anti-abuso** (1 trial
por vida) e **sem sobrescrever grandfather**. Expor ao usuário que está em trial e quanto falta.

## Contrato consumido (do #1, imutável aqui)

`subscriptions(source='server_trial', status='in_trial', tier='pro', trial_end=now+7d, trial_consumed=true)`
⇒ `resolve_entitlement` retorna `ai_personal=true` enquanto `trial_end > now()`. Expirado → `free`.

## Fora de escopo

- "Escolhe quem fica" / downgrade de professor (→ #5; gatilho de cancelamento mora lá).
- Trial de professor via loja, webhook, compra, `period_end` (→ #5).
- Cron de expiração / flip de `status` para `expired` (T5 — resolve trata ao vivo).
- UI "não quero continuar o trial" (T6).

## Requisitos

### Concessão (servidor)

- **[TRIAL]-01** — Função `grant_server_trial(p_uid uuid)` (SECURITY DEFINER): concede o trial
  se **elegível**, idempotente, grandfather-safe.
  - QUANDO o usuário não tem linha em `subscriptions` ENTÃO cria `server_trial` (tier=pro,
    status=in_trial, trial_end=now()+7d, trial_consumed=true) e retorna "granted".
  - QUANDO `trial_consumed=true` ENTÃO **não** concede (no-op) — anti-abuso (T3).
  - QUANDO `source='grandfather'` ENTÃO **não** concede nem altera a linha (grandfather = IA pra
    sempre, melhor que 7 dias) (T3).
  - QUANDO `source ∈ {store_play,store_apple,stripe}` ENTÃO **não** concede (já tem/teve loja).
  - QUANDO o `role` atual **não** é `comum` ENTÃO **não** concede (trial pessoal é de comum;
    professor é loja/#5; aluno herda).

- **[TRIAL]-02** — Trigger em `profiles` concede o trial quando um **comum conclui (ou pula) o
  onboarding** — keyed na transição, **não** no insert (T1b).
  - QUANDO um profile com `role='comum'` tem `onboarding_completed_at` (ou `onboarding_skipped_at`)
    indo de null→não-null ENTÃO chama `grant_server_trial(NEW.id)`.
  - QUANDO o update que conclui o onboarding já tem `role='aluno'` (aluno criado por
    `coach-create-student`) ENTÃO o trigger **não** dispara (exclui alunos; preserva o trial
    futuro de ex-aluno).
  - QUANDO o comum conclui onboarding uma 2ª vez (re-edição) ENTÃO `grant_server_trial` é no-op
    (anti-abuso via `trial_consumed`).

- **[TRIAL]-03** — `coach-unlink-student` concede o trial ao ex-aluno após virar comum.
  - QUANDO um aluno é desvinculado e está elegível (sem trial consumido, sem grandfather) ENTÃO
    recebe `server_trial` 7d (via `grant_server_trial`).
  - QUANDO o ex-aluno é grandfather ou já consumiu trial ENTÃO vira comum **sem** novo trial
    (mantém o acesso que já tinha; sem erro).
  - QUANDO a concessão falha ENTÃO o desvínculo **não** é reardado (grant é best-effort, como o push).
  - O push `coach_unlinked` existente passa a **mencionar** o ganho do trial (quando concedido).

### Anti-abuso & arestas

- **[TRIAL]-04** — `trial_consumed` nunca é resetado por esta spec; expirar/reativar não repete trial.
  - QUANDO o trial expira (`trial_end<now`) ENTÃO `resolve_entitlement` retorna `free` (sem cron, T5)
    e `trial_consumed` permanece `true`.

### Cliente (mínimo)

- **[TRIAL]-05** — `trialDaysLeft(trialEnd, now)` (puro, testável) + `useTrialStatus()` derivando
  `{ inTrial, daysLeft }` do entitlement.
  - QUANDO `source='server_trial'` e `trial_end>now` ENTÃO `inTrial=true` e `daysLeft` = dias
    inteiros restantes (arredondado pra cima, mínimo 1 no último dia; 0 quando expirado).
  - QUANDO não está em trial ENTÃO `inTrial=false`.

- **[TRIAL]-06** — Indicador discreto de trial pro usuário (banner/badge) usando `useTrialStatus`.
  - QUANDO o usuário está em trial ENTÃO vê um aviso discreto com os dias restantes (ex: no topo
    do dashboard) e um caminho pro paywall ("assine pra continuar").
  - QUANDO não está em trial ENTÃO nada é mostrado.

## Restrições de implementação

- Migration idempotente em `supabase/migrations/` (padrão do projeto; `create or replace`,
  `drop trigger if exists`). Não alterar `resolve_entitlement` (#1, fechado).
- `grant_server_trial`: escrita só por definer/service; **revoke** do public; `grant execute` a
  `service_role`/`authenticated` conforme necessário (o trigger roda como definer).
- `coach-unlink-student`: chamar o RPC com o client service_role; grant best-effort (log em falha).
- Teste SQL transacional + ROLLBACK em `supabase/tests/grant_server_trial.test.sql`.
- Lógica pura de data (`trialDaysLeft`) com teste vitest. UI: verificação manual + typecheck.
- Sem deps novas. PT-BR com acentuação.

## Rastreabilidade

| ID | Descrição | Status |
|----|-----------|--------|
| [TRIAL]-01 | `grant_server_trial` (elegibilidade + anti-abuso) | Verified (teste SQL ALL PASS no schema real local) |
| [TRIAL]-02 | Trigger de onboarding (comum) | Implemented (migration aplica + trigger criado; runtime no UAT) |
| [TRIAL]-03 | Trial no `coach-unlink-student` (ex-aluno) | Implemented (chama o RPC; runtime no deploy) |
| [TRIAL]-04 | `trial_consumed` não-repetível / expiração ao vivo | Verified (teste SQL: 2ª chamada=skipped_consumed; resolve trata trial_end<now no #1) |
| [TRIAL]-05 | `trialDaysLeft` + `useTrialStatus` | Verified (4 testes vitest) / Implemented (hook) |
| [TRIAL]-06 | Indicador de trial na UI (`TrialBanner`) | Implemented (typecheck; UAT manual) |

> **Validado (evidência fresca, 2026-06-22):** `grant_server_trial.test.sql` → **GRANT_SERVER_TRIAL: ALL PASS**
> (6 casos: granted, anti-abuso, grandfather-safe, loja, aluno, professor) contra o schema real local
> (`npx supabase@latest`); migration aplica limpa/idempotente; `npm test` 23/23; typecheck verde; lint sem warning novo.
> **Pendente (UAT/deploy):** runtime do trigger (comum conclui onboarding → concede; aluno do coach → não dispara)
> e do `coach-unlink-student` (desvincular aluno novo vs grandfather).

## Nota de deploy

Junto da iniciativa (mesmo CONCERN do #1): vai pra prod via `db:push` (migration + trigger) +
`fn:deploy` (`coach-unlink-student`) + build. Aditivo, sem wipe. O trial só passa a ser concedido
após o deploy desta migration — usuários grandfather (pré-billing) seguem com IA pra sempre.
