import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRoutine,
  deleteRoutine,
  deleteSession,
  fetchRoutineDetail,
  insertSession,
  listRoutines,
  listTodaySessions,
  reorderRoutines,
  replaceRoutineExercises,
  updateRoutine,
} from '@/services/routines';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import { useAuth } from './useAuth';
import type {
  Modality,
  RoutineExerciseInsert,
  WorkoutRoutine,
} from '@/types/database';
import type { StudentDetail } from '@/services/students';

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
      modality: Modality;
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
        Pick<
          WorkoutRoutine,
          'name' | 'group_id' | 'modality' | 'description' | 'is_archived'
        >
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

// Reordena rotinas via drag-and-drop. Usa optimistic update tanto na
// query `routines(userId)` (vista do dono) quanto em `student_detail`
// (vista do coach), porque a tela do coach é a única que dispara hoje.
export function useReorderRoutines(targetUserId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!targetUserId) throw new Error('targetUserId ausente');
      await reorderRoutines(targetUserId, orderedIds);
    },
    onMutate: async (orderedIds) => {
      if (!targetUserId) return;
      const routinesKey = queryKeys.routines(targetUserId);
      const studentDetailKey = ['student_detail', targetUserId] as const;

      await Promise.all([
        qc.cancelQueries({ queryKey: routinesKey }),
        qc.cancelQueries({ queryKey: studentDetailKey }),
      ]);

      const prevRoutines = qc.getQueryData(routinesKey);
      const prevStudentDetail =
        qc.getQueryData<StudentDetail>(studentDetailKey);

      // Reorder helper: cria array novo na ordem dos IDs e atualiza
      // sort_order pra refletir a nova posição (1-based, igual à RPC).
      const reorder = <T extends { id: string; sort_order: number }>(
        items: T[],
      ): T[] => {
        const byId = new Map(items.map((it) => [it.id, it]));
        return orderedIds
          .map((id, i) => {
            const it = byId.get(id);
            return it ? { ...it, sort_order: i + 1 } : null;
          })
          .filter((x): x is T => x !== null);
      };

      if (Array.isArray(prevRoutines)) {
        qc.setQueryData(routinesKey, reorder(prevRoutines));
      }
      if (prevStudentDetail) {
        qc.setQueryData(studentDetailKey, {
          ...prevStudentDetail,
          routines: reorder(prevStudentDetail.routines),
        });
      }

      return { prevRoutines, prevStudentDetail };
    },
    onError: (_err, _vars, ctx) => {
      if (!targetUserId || !ctx) return;
      if (ctx.prevRoutines !== undefined) {
        qc.setQueryData(queryKeys.routines(targetUserId), ctx.prevRoutines);
      }
      if (ctx.prevStudentDetail !== undefined) {
        qc.setQueryData(
          ['student_detail', targetUserId],
          ctx.prevStudentDetail,
        );
      }
    },
    onSettled: () => {
      if (!targetUserId) return;
      void qc.invalidateQueries({
        queryKey: queryKeys.routines(targetUserId),
      });
      void qc.invalidateQueries({
        queryKey: ['student_detail', targetUserId],
      });
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
