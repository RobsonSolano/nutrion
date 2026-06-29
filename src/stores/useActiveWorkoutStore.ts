import { create } from 'zustand';
import type { ActiveWorkout } from '@/types/workoutTimer';
import {
  startWorkout,
  pause as pauseLogic,
  resume as resumeLogic,
  touch,
} from '@/lib/workoutTimer';
import { saveActiveWorkout, clearActiveWorkout } from '@/services/activeWorkout';
import {
  showOngoing,
  scheduleTwoHourAlert,
  clearWorkoutNotifications,
} from '@/services/workoutNotifications';
import { todayKey } from '@/lib/queryKeys';

/**
 * Estado do treino ativo em runtime (memória) espelhado no AsyncStorage. NÃO
 * hidrata automaticamente no boot: um treino persistido encontrado no cold
 * start é tratado como PENDENTE (ver usePendingWorkout), não como timer vivo —
 * fechar o app pausa e deixa pendente (decisão D5/D8).
 */
type State = {
  active: ActiveWorkout | null;
  start: (routine: { id: string | null; name: string }) => void;
  pause: () => void;
  resume: () => void;
  heartbeat: () => void;
  clear: () => void;
};

export const useActiveWorkoutStore = create<State>((set, get) => ({
  active: null,

  start: (routine) => {
    const now = Date.now();
    const s = startWorkout(
      { routineId: routine.id, routineName: routine.name, day: todayKey() },
      now,
    );
    set({ active: s });
    void saveActiveWorkout(s);
    void showOngoing(s.routineName, s.startedAt);
    void scheduleTwoHourAlert(s.startedAt);
  },

  pause: () => {
    const a = get().active;
    if (!a) return;
    const s = pauseLogic(a, Date.now());
    set({ active: s });
    void saveActiveWorkout(s);
  },

  resume: () => {
    const a = get().active;
    if (!a) return;
    const s = resumeLogic(a, Date.now());
    set({ active: s });
    void saveActiveWorkout(s);
  },

  // Heartbeat: só persiste o "último instante vivo" enquanto roda.
  heartbeat: () => {
    const a = get().active;
    if (!a || a.runningSince === null) return;
    const s = touch(a, Date.now());
    set({ active: s });
    void saveActiveWorkout(s);
  },

  clear: () => {
    set({ active: null });
    void clearActiveWorkout();
    void clearWorkoutNotifications();
  },
}));
