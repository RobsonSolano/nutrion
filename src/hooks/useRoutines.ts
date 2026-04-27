import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRoutine,
  deleteRoutine,
  deleteSession,
  fetchRoutineDetail,
  insertSession,
  listRoutines,
  listTodaySessions,
  replaceRoutineExercises,
  updateRoutine,
} from '@/services/routines';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import { useAuth } from './useAuth';
import type { RoutineExerciseInsert, WorkoutRoutine } from '@/types/database';

export function useRoutines() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? queryKeys.routines(userId) : ['routines', 'none'],
    queryFn: () => listRoutines(userId!),
    enabled: !!userId,
  });
}

export function useRoutineDetail(routineId: string | null | undefined) {
  return useQuery({
    queryKey: routineId
      ? queryKeys.routineDetail(routineId)
      : ['routine-detail', 'none'],
    queryFn: () => fetchRoutineDetail(routineId!),
    enabled: !!routineId,
  });
}

export function useCreateRoutine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      groupId: string | null;
      description: string | null;
      exercises: RoutineExerciseInsert[];
    }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return createRoutine({ userId: user.id, ...params });
    },
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({ queryKey: queryKeys.routines(user.id) });
    },
  });
}

export function useUpdateRoutine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      patch: Partial<
        Pick<WorkoutRoutine, 'name' | 'group_id' | 'description' | 'is_archived'>
      >;
      exercises?: RoutineExerciseInsert[];
    }) => {
      const updated = await updateRoutine(params.id, params.patch);
      if (params.exercises) {
        await replaceRoutineExercises(params.id, params.exercises);
      }
      return updated;
    },
    onSuccess: (_, vars) => {
      if (!user?.id) return;
      void qc.invalidateQueries({ queryKey: queryKeys.routines(user.id) });
      void qc.invalidateQueries({
        queryKey: queryKeys.routineDetail(vars.id),
      });
    },
  });
}

export function useDeleteRoutine() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRoutine(id),
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({ queryKey: queryKeys.routines(user.id) });
    },
  });
}

export function useTodaySessions() {
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();
  return useQuery({
    queryKey: userId
      ? queryKeys.todaySessions(userId, day)
      : ['today-sessions', 'none'],
    queryFn: () => listTodaySessions(userId!),
    enabled: !!userId,
  });
}

export function useCreateSession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      routineId: string | null;
      routineName: string;
      durationMin?: number | null;
      notes?: string | null;
    }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return insertSession(user.id, payload);
    },
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({
        queryKey: queryKeys.todaySessions(user.id, todayKey()),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.weeklyActivity(user.id, todayKey()),
      });
    },
  });
}

export function useDeleteSession() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      if (!user?.id) return;
      void qc.invalidateQueries({
        queryKey: queryKeys.todaySessions(user.id, todayKey()),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.weeklyActivity(user.id, todayKey()),
      });
    },
  });
}
