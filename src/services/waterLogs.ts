import { supabase } from './supabase';
import type { WaterLog } from '@/types/database';

function dayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchTodayWater(userId: string): Promise<WaterLog | null> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('day', dayKey())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertWater(
  userId: string,
  volumeMl: number,
): Promise<WaterLog> {
  const { data, error } = await supabase
    .from('water_logs')
    .upsert(
      { user_id: userId, day: dayKey(), volume_ml: volumeMl },
      { onConflict: 'user_id,day' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchWaterRange(
  userId: string,
  fromDay: string,
  toDay: string,
): Promise<WaterLog[]> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('day', fromDay)
    .lte('day', toDay)
    .order('day', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
