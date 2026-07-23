import { useQuery } from '@tanstack/react-query';
import { checkMySuspension } from '@/services/suspension';
import { useAuth } from './useAuth';

/**
 * Gate de suspensão do aluno. `enabled` deve ser true só quando role='aluno'.
 * A query chama check_and_sync_my_suspension (auto-cura via o coach). Enquanto
 * resolve, `isChecking` é true — o (tabs)/_layout espera antes de rotear.
 */
export function useStudentSuspension(enabled: boolean): {
  suspended: boolean;
  isChecking: boolean;
} {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ['student-suspension', userId ?? 'none'],
    queryFn: checkMySuspension,
    enabled: enabled && !!userId,
    staleTime: 60_000,
  });

  return {
    suspended: q.data === true,
    isChecking: enabled && !!userId && q.isLoading,
  };
}
