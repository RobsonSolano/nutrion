# HANDOFF — Cronômetro de treino em tempo real

> Documento auto-contido pra **continuar esta feature num chat separado**. Lê este
> arquivo + `spec.md`, `design.md`, `tasks.md`, `context.md`, `VERIFY.md` (mesma pasta).
> Branch: **`feature/workout-tracking-real-time`** (baseada na `develop`).

## Estado atual

Feature **implementada** e **100% OTA** (sem migration, sem dependência nativa nova).
Verificado verde: `npm test` 10/10 (lógica pura), `npx tsc --noEmit`, lint sem warning
novo. **Ainda NÃO commitado** (WIP no working tree da branch) — ver "Git" abaixo.

**Camadas entregues:**
- `src/lib/workoutTimer.ts` (+`.test.ts`) — lógica pura por timestamps (testada).
- `src/types/workoutTimer.ts` — `ActiveWorkout`.
- `src/services/activeWorkout.ts` — persistência AsyncStorage (`active_workout`).
- `src/services/workoutNotifications.ts` — ongoing + aviso de 2h (local; no-op em Expo Go).
- `src/stores/useActiveWorkoutStore.ts` + `src/hooks/useActiveWorkout.ts` /
  `useActiveWorkoutHeartbeat.ts` / `usePendingWorkout.ts`.
- `app/treino-ativo.tsx` (tela do cronômetro) · entradas em `app/(tabs)/treino.tsx` e
  `app/rotina/[id].tsx` · `src/components/workout/PendingWorkoutModal.tsx` ·
  `app/(tabs)/_layout.tsx` (monta heartbeat + modal) · `useNotificationRouter.ts` (tap).
- `src/services/routines.ts` + `src/hooks/useRoutines.ts` — `insertSession` aceita `day`.
- vitest reintroduzido (`vitest.config.ts`, scripts).

## 🐞 Bug encontrado no UAT (Expo Go) — PRIORIDADE

**Sintoma:** iniciei "Treino A" e a tela mostrou "Treino em andamento / **Treino**" (nome
errado).

**Causa provável (a investigar/confirmar):** o guard **"um treino ativo por vez"**
(`if (!activeWorkout) start(...)` em `treino.tsx` e `rotina/[id].tsx`) — havia um treino
ativo anterior (ex: "Treino", de um teste não finalizado); ao tocar "Treino A", **não
inicia um novo** e navega pro que já estava rolando. Não é perda do nome; é a interação
"já existe ativo" **sem feedback**.

**O que decidir/fazer (UX):**
- Ao tocar uma rotina com OUTRO treino já em andamento → **modal de confirmação**:
  "Você já tem um treino em andamento (*Nome*). Continuar esse, ou descartar e iniciar
  *Treino A*?" (Continuar / Descartar e iniciar / Cancelar).
- Garantir feedback claro do nome ao iniciar.
- Repro pra confirmar a causa: iniciar A, voltar sem salvar, tocar B → observar.
- Cobrir com teste a regra de "iniciar com ativo existente" (decisão de UX vira lógica testável).

## O que falta

1. **Resolver o bug/UX acima** (one-active-at-a-time + nome).
2. **UAT em dev build** das partes que são no-op no Expo Go (ver `VERIFY.md`):
   notificação contínua, aviso de 2h, e tap da notificação → tela.
3. **UAT geral no device** (resto do `VERIFY.md`: salvar, lock rolando, matar app→pendente).
4. **/simplify** já rodado no diff atual; ao finalizar, rodar de novo no diff novo →
   `npm test` + `npx tsc` + lint → **commit** (split sugerido abaixo) → **merge OTA**.

## Commit sugerido (commits divididos) — quando finalizar

1. `chore(test): reintroduz vitest na develop`
2. `feat(treino): lógica pura + persistência do cronômetro`
3. `feat(treino): notificações locais (ongoing + aviso de 2h)`
4. `feat(treino): store + hooks do treino ativo`
5. `feat(treino): telas, entradas e modal de recuperação`
6. `docs(treino): spec/design/tasks/VERIFY + STRUCTURE`

Feature é OTA → pode mergear em `develop` após UAT; **OTA pra produção só depois do UAT**.

## Como continuar no chat novo

1. `git checkout feature/workout-tracking-real-time` (já existe, com o WIP).
2. Testar lógica/UI: `npm run start:go` (Expo Go) — cobre cronômetro, salvar, lock
   rolando, modal de pendente. Notificações exigem **dev build** (`npm run start`).
3. Atacar o bug/UX, depois UAT + commit + merge.

## Decisões travadas (de context.md)

D1 start pela rotina · D2 salva em minutos (`duration_min`, zero migration) · D3 lock =
notificação contínua OTA (widget nativo = futuro/build) · D4 tempo por timestamps · D5
lock≠close (lock rola, só app morto pausa→pendente) · D6 heartbeat congela o pendente ·
D7 push de 2h = notificação local agendada.

## Git

WIP **não commitado** na branch `feature/workout-tracking-real-time`. Arquivos novos +
modificados listados em "Camadas entregues". `supabase/.branches/` é untracked (ignorar).
Recomendado **commitar o WIP** antes de trocar de chat (preserva o trabalho).
