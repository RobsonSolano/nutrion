import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeAvatar, uploadAvatar } from '@/services/avatar';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export function useUploadAvatar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (localUri: string) => uploadAvatar(localUri),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      }
    },
  });
}

export function useRemoveAvatar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      }
    },
  });
}
