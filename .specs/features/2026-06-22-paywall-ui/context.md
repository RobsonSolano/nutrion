# Contexto — paywall-ui (spec #2 da iniciativa de billing)

> Decisões do discovery (2026-06-22). Spec #2: consome o contrato server-side do
> `billing-core` (#1) no cliente. **Destrava o deploy** do billing-core — só vão pra
> prod juntos (CONCERN em `.specs/project/STATE.md`).

## O que já está pronto (billing-core, #1)

- RPC `resolve_entitlement()` (SECURITY DEFINER, sem args, usa `auth.uid()`) → JSON:
  `{ tier, source, ai_personal, ai_coach, student_limit, trial_end }`.
- Gating server-side autoritativo: edge functions retornam `402 { error: 'needs_upgrade', feature }`.
- **Feature keys reais emitidas pelo servidor** (verificado em `needsUpgrade(...)`):

  | feature key | Superfície | Direito |
  |---|---|---|
  | `chat` | `chat-ai` modo chat | `ai_personal` |
  | `sanity_check` | `chat-ai` modo sanity | `ai_personal` |
  | `coach_generate_plan` | `coach-generate-plan` | `ai_coach` |
  | `coach_import_workout` | `coach-import-workout-ai` | `ai_coach` |
  | `student_limit` | `coach-create-student` | tier (limite de alunos) |

## Decisões do discovery (aprovadas)

| # | Decisão | Razão / efeito |
|---|---------|----------------|
| C1 | **CTA "Assinar" = placeholder "em breve"** | Compra real (RevenueCat/IAP) é a spec #5. No #2 o paywall apresenta valor + CTA desabilitado/"em breve". A #5 pluga a compra no mesmo botão. Mantém #2 independente da Play Console. |
| C2 | **Gating de UI híbrido** | Lê entitlement no load e marca CTAs bloqueados (cadeado/badge "Pro", abre paywall ao tocar). O `402` do servidor permanece como rede de segurança (autoridade). Evita o usuário "bater no erro". |
| C3 | **Paywall = rota full-screen com param `feature`** | `app/paywall.tsx` (modal route do expo-router) recebe `feature` e customiza copy/benefícios. Reutilizável por todas as superfícies via `router.push`. Projeto não tem lib de bottom-sheet (só `ConfirmModal` centralizado). |

## Decisões derivadas (definidas pelo agente, sujeitas a review da spec)

| # | Decisão | Razão |
|---|---------|-------|
| C4 | **Aluno (`role='aluno'`) não vê CTA de compra** | Aluno não paga; IA é **herdada do plano do coach** (memória da iniciativa). Se o coach é free, o aluno recebe `402`/bloqueio — o paywall mostra copy "seu acesso depende do plano do seu professor", sem botão de assinar. |
| C5 | **Preço: benefício-first, valor indicativo marcado como placeholder** | `billing-core` é price-agnostic; preços vêm da loja/RevenueCat (#5). O paywall foca em benefícios; preço aparece como texto indicativo (ex: "a partir de R$ 15,90/mês") claramente substituível pela offering real na #5. |
| C6 | **Durante o load do entitlement, não bloquear falsamente** | Enquanto `useEntitlement` carrega, os CTAs aparecem normais (fail-open visual). O `402` do servidor é a autoridade — se o usuário disparar sem direito, cai no paywall reativo. Sem flash de cadeado em quem tem acesso. |
| C7 | **`NeedsUpgradeError` tipado na camada de serviço** | Os 3 padrões de chamada (fetch em `chat.ts`, `callFn` em `students.ts`, `supabase.functions.invoke` em `workoutImport.ts`/`templates.ts`) passam a detectar `402 needs_upgrade` e lançar `NeedsUpgradeError(feature)`. Nenhum 402 vaza como erro técnico cru. O `invoke` engole o body em não-2xx → ler via `FunctionsHttpError.context`. |

## Fora de escopo (paywall-ui)

- Compra real, SDK RevenueCat, webhook, offerings/preços reais, cupons (spec #5).
- Concessão de trial, fluxo ex-aluno, downgrade "escolhe quem fica" (spec #3).
- Documentos legais / aceite no cadastro (spec #4).
- Qualquer mudança no servidor/`resolve_entitlement` (é #1, já fechado).

## Mapa do cliente (pontos de integração)

- **Serviços (chamadas):** `src/services/chat.ts` (fetch direto), `src/services/students.ts`
  (`callFn` fetch — `coach-generate-plan`, `coach-create-student`),
  `src/services/workoutImport.ts` (`invoke`), `src/services/templates.ts` (`invoke`).
- **Estado:** React Query (`src/hooks/useProfile.ts`, `queryKeys`) + Zustand
  (`src/stores/useSessionStore.ts`). Perfil traz `role`/`coach_id`.
- **Erro:** `src/components/GlobalAlertProvider.tsx` (`useAlert().showError` + `parseError`).
  Chat usa `setLastError` inline (`src/hooks/useChat.ts`).
- **UI base:** `src/components/ui/` (`Button`, `ConfirmModal`, `Screen`, `Card`),
  tema em `src/lib/theme.ts` (accent `#39FF14`, violet `#8B5CF6`, etc.).
- **Navegação:** expo-router, `useRouter()`. Grupos `(tabs)`, `(coach)`.
- **i18n:** não há — textos PT-BR hardcoded.
- **Superfícies de IA na UI:** `app/(tabs)/chat.tsx`, `app/sanity-check.tsx`,
  `app/(coach)/aluno-novo.tsx` (gerar plano), `app/(coach)/import-workout.tsx`.
