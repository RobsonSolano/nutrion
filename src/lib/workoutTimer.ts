import type { ActiveWorkout, WorkoutStatus } from '@/types/workoutTimer';

/**
 * Lógica pura do cronômetro de treino. Sem I/O — toda função recebe `now`
 * (epoch ms) de fora pra ser determinística e testável. A verdade do tempo é
 * `accumulatedMs + (rodando ? now - runningSince : 0)`.
 */

export function startWorkout(
  input: { routineId: string | null; routineName: string; day: string },
  now: number,
): ActiveWorkout {
  return {
    routineId: input.routineId,
    routineName: input.routineName,
    day: input.day,
    startedAt: now,
    accumulatedMs: 0,
    runningSince: now,
    lastSeenAt: now,
  };
}

export function statusOf(s: ActiveWorkout): WorkoutStatus {
  return s.runningSince === null ? 'paused' : 'running';
}

export function elapsedMs(s: ActiveWorkout, now: number): number {
  const running = s.runningSince === null ? 0 : now - s.runningSince;
  return s.accumulatedMs + Math.max(0, running);
}

/** Pausa: acumula o segmento atual. Idempotente se já pausado. */
export function pause(s: ActiveWorkout, now: number): ActiveWorkout {
  if (s.runningSince === null) return s;
  return {
    ...s,
    accumulatedMs: s.accumulatedMs + Math.max(0, now - s.runningSince),
    runningSince: null,
    lastSeenAt: now,
  };
}

/** Retoma. Idempotente se já rodando. */
export function resume(s: ActiveWorkout, now: number): ActiveWorkout {
  if (s.runningSince !== null) return s;
  return { ...s, runningSince: now, lastSeenAt: now };
}

/** Heartbeat — marca o último instante vivo (usado pra congelar o pendente). */
export function touch(s: ActiveWorkout, now: number): ActiveWorkout {
  return { ...s, lastSeenAt: now };
}

/**
 * Congela o treino no último heartbeat (app foi morto): vira pausado com o
 * tempo acumulado até `lastSeenAt`. Não conta o período em que o app ficou
 * fechado.
 */
export function freezeForPending(s: ActiveWorkout): ActiveWorkout {
  if (s.runningSince === null) return s;
  return {
    ...s,
    accumulatedMs: s.accumulatedMs + Math.max(0, s.lastSeenAt - s.runningSince),
    runningSince: null,
  };
}

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Minutos pro `workout_sessions.duration_min`. Mínimo 1 (não salva 0). */
export function msToMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60000));
}
