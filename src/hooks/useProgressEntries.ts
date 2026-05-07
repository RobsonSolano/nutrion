import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProgressEntry,
  deleteProgressEntry,
  listProgressEntries,
  updateProgressEntry,
} from '@/services/progressEntries';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export function useProgressEntries(userId: string | null | undefined) {
  return useQuery({
    queryKey: userId
      ? queryKeys.progressEntries(userId)
      : ['progress-entries', 'none'],
    queryFn: () => listProgressEntries(userId!),
    enabled: !!userId,
  });
}

export function useCreateProgressEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createProgressEntry(content),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({
          queryKey: queryKeys.progressEntries(user.id),
        });
      }
    },
  });
}

export function useUpdateProgressEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; content: string }) =>
      updateProgressEntry(params.id, params.content),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({
          queryKey: queryKeys.progressEntries(user.id),
        });
      }
    },
  });
}

export function useDeleteProgressEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProgressEntry(id),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({
          queryKey: queryKeys.progressEntries(user.id),
        });
      }
    },
  });
}
