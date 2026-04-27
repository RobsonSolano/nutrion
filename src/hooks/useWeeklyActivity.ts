import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';
import { queryKeys, todayKey } from '@/lib/queryKeys';

export type DayActivity = {
  day: string; // YYYY-MM-DD
  label: string; // S / T / Q ...
  dayNumber: number; // 1-31
  isToday: boolean;
  isFuture: boolean;
  hasFood: boolean;
  calories: number;
  hitCalorieGoal: boolean;
  hasWorkout: boolean;
  hasWater: boolean;
  waterMl: number;
};

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // Dom a Sáb

function buildLastWeekDays(todayIso: string): string[] {
  const anchor = new Date(`${todayIso}T00:00:00`);
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

export function useWeeklyActivity(calorieGoal: number | null | undefined) {
  const { user } = useAuth();
  const userId = user?.id;
  const anchor = todayKey();

  return useQuery({
    queryKey: userId
      ? queryKeys.weeklyActivity(userId, anchor)
      : ['weekly-activity', 'none'],
    queryFn: async (): Promise<DayActivity[]> => {
      const days = buildLastWeekDays(anchor);
      const from = `${days[0]}T00:00:00`;
      const toDay = days[days.length - 1];
      const to = `${toDay}T23:59:59`;

      const [foodRes, workoutRes, sessionsRes, waterRes] = await Promise.all([
        supabase
          .from('food_logs')
          .select('calories, created_at')
          .eq('user_id', userId!)
          .gte('created_at', from)
          .lte('created_at', to),
        supabase
          .from('workout_logs')
          .select('created_at')
          .eq('user_id', userId!)
          .gte('created_at', from)
          .lte('created_at', to),
        supabase
          .from('workout_sessions')
          .select('day')
          .eq('user_id', userId!)
          .gte('day', days[0])
          .lte('day', toDay),
        supabase
          .from('water_logs')
          .select('day, volume_ml')
          .eq('user_id', userId!)
          .gte('day', days[0])
          .lte('day', toDay),
      ]);

      const foodByDay = new Map<string, number>();
      (foodRes.data ?? []).forEach((row) => {
        const d = row.created_at.slice(0, 10);
        foodByDay.set(d, (foodByDay.get(d) ?? 0) + (row.calories ?? 0));
      });

      const workoutDays = new Set<string>();
      (workoutRes.data ?? []).forEach((row) => {
        workoutDays.add(row.created_at.slice(0, 10));
      });
      (sessionsRes.data ?? []).forEach((row) => {
        workoutDays.add(row.day);
      });

      const waterByDay = new Map<string, number>();
      (waterRes.data ?? []).forEach((row) => {
        waterByDay.set(row.day, row.volume_ml ?? 0);
      });

      const goal = calorieGoal ?? 2500;

      return days.map((d) => {
        const dateObj = new Date(`${d}T00:00:00`);
        const weekday = dateObj.getDay();
        const calories = foodByDay.get(d) ?? 0;
        const hasFood = calories > 0;
        const waterMl = waterByDay.get(d) ?? 0;
        return {
          day: d,
          label: DAY_LABELS[weekday] ?? '?',
          dayNumber: dateObj.getDate(),
          isToday: d === anchor,
          isFuture: d > anchor,
          hasFood,
          calories,
          hitCalorieGoal: hasFood && calories >= goal * 0.9, // tolerância de 10%
          hasWorkout: workoutDays.has(d),
          hasWater: waterMl > 0,
          waterMl,
        };
      });
    },
    enabled: !!userId,
  });
}
