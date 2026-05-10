import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAnamnese, upsertAnamnese } from '@/services/anamnese';
import { queryKeys } from '@/lib/queryKeys';
import type { StudentAnamnesePatch } from '@/types/database';

export function useAnamnese(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.anamnese(userId ?? 'none'),
    queryFn: () => {
      if (!userId) throw new Error('user_id ausente');
      return getAnamnese(userId);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useUpsertAnamnese(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StudentAnamnesePatch) => {
      if (!userId) throw new Error('user_id ausente');
      return upsertAnamnese(userId, patch);
    },
    onSuccess: () => {
      if (!userId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.anamnese(userId) });
    },
  });
}
