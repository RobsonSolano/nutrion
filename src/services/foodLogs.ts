import { supabase } from './supabase';
import type { FoodLog, FoodLogInsert } from '@/types/database';

export async function listTodayFoodLogs(userId: string): Promise<FoodLog[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function insertFoodLog(
  userId: string,
  payload: FoodLogInsert,
): Promise<FoodLog> {
  const { data, error } = await supabase
    .from('food_logs')
    .insert({ user_id: userId, ...payload })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
