# Design — Cronômetro de treino em tempo real

> Tudo OTA. Camadas: lógica pura (testável) → persistência (AsyncStorage) → hook de
> estado (AppState + heartbeat) → notificações (local) → UI (telas + modal).

## 1. Estado do treino ativo

```ts
// src/types/workoutTimer.ts
type ActiveWorkout = {
  routineId: string | null;
  routineName: string;
  startedAt: number;       // epoch ms — 1º start (define o "desde HH:MM" e o +2h)
  day: string;             // YYYY-MM-DD em que começou (pode ser ajustado no pendente)
  accumulatedMs: number;   // soma dos segmentos já rodados (antes do atual)
  runningSince: number | null; // epoch ms do segmento atual; null = pausado
  lastSeenAt: number;      // heartbeat — último instante em que o app estava vivo
};
```

`status` é derivado: `runningSince === null ? 'paused' : 'running'`.

## 2. Lógica pura — `src/lib/workoutTimer.ts` (TDD, vitest)

Funções sem I/O, 100% testáveis:

- `startWorkout({routineId, routineName}, now): ActiveWorkout`
- `pause(s, now): ActiveWorkout` — acumula `now - runningSince`, zera `runningSince`.
- `resume(s, now): ActiveWorkout` — `runningSince = now`.
- `elapsedMs(s, now): number` — `accumulatedMs + (runningSince ? now - runningSince : 0)`.
- `freezeForPending(s): ActiveWorkout` — congela o decorrido até `lastSeenAt` (pausa no
  último heartbeat) → usado quando o app foi morto.
- `formatHMS(ms): string` — `"HH:MM:SS"`.
- `msToMinutes(ms): number` — `max(1, round(ms/60000))`.
- `touch(s, now): ActiveWorkout` — atualiza `lastSeenAt` (heartbeat).

> Verdade do tempo = timestamps. `setInterval` na UI só força re-render (1s); o valor vem
> sempre de `elapsedMs(state, Date.now())` — por isso lock/background não perdem tempo.

## 3. Persistência — `src/services/activeWorkout.ts`

AsyncStorage, chave `active_workout` (padrão de `src/lib/unreadRequests.ts`):
- `loadActiveWorkout(): Promise<ActiveWorkout | null>`
- `saveActiveWorkout(s): Promise<void>`
- `clearActiveWorkout(): Promise<void>`

## 4. Hook de estado — `src/hooks/useActiveWorkout.ts`

Fonte única de verdade em runtime (Zustand `useActiveWorkoutStore` em memória + espelho
no AsyncStorage). Expõe:
`{ active, elapsedMs, status, start(routine), pause(), resume(), stop(), saveToday(),
   discard(), adjustAndSave({durationMin, day}) }`

- **Tick de UI:** `setInterval(1s)` só enquanto a tela do timer está montada (re-render).
- **Heartbeat:** enquanto `running`, persiste `touch()` a cada ~5s e no `AppState`
  → 'background' (último ponto vivo antes de poss. kill). **Não pausa** no background (D5).
- **start/pause/resume/stop** chamam a lógica pura + persistem + (start) disparam
  notificações; **saveToday/adjustAndSave** chamam `useCreateSession` e limpam tudo.

## 5. Detecção de pendente — `src/hooks/usePendingWorkout.ts`

- No **cold start** (mount do layout autenticado), `loadActiveWorkout()`:
  - Se existe estado persistido E o store em memória está vazio → **foi morto** →
    `freezeForPending` → expõe `pending` pro modal. (App só backgrounded mantém o store
    em memória → não dispara o modal.)
- Montado em `app/(tabs)/_layout.tsx` (onde já vive `useAutoRequestPushPermission`).

## 6. Notificações — `src/services/workoutNotifications.ts` (local, OTA)

`expo-notifications` (lazy, igual `pushNotifications.ts`; no-op em Expo Go):
- `showOngoing(routineName, startedAt)` → `scheduleNotificationAsync({content:{title,
  body:"Treino em andamento desde HH:MM", sticky:true, data:{type:'active_workout'}},
  trigger:null})` → guarda o id.
- `scheduleTwoHourAlert(startedAt)` → `trigger:{seconds: max(1, 7200 - elapsedSec)}` →
  guarda o id.
- `clearWorkoutNotifications()` → dismiss da ongoing + cancel do 2h.
- Tap: estender `useNotificationRouter` pra rotear `data.type==='active_workout'` → tela do timer.

## 7. UI

| Arquivo | O quê |
|---|---|
| `app/(tabs)/treino.tsx` | + ação "Iniciar treino" em cada rotina (entry point D1). |
| `app/rotina/[id].tsx` | + botão "Iniciar treino" no detalhe. |
| `app/treino-ativo.tsx` | **Nova tela** (expo-router): HH:MM:SS grande + Pausar/Retomar/Parar; ao Parar, resumo + "Salvar treino de hoje"/"Descartar". |
| `src/components/workout/PendingWorkoutModal.tsx` | Modal de recuperação (base `ConfirmModal`/Modal): nome, dia, tempo; Salvar/Ajustar/Remover; Ajustar habilita inputs duração (h+min) + dia. |
| `app/(tabs)/_layout.tsx` | monta `usePendingWorkout()` + `<PendingWorkoutModal/>`. |

- Se já há treino ativo, "Iniciar treino" **navega** pra `treino-ativo` (não recria) — [WT]-01.
- Rotas tipadas: usar `as Href` se o `router.d.ts` não regenerou (convenção já usada no projeto).

## 8. Persistir no dia certo — ajuste em `insertSession`

`src/services/routines.ts insertSession()` hoje fixa `day = dayKey()`. Adicionar param
opcional `day?: string` (default hoje) e propagar em `useCreateSession` → cobre [WT]-10
(Ajustar salva no dia informado). Mudança aditiva, não quebra chamadas atuais.

## 9. Tooling — reintroduzir vitest (chore)

A develop perdeu o vitest no reset do billing. Como `[WT]` tem lógica pura testável,
re-adicionar `vitest` + `vitest.config.ts` (escopo `src/lib/**`) + script `test`.
DevDependency → **não afeta bundle nem exige APK**. Espelha o que o billing já fez.

## Riscos / decisões de design

- **Kill detection** é heurística (store em memória vazio + estado persistido). Cobre o
  caso real (app morto). Falso-positivo só se o JS recarregar sem kill (raro; o modal é
  inócuo — o usuário Salva/Remove).
- **Permissão de notificação** ausente → ongoing/2h simplesmente não aparecem (graceful);
  o timer in-app funciona igual.
- **Heartbeat** a 5s limita a perda máxima de tempo do pendente a ~5s (aceitável).
