# Spec — paywall-ui

> Spec #2 da iniciativa de assinatura. Consome o contrato server-side do `billing-core`
> (#1) no cliente: lê o entitlement, trata o `402 needs_upgrade` e apresenta o upsell.
>
> Status: **especificação** · Branch: `feature/implementacao-assinatura-paginas-auxiliares`
> · Escopo: **Large** · Idioma: PT-BR. Decisões do discovery em `context.md`.

## Objetivo

Fazer o app reagir ao entitlement do `billing-core`: (1) ler `resolve_entitlement` e
**sinalizar proativamente** o que é pago (badge "Pro" + cadeado nos CTAs), (2) traduzir
o `402 needs_upgrade` do servidor num **paywall** em vez de erro técnico cru, e (3)
apresentar uma tela de upsell contextual por `feature`. **Não** implementa compra real
(é a #5) — o CTA fica como placeholder "em breve".

Esta spec **destrava o deploy** do `billing-core`: gating server-side + UI vão pra prod
juntos (CONCERN em `.specs/project/STATE.md`).

## Contrato consumido (do #1, imutável aqui)

`resolve_entitlement()` → `{ tier, source, ai_personal, ai_coach, student_limit, trial_end }`.
`402 { error: 'needs_upgrade', feature }` com `feature ∈ { chat, sanity_check,
coach_generate_plan, coach_import_workout, student_limit }`.

## Fora de escopo

- Compra real, RevenueCat, offerings/preços reais, cupons (spec #5).
- Concessão de trial, fluxo ex-aluno, downgrade (spec #3).
- Aceite legal no cadastro (spec #4).
- Qualquer mudança no servidor / `resolve_entitlement` (#1, fechado).

## Requisitos

### Leitura de entitlement no cliente

- **[PAY]-01** — Hook `useEntitlement()` (React Query) chama a RPC `resolve_entitlement`
  e expõe o `Entitlement` tipado + `isLoading`.
  - QUANDO um usuário autenticado monta um consumidor do hook ENTÃO recebe o objeto
    `{ tier, source, ai_personal, ai_coach, student_limit, trial_end }`.
  - QUANDO o usuário faz logout/login ENTÃO o cache do entitlement é invalidado (não
    vaza entitlement de outra sessão).
  - QUANDO a RPC falha (rede) ENTÃO o hook expõe estado de erro/loading sem derrubar a tela.

- **[PAY]-02** — Tipo `Entitlement` no cliente (em `src/types`) espelha o contrato do #1,
  fonte única no app.
  - QUANDO o contrato do servidor muda ENTÃO só este tipo precisa ser ajustado (sem
    duplicação espalhada).

### Detecção do 402 na camada de serviço

- **[PAY]-03** — `NeedsUpgradeError` (carrega `feature: string`) e detecção do `402
  needs_upgrade` nos 3 padrões de chamada de edge function.
  - QUANDO uma chamada via `fetch` (`chat.ts`, `students.ts callFn`) recebe `402` com
    `body.error === 'needs_upgrade'` ENTÃO lança `NeedsUpgradeError(body.feature)`.
  - QUANDO uma chamada via `supabase.functions.invoke` (`workoutImport.ts`,
    `templates.ts`) recebe `402 needs_upgrade` ENTÃO o body é lido (via
    `FunctionsHttpError.context`) e lança `NeedsUpgradeError(feature)` — **não** vaza
    como erro genérico do invoke.
  - QUANDO o `402` não tem o shape esperado ENTÃO cai no tratamento de erro normal
    (não mascara outros 402).

### Paywall (tela de upsell)

- **[PAY]-04** — Rota `app/paywall.tsx` (modal full-screen do expo-router) recebe o
  param `feature` e renderiza copy/benefícios **contextuais** + plano(s) + CTA placeholder.
  - QUANDO aberto com `feature='chat'` ou `'sanity_check'` ENTÃO mostra o valor do plano
    pessoal (IA pessoal: chat + sanity check).
  - QUANDO aberto com `feature='coach_generate_plan'` ou `'coach_import_workout'` ENTÃO
    mostra o valor do plano de professor (IA de coach).
  - QUANDO aberto com `feature='student_limit'` ENTÃO mostra o upsell de **mais alunos**
    (limite por tier) — não "IA".
  - QUANDO o CTA "Assinar" é tocado ENTÃO mostra estado "em breve" (sem fluxo de compra;
    placeholder pra #5). O paywall é fechável (volta pra tela anterior).

- **[PAY]-05** — Helper único `handleNeedsUpgrade(err)` (ou `openPaywall(feature)`) que
  navega ao paywall a partir de qualquer superfície.
  - QUANDO um `NeedsUpgradeError` é capturado em qualquer call site ENTÃO `handleNeedsUpgrade`
    abre o paywall com o `feature` correto e **retorna true** (sinaliza "tratado", evita o
    alerta de erro técnico).
  - QUANDO o erro **não** é `NeedsUpgradeError` ENTÃO retorna false (segue o tratamento atual).

### Gating proativo na UI (híbrido — C2)

> Em todos: durante o load do entitlement, **não** bloquear falsamente (C6) — CTA normal;
> o `402` é a rede de segurança.

- **[PAY]-06** — Chat IA (`app/(tabs)/chat.tsx` + `useChat`): sem `ai_personal`, o input
  fica bloqueado com badge "Pro"; tocar abre o paywall (`feature=chat`). O `402` continua
  tratado (reativo) via `NeedsUpgradeError`.
  - QUANDO `ai_personal=false` ENTÃO o campo de envio do chat mostra estado bloqueado +
    CTA pra assinar (abre paywall `feature=chat`) e **não** dispara a chamada.
  - QUANDO `ai_personal=true` ENTÃO o chat funciona inalterado.
  - QUANDO mesmo assim o servidor responder `402` (corrida/cache) ENTÃO o paywall abre
    (reativo) em vez de erro inline.

- **[PAY]-07** — Sanity check (`app/sanity-check.tsx`): sem `ai_personal`, a entrada da
  ação fica bloqueada (badge "Pro") e abre o paywall (`feature=sanity_check`).
  - QUANDO `ai_personal=false` ENTÃO a ação de sanity check não dispara e leva ao paywall.
  - QUANDO `ai_personal=true` ENTÃO funciona inalterado.

- **[PAY]-08** — IA de coach (`app/(coach)/aluno-novo.tsx` "gerar plano com IA" e
  `app/(coach)/import-workout.tsx`): sem `ai_coach`, os CTAs de IA mostram badge "Pro" e
  abrem o paywall (`coach_generate_plan` / `coach_import_workout`).
  - QUANDO `ai_coach=false` ENTÃO o CTA de IA está bloqueado e abre o paywall.
  - QUANDO `ai_coach=false` mas há caminho **sem IA** (ex: cadastrar aluno sem gerar plano,
    importar manual) ENTÃO esse caminho permanece disponível.
  - QUANDO `ai_coach=true` ENTÃO funciona inalterado.

- **[PAY]-09** — Limite de alunos (`app/(coach)/aluno-novo.tsx` / criação de aluno): quando
  o nº de alunos atual `>= student_limit`, o CTA de criar aluno fica bloqueado com aviso e
  abre o paywall (`feature=student_limit`).
  - QUANDO `student_limit` não-nulo e contagem de alunos `>= student_limit` ENTÃO criar
    aluno está bloqueado e leva ao paywall.
  - QUANDO `student_limit=null` (premium) ENTÃO nunca bloqueia.
  - QUANDO o servidor responder `402 student_limit` ENTÃO o paywall abre (reativo).

### Aresta: aluno não compra (C4)

- **[PAY]-10** — Para `role='aluno'`, o paywall **não** mostra CTA de compra; mostra copy
  explicando que o acesso à IA depende do plano do professor.
  - QUANDO um aluno (IA herdada do coach free) atinge um bloqueio de `ai_personal` ENTÃO
    o paywall abre em modo "informe seu professor", **sem** botão de assinar.

## Restrições de implementação

- Reusar `src/components/ui/` (`Button`, `Screen`, `Card`) e o tema `src/lib/theme.ts`.
  Sem nova lib de UI/bottom-sheet.
- Sem i18n: textos PT-BR hardcoded, com acentuação correta.
- Não introduzir preço hardcoded como fonte de verdade — valor indicativo claramente
  marcado como placeholder pra #5 (C5).
- Nenhuma escrita em `subscriptions` pelo cliente (RLS já nega; cliente só **lê** via RPC).
- TDD nas partes com lógica (detecção do `402` → `NeedsUpgradeError`, resolução de
  `feature` → copy, regra de limite de alunos). UI pura: verificação manual + typecheck.

## Rastreabilidade

| ID | Descrição | Status |
|----|-----------|--------|
| [PAY]-01 | `useEntitlement()` hook | Implemented (typecheck ok; runtime no UAT) |
| [PAY]-02 | Tipo `Entitlement` no cliente | Verified (typecheck) |
| [PAY]-03 | `NeedsUpgradeError` + detecção 402 (**4** padrões) | Verified (8 testes vitest; +sanityCheck.ts achado no execute) |
| [PAY]-04 | Rota `app/paywall.tsx` por `feature` | Implemented (typecheck + tipos de rota regen; UAT) |
| [PAY]-05 | Helper `handleNeedsUpgrade` | Verified (3 testes vitest) |
| [PAY]-06 | Gating UI chat | Implemented (typecheck; UAT manual) |
| [PAY]-07 | Gating UI sanity check | Implemented (typecheck; UAT manual) |
| [PAY]-08 | Gating UI IA de coach | Implemented (typecheck; UAT manual) |
| [PAY]-09 | Gating UI limite de alunos | Implemented (regra `isStudentLimitReached` 4 testes; UAT) |
| [PAY]-10 | Paywall modo aluno (sem compra) | Implemented (typecheck; UAT manual) |

> **Nota de execução:** a detecção do 402 acabou em **4** call sites, não 3 — `runSanityCheck`
> (`src/services/sanityCheck.ts`) tem fetch próprio, não passa por `chat.ts`. Plugado lá também.
> **Qualidade:** `PaywallNotice` (componente único) + hooks `useAiPersonalLocked`/`useAiCoachLocked`
> consolidam o gating proativo nas 4 telas (resultado do /simplify).
