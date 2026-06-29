# Contexto — Cronômetro de treino em tempo real

> Feature pedida por usuário: cronometrar o treino (start/pausa/parar), salvar como
> treino do dia com o tempo, sobreviver a bloqueio de tela e a fechamento do app,
> avisar por push. Branch: `feature/workout-tracking-real-time`.

## Restrição mestra (do dev)

**Pré-lançamento: evitar gerar novo APK.** Tudo que der vai por **OTA** (`eas update`);
o que exigir nativo fica **aberto na branch** pra merge quando houver build. Ver
memória `feedback-no-new-apk`.

## Decisões (Discuss 2026-06-29)

- **D1 — Start a partir da rotina (aba Treinos).** Toca uma rotina existente →
  "Iniciar treino" → tela de cronômetro. Ao parar, salva `workout_session` com
  `routine_id`/`routine_name` daquela rotina. **Sem treino livre** nesta v1 (só rotina).
- **D2 — Salvar em MINUTOS.** Usa a coluna `workout_sessions.duration_min` que **já
  existe** → **zero migration, 100% OTA**. O cronômetro mostra HH:MM:SS ao vivo; o
  histórico guarda minutos arredondados (`round(elapsedSec/60)`).
- **D3 — Tela bloqueada = notificação contínua (OTA) agora.** Notificação fixa
  "Treino em andamento desde HH:MM", tocável pra reabrir. O **widget nativo rolando
  de verdade** fica pra um incremento quando houver build (não nesta entrega OTA).
- **D4 — Cronômetro baseado em timestamps**, não em acumulador de `setInterval`. O
  tempo decorrido = `accumulatedMs + (now - runningSince)`. Assim atravessa
  lock/background "rolando" sem execução nativa em background.
- **D5 — Lock ≠ Close.** Bloquear a tela / mandar pro background **NÃO pausa** (o
  timestamp segue). Só o **app morto** interrompe → vira **sessão pendente**.
- **D6 — Heartbeat pra congelar o tempo do pendente.** Enquanto roda, persiste um
  `lastSeenAt` periódico. Se o app é morto, o tempo do treino pendente é congelado no
  último heartbeat (não conta as horas que o app ficou fechado).
- **D7 — Push de 2h = notificação LOCAL agendada** (`expo-notifications`, já
  instalado) pra `start + 2h`. Cancela ao parar/salvar/descartar. OTA.

## Mapa do existente (relevante)

- **`workout_sessions`** (migration `20260422120000_workout_routines.sql`): `user_id`,
  `routine_id` (nullable), `routine_name`, `day` (date), `duration_min` (int nullable),
  `notes`, `created_at`. **É onde o treino cronometrado é salvo** — schema já serve.
- **`useCreateSession()`** (`src/hooks/useRoutines.ts`) + `insertSession()`
  (`src/services/routines.ts`) já criam a sessão do dia (hoje `day` é fixo em hoje —
  precisará aceitar `day` custom pro caso "Ajustar").
- **Aba Treinos**: `app/(tabs)/treino.tsx` (lista de rotinas). Detalhe: `app/rotina/[id].tsx`.
- **Registro**: `app/log.tsx` → `src/components/log/WorkoutForm.tsx` (já tem input de
  duração horas+minutos e lista "Feitos hoje").
- **UI**: `Button`, `Card`, `Screen`, `Input`, `ConfirmModal`, `SegmentedControl` em
  `src/components/ui/`. AsyncStorage usado direto (ex: `src/lib/unreadRequests.ts`).
- **Notificações**: hoje só push remoto (`src/services/pushNotifications.ts`). **Não há**
  `scheduleNotificationAsync` — será introduzido (local, OTA).

## Fora de escopo (desta entrega OTA)

- Widget nativo de lock screen com segundos rolando (precisa build → incremento futuro).
- Treino livre sem rotina (pode virar follow-up).
- Editar/cronometrar exercício a exercício (a sessão é do treino inteiro).
