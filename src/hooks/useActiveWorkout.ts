import { useActiveWorkoutStore } from '@/stores/useActiveWorkoutStore';
import { useCreateSession } from '@/hooks/useRoutines';
import { elapsedMs, msToMinutes, statusOf } from '@/lib/workoutTimer';

/**
 * Ações do treino ativo (sessão viva). O tempo decorrido vem sempre de
 * `elapsedMs(active, Date.now())` — a tela faz o tick de 1s só pra re-render.
 * O salvamento usa o dia de início (`active.day`).
 */
export function useActiveWorkout() {
  const active = useActiveWorkoutStore((s) => s.active);
  const start = useActiveWorkoutStore((s) => s.start);
  const pause = useActiveWorkoutStore((s) => s.pause);
  const resume = useActiveWorkoutStore((s) => s.resume);
  const clear = useActiveWorkoutStore((s) => s.clear);
  const createSession = useCreateSession();

  async function saveToday(notes?: string | null) {
    if (!active) return;
    await createSession.mutateAsync({
      routineId: active.routineId,
      routineName: active.routineName,
      durationMin: msToMinutes(elapsedMs(active, Date.now())),
      notes: notes ?? null,
      day: active.day,
    });
    clear();
  }

  return {
    active,
    status: active ? statusOf(active) : null,
    getElapsedMs: () => (active ? elapsedMs(active, Date.now()) : 0),
    start,
    pause,
    resume,
    saveToday,
    discard: clear,
    saving: createSession.isPending,
  };
}
