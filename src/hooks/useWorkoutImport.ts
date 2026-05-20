import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  importWorkoutFromAi,
  saveImportedWorkout,
  type SavedWorkout,
} from '@/services/workoutImport';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export function useImportWorkoutAi() {
  return useMutation({
    mutationFn: importWorkoutFromAi,
  });
}

export function useSaveImportedWorkout() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: {
      destination: 'aluno' | 'template';
      studentId?: string;
      workouts: SavedWorkout[];
    }) => saveImportedWorkout(params),
    onSuccess: (_data, vars) => {
      if (vars.destination === 'aluno' && vars.studentId) {
        void qc.invalidateQueries({
          queryKey: ['student-detail', vars.studentId],
        });
        void qc.invalidateQueries({
          queryKey: queryKeys.routines(vars.studentId),
        });
      } else if (vars.destination === 'template' && user?.id) {
        void qc.invalidateQueries({
          queryKey: queryKeys.templates(user.id, false),
        });
      }
    },
  });
}
