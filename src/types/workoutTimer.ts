/**
 * Estado de um treino sendo cronometrado. A verdade do tempo é baseada em
 * timestamps (não num acumulador de setInterval) — por isso atravessa
 * lock/background "rolando" sem execução nativa em background.
 */
export type ActiveWorkout = {
  routineId: string | null;
  routineName: string;
  /** epoch ms do 1º start — define "desde HH:MM" e o agendamento de +2h. */
  startedAt: number;
  /** YYYY-MM-DD em que o treino começou (ajustável no fluxo de pendente). */
  day: string;
  /** soma dos segmentos já rodados (antes do segmento atual). */
  accumulatedMs: number;
  /** epoch ms do início do segmento atual; null = pausado. */
  runningSince: number | null;
  /** heartbeat — último instante em que o app estava comprovadamente vivo. */
  lastSeenAt: number;
};

/** Derivado de runningSince. */
export type WorkoutStatus = 'running' | 'paused';
