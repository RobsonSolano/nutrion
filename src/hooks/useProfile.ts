import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProfile, upsertProfile } from '@/services/profile';
import { useAuth } from './useAuth';
import { queryKeys } from '@/lib/queryKeys';
import type { ProfileUpdate } from '@/types/database';

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: userId ? queryKeys.profile(userId) : ['profile', 'none'],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      if (!userId) throw new Error('Sessão expirada.');
      return upsertProfile(userId, patch);
    },
    onSuccess: (updated) => {
      if (!userId) return;
      qc.setQueryData(queryKeys.profile(userId), updated);
    },
  });
}
