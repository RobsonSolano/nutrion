import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertFoodLog } from '@/services/foodLogs';
import { insertWorkoutLog } from '@/services/workoutLogs';
import { useAuth } from './useAuth';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import type { FoodLogInsert, WorkoutLogInsert } from '@/types/database';

export function useCreateFoodLog() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FoodLogInsert) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return insertFoodLog(user.id, payload);
    },
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({
        queryKey: queryKeys.dailyTotals(user.id, todayKey()),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.todayFoodLogs(user.id, todayKey()),
      });
    },
  });
}

export function useCreateWorkoutLog() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WorkoutLogInsert) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return insertWorkoutLog(user.id, payload);
    },
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({ queryKey: queryKeys.lastWorkout(user.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.workoutHistory(user.id) });
    },
  });
}
