# Tasks — Cronômetro de treino em tempo real

> Formato What/Where/Depends/Done-when/Verify. TDD inline na lógica pura. Tudo OTA.
> Branch: `feature/workout-tracking-real-time`.

## T0 — chore: reintroduzir vitest
- **What:** `vitest` (devDep) + `vitest.config.ts` (escopo `src/lib/**/*.test.ts`) + script `"test": "vitest run"`.
- **Where:** `package.json`, `vitest.config.ts`.
- **Depends:** —
- **Done-when:** `npm test` roda (passWithNoTests ok).
- **Verify:** `npm test` exit 0.

## T1 — lógica pura do timer (TDD)
- **What:** `ActiveWorkout` type + `startWorkout/pause/resume/elapsedMs/freezeForPending/formatHMS/msToMinutes/touch`.
- **Where:** `src/types/workoutTimer.ts`, `src/lib/workoutTimer.ts` (+ `workoutTimer.test.ts`).
- **Depends:** T0
- **Done-when:** testes cobrindo: elapsed running/paused; pause+resume soma certo; freeze usa lastSeenAt; formatHMS (0, <1h, >1h, >24h); msToMinutes (min 1, arredonda).
- **Verify (TDD):** escrever testes RED → implementar → `npm test` GREEN. IDs no nome (ex: `WT03_elapsed_running`).

## T2 — persistência AsyncStorage
- **What:** `loadActiveWorkout/saveActiveWorkout/clearActiveWorkout` (chave `active_workout`).
- **Where:** `src/services/activeWorkout.ts`.
- **Depends:** T1
- **Done-when:** funções tipadas; JSON parse defensivo (retorna null em corrompido).
- **Verify:** `npx tsc --noEmit`.

## T3 — notificações locais
- **What:** `showOngoing/scheduleTwoHourAlert/clearWorkoutNotifications` (expo-notifications lazy, no-op Expo Go; guarda ids).
- **Where:** `src/services/workoutNotifications.ts`.
- **Depends:** T1
- **Done-when:** sticky ongoing + trigger 2h; clear dismiss+cancel; `data.type='active_workout'`.
- **Verify:** `npx tsc --noEmit`.

## T4 — store/hook de estado
- **What:** Zustand `useActiveWorkoutStore` + `useActiveWorkout()` expondo start/pause/resume/stop/saveToday/discard/adjustAndSave + elapsedMs/status. Heartbeat (5s + AppState background), tick UI 1s, dispara/limpa notificações.
- **Where:** `src/stores/useActiveWorkoutStore.ts`, `src/hooks/useActiveWorkout.ts`.
- **Depends:** T1, T2, T3, T6
- **Done-when:** start persiste+notifica; stop/save limpa tudo; não pausa no background.
- **Verify:** `npx tsc --noEmit`.

## T5 — insertSession aceita `day` custom
- **What:** param opcional `day?: string` (default `dayKey()`) em `insertSession` + `useCreateSession`.
- **Where:** `src/services/routines.ts`, `src/hooks/useRoutines.ts`.
- **Depends:** —
- **Done-when:** chamadas atuais inalteradas; novo param propaga pro insert.
- **Verify:** `npx tsc --noEmit` (callers existentes compilam).

## T6 — tela do cronômetro ativo
- **What:** `app/treino-ativo.tsx` — HH:MM:SS grande, Pausar/Retomar/Parar; ao Parar, resumo "Treino {nome} — HH:MM:SS" + "Salvar treino de hoje"/"Descartar".
- **Where:** `app/treino-ativo.tsx`.
- **Depends:** T4
- **Done-when:** controles funcionam; salvar cria sessão e volta; descartar limpa.
- **Verify:** `npx tsc --noEmit`; UAT manual.

## T7 — entry points "Iniciar treino"
- **What:** ação "Iniciar treino" por rotina na aba Treinos + botão no detalhe; se já há ativo, navega pro `treino-ativo`.
- **Where:** `app/(tabs)/treino.tsx`, `app/rotina/[id].tsx`.
- **Depends:** T4, T6
- **Done-when:** inicia e navega; um ativo por vez.
- **Verify:** `npx tsc --noEmit`; UAT.

## T8 — pendente: detecção + modal
- **What:** `usePendingWorkout()` (cold start + store vazio → freeze) + `PendingWorkoutModal` (nome/dia/tempo; Salvar/Ajustar/Remover; Ajustar habilita duração h+min e dia). Montar em `app/(tabs)/_layout.tsx`.
- **Where:** `src/hooks/usePendingWorkout.ts`, `src/components/workout/PendingWorkoutModal.tsx`, `app/(tabs)/_layout.tsx`.
- **Depends:** T4, T5
- **Done-when:** app morto com treino ativo → modal na volta; Salvar/Ajustar/Remover funcionam.
- **Verify:** `npx tsc --noEmit`; UAT (matar app com treino rodando).

## T9 — tap da notificação → tela do timer
- **What:** rotear `data.type==='active_workout'` pra `treino-ativo`.
- **Where:** `src/hooks/useNotificationRouter.ts`.
- **Depends:** T3, T6
- **Done-when:** tocar a notificação abre o cronômetro.
- **Verify:** `npx tsc --noEmit`; UAT.

## Pós-execute
- `/simplify` no diff acumulado → `npm test` + `npx tsc --noEmit` + lint dos arquivos tocados → Docs (STRUCTURE.md) → commit (commits divididos por camada) → **branch aberta** (decidir merge OTA vs manter, com o dev).

## Rastreabilidade
T1→[WT]-02/03/04/05 · T3→[WT]-06/12 · T4→[WT]-01/03/05/07 · T6→[WT]-02/04/05 ·
T7→[WT]-01 · T8→[WT]-07/08/09/10/11 · T9→[WT]-06.
