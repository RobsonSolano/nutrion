import { supabase } from './supabase';
import type { WorkoutLog, WorkoutLogInsert } from '@/types/database';

export async function listRecentWorkouts(
  userId: string,
  limit = 20,
): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function fetchLastWorkout(
  userId: string,
): Promise<WorkoutLog | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function insertWorkoutLog(
  userId: string,
  payload: WorkoutLogInsert,
): Promise<WorkoutLog> {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({ user_id: userId, ...payload })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
