import { useQuery } from '@tanstack/react-query';
import { listRecentWorkouts } from '@/services/workoutLogs';
import { useAuth } from './useAuth';
import { queryKeys } from '@/lib/queryKeys';
import type { WorkoutLog } from '@/types/database';

export type ExerciseGroup = {
  exerciseName: string;
  logs: WorkoutLog[];
  lastLog: WorkoutLog;
  lastWeightKg: number | null;
  firstWeightKg: number | null;
  progressionDelta: number | null; // diferença peso atual vs. primeiro registro
  totalSessions: number;
  avgRpe: number | null;
};

function groupByExercise(logs: WorkoutLog[]): ExerciseGroup[] {
  const buckets = new Map<string, WorkoutLog[]>();

  for (const log of logs) {
    const key = log.exercise_name.trim().toLowerCase();
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(log);
    } else {
      buckets.set(key, [log]);
    }
  }

  const groups: ExerciseGroup[] = [];

  for (const bucket of buckets.values()) {
    // logs já vêm ordenados desc por created_at (mais recente primeiro)
    const lastLog = bucket[0];
    const firstLog = bucket[bucket.length - 1];
    const rpes = bucket
      .map((l) => l.intensity_rpe)
      .filter((v): v is number => v != null);

    groups.push({
      exerciseName: lastLog.exercise_name,
      logs: bucket,
      lastLog,
      lastWeightKg: lastLog.weight_kg ?? null,
      firstWeightKg: firstLog.weight_kg ?? null,
      progressionDelta:
        lastLog.weight_kg != null && firstLog.weight_kg != null
          ? lastLog.weight_kg - firstLog.weight_kg
          : null,
      totalSessions: bucket.length,
      avgRpe:
        rpes.length > 0
          ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
          : null,
    });
  }

  // ordena por data do último log desc (exercício mais recente primeiro)
  groups.sort(
    (a, b) =>
      new Date(b.lastLog.created_at).getTime() -
      new Date(a.lastLog.created_at).getTime(),
  );

  return groups;
}

export function useWorkoutHistory(limit = 100) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: userId
      ? queryKeys.workoutHistory(userId)
      : ['workout-history', 'none'],
    queryFn: async () => {
      const logs = await listRecentWorkouts(userId!, limit);
      return {
        logs,
        groups: groupByExercise(logs),
      };
    },
    enabled: !!userId,
  });
}
