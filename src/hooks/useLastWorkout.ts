import { useQuery } from '@tanstack/react-query';
import { fetchLastWorkout } from '@/services/workoutLogs';
import { useAuth } from './useAuth';
import { queryKeys } from '@/lib/queryKeys';

export function useLastWorkout() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: userId ? queryKeys.lastWorkout(userId) : ['last-workout', 'none'],
    queryFn: () => fetchLastWorkout(userId!),
    enabled: !!userId,
  });
}
