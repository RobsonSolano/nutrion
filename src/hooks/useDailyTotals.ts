import { useQuery } from '@tanstack/react-query';
import { listTodayFoodLogs } from '@/services/foodLogs';
import { useAuth } from './useAuth';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import type { FoodLog } from '@/types/database';

type Totals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  mealsCount: number;
};

function sum(logs: FoodLog[]): Totals {
  return logs.reduce<Totals>(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein_g: acc.protein_g + (l.protein_g ?? 0),
      carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
      fats_g: acc.fats_g + (l.fats_g ?? 0),
      mealsCount: acc.mealsCount + 1,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0, mealsCount: 0 },
  );
}

export function useDailyTotals() {
  const { user } = useAuth();
  const userId = user?.id;
  const day = todayKey();

  return useQuery({
    queryKey: userId
      ? queryKeys.dailyTotals(userId, day)
      : ['daily-totals', 'none'],
    queryFn: async () => {
      const logs = await listTodayFoodLogs(userId!);
      return { totals: sum(logs), logs };
    },
    enabled: !!userId,
  });
}
