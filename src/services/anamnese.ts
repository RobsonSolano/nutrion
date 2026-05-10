import { supabase } from './supabase';
import type {
  StudentAnamnese,
  StudentAnamnesePatch,
} from '@/types/database';

export async function getAnamnese(
  userId: string,
): Promise<StudentAnamnese | null> {
  const { data, error } = await supabase
    .from('student_anamneses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as StudentAnamnese | null;
}

export async function upsertAnamnese(
  userId: string,
  patch: StudentAnamnesePatch,
): Promise<StudentAnamnese> {
  const row = {
    user_id: userId,
    ...patch,
    filled_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('student_anamneses')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentAnamnese;
}
