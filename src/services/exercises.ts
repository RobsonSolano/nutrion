import { supabase } from './supabase';
import type { Exercise, ExerciseGroup, Modality } from '@/types/database';

export async function listExerciseGroups(): Promise<ExerciseGroup[]> {
  const { data, error } = await supabase
    .from('exercise_groups')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listExercisesByGroup(
  groupId: string,
  modality: Modality,
): Promise<Exercise[]> {
  // Modalidade 'generico' (alongamentos, mobilidade, foam roll) sempre
  // acompanha a modalidade selecionada — útil pra preparar/finalizar
  // treinos de musculação, calistenia, crossfit ou corrida sem
  // precisar mudar a modalidade da rotina.
  const modalities =
    modality === 'generico' ? ['generico'] : [modality, 'generico'];

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('group_id', groupId)
    .in('modality', modalities)
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
