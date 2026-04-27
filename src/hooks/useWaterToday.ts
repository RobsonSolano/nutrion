import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTodayWater, upsertWater } from '@/services/waterLogs';
import { useAuth } from './useAuth';
import { queryKeys, todayKey } from '@/lib/queryKeys';

export function useWaterToday() {
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();

  return useQuery({
    queryKey: userId ? queryKeys.waterToday(userId, day) : ['water-today', 'none'],
    queryFn: () => fetchTodayWater(userId!),
    enabled: !!userId,
  });
}

export function useUpsertWater() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (volumeMl: number) => {
      if (!userId) throw new Error('Sessão expirada.');
      return upsertWater(userId, volumeMl);
    },
    onSuccess: () => {
      if (!userId) return;
      void qc.invalidateQueries({
        queryKey: queryKeys.waterToday(userId, todayKey()),
      });
    },
  });
}
