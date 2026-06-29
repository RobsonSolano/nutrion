import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveWorkout } from '@/types/workoutTimer';

const KEY = 'active_workout';

/**
 * Persistência do treino ativo em AsyncStorage. Sobrevive a lock e a kill do
 * app — é o que permite recuperar a sessão pendente. Padrão de
 * `src/lib/unreadRequests.ts` (best-effort, parse defensivo).
 */
export async function loadActiveWorkout(): Promise<ActiveWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.startedAt !== 'number' ||
      typeof parsed?.accumulatedMs !== 'number' ||
      typeof parsed?.lastSeenAt !== 'number' ||
      typeof parsed?.day !== 'string'
    ) {
      return null;
    }
    return parsed as ActiveWorkout;
  } catch {
    return null;
  }
}

export async function saveActiveWorkout(s: ActiveWorkout): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

export async function clearActiveWorkout(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
