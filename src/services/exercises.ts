import { supabase } from './supabase';
import type { Exercise, ExerciseGroup } from '@/types/database';

export async function listExerciseGroups(): Promise<ExerciseGroup[]> {
  const { data, error } = await supabase
    .from('exercise_groups')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listExercisesByGroup(groupId: string): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('group_id', groupId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
