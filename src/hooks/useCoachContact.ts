import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCoachContact,
  updateCoachSettings,
  type CoachSettingsPatch,
} from '@/services/coach';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export function useCoachContact(coachId: string | null | undefined) {
  return useQuery({
    queryKey: coachId
      ? queryKeys.coachContact(coachId)
      : ['coach-contact', 'none'],
    queryFn: () => getCoachContact(coachId!),
    enabled: !!coachId,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCoachSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CoachSettingsPatch) => updateCoachSettings(patch),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({
          queryKey: queryKeys.coachContact(user.id),
        });
        void qc.invalidateQueries({
          queryKey: ['my-coach', user.id],
        });
      }
    },
  });
}
