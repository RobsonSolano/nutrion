import { useEffect, useState } from 'react';
import { loadActiveWorkout, clearActiveWorkout } from '@/services/activeWorkout';
import { clearWorkoutNotifications } from '@/services/workoutNotifications';
import { elapsedMs, freezeForPending, msToMinutes } from '@/lib/workoutTimer';
import { useActiveWorkoutStore } from '@/stores/useActiveWorkoutStore';
import { useCreateSession } from '@/hooks/useRoutines';
import type { ActiveWorkout } from '@/types/workoutTimer';

/**
 * Detecta um treino PENDENTE no cold start: se há estado persistido E o store
 * em memória está vazio, o app foi morto durante um treino → recuperar.
 * (Resume morno — app backgrounded e voltou — mantém o store em memória, então
 * NÃO dispara o pendente.) Expõe as ações do modal de recuperação.
 */
export function usePendingWorkout() {
  const [pending, setPending] = useState<ActiveWorkout | null>(null);
  const createSession = useCreateSession();

  useEffect(() => {
    // Lê o store via getState pra rodar de fato só uma vez (sem dep externa).
    if (useActiveWorkoutStore.getState().active) return;
    let mounted = true;
    void (async () => {
      const loaded = await loadActiveWorkout();
      if (mounted && loaded) setPending(freezeForPending(loaded));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function dismiss() {
    setPending(null);
    await clearActiveWorkout();
    await clearWorkoutNotifications();
  }

  /** Salva com o tempo congelado e o dia original. */
  async function saveAsIs() {
    if (!pending) return;
    await createSession.mutateAsync({
      routineId: pending.routineId,
      routineName: pending.routineName,
      durationMin: msToMinutes(elapsedMs(pending, Date.now())),
      day: pending.day,
    });
    await dismiss();
  }

  /** Salva com duração (horas/minutos) e dia ajustados. */
  async function saveAdjusted(input: { hours: number; minutes: number; day: string }) {
    if (!pending) return;
    const durationMin = Math.max(1, Math.round(input.hours) * 60 + Math.round(input.minutes));
    await createSession.mutateAsync({
      routineId: pending.routineId,
      routineName: pending.routineName,
      durationMin,
      day: input.day,
    });
    await dismiss();
  }

  return {
    pending,
    elapsedMsValue: pending ? elapsedMs(pending, Date.now()) : 0,
    saveAsIs,
    saveAdjusted,
    remove: dismiss,
    saving: createSession.isPending,
  };
}
