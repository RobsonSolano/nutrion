import { useQuery } from '@tanstack/react-query';
import {
  countTodayAiUsage,
  DAILY_ONBOARDING_LIMIT,
  DAILY_SANITY_CHECK_LIMIT,
  type AiFeature,
} from '@/services/aiUsage';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

function useDailyUsage(feature: AiFeature) {
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();
  return useQuery({
    queryKey: userId
      ? queryKeys.aiUsage(userId, feature, day)
      : ['ai-usage', 'none'],
    queryFn: () => countTodayAiUsage(userId!, feature),
    enabled: !!userId,
    staleTime: 5_000,
  });
}

export function useDailySanityUsage() {
  const q = useDailyUsage('sanity_check');
  const used = q.data ?? 0;
  return {
    ...q,
    used,
    limit: DAILY_SANITY_CHECK_LIMIT,
    remaining: Math.max(0, DAILY_SANITY_CHECK_LIMIT - used),
    limitReached: used >= DAILY_SANITY_CHECK_LIMIT,
  };
}

export function useDailyOnboardingUsage() {
  const q = useDailyUsage('onboarding_plan');
  const used = q.data ?? 0;
  return {
    ...q,
    used,
    limit: DAILY_ONBOARDING_LIMIT,
    remaining: Math.max(0, DAILY_ONBOARDING_LIMIT - used),
    limitReached: used >= DAILY_ONBOARDING_LIMIT,
  };
}
