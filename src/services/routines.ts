import { supabase } from './supabase';
import type {
  Modality,
  RoutineExercise,
  RoutineExerciseInsert,
  RoutineWithExercises,
  WorkoutRoutine,
  WorkoutRoutineListItem,
  WorkoutSession,
} from '@/types/database';

export async function listRoutines(
  userId: string,
): Promise<WorkoutRoutineListItem[]> {
  // PostgREST aggregate: traz o count de exercícios numa única round-trip.
  const { data, error } = await supabase
    .from('workout_routines')
    .select('*, exercises:workout_routine_exercises(count)')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => {
    const { exercises, ...rest } = r as WorkoutRoutine & {
      exercises: { count: number }[] | null;
    };
    return {
      ...rest,
      exercises_count: exercises?.[0]?.count ?? 0,
    };
  });
}

export async function fetchRoutineDetail(
  routineId: string,
): Promise<RoutineWithExercises | null> {
  const { data: routine, error: routineErr } = await supabase
    .from('workout_routines')
    .select('*, group:exercise_groups(*)')
    .eq('id', routineId)
    .maybeSingle();
  if (routineErr) throw routineErr;
  if (!routine) return null;

  const { data: exercises, error: exErr } = await supabase
    .from('workout_routine_exercises')
    .select('*')
    .eq('routine_id', routineId)
    .order('sort_order', { ascending: true });
  if (exErr) throw exErr;

  return {
    ...(routine as WorkoutRoutine & { group: RoutineWithExercises['group'] }),
    exercises: (exercises ?? []) as RoutineExercise[],
  };
}

export async function createRoutine(params: {
  userId: string;
  name: string;
  modality: Modality;
  groupId: string | null;
  description: string | null;
  exercises: RoutineExerciseInsert[];
}): Promise<WorkoutRoutine> {
  const { data: routine, error } = await supabase
    .from('workout_routines')
    .insert({
      user_id: params.userId,
      name: params.name,
      modality: params.modality,
      group_id: params.groupId,
      description: params.description,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (params.exercises.length > 0) {
    const rows = params.exercises.map((e, i) => ({
      ...e,
      routine_id: routine.id,
      sort_order: e.sort_order ?? i,
    }));
    const { error: exErr } = await supabase
      .from('workout_routine_exercises')
      .insert(rows);
    if (exErr) throw exErr;
  }

  return routine;
}

export async function updateRoutine(
  routineId: string,
  patch: Partial<
    Pick<
      WorkoutRoutine,
      'name' | 'group_id' | 'modality' | 'description' | 'is_archived'
    >
  >,
): Promise<WorkoutRoutine> {
  const { data, error } = await supabase
    .from('workout_routines')
    .update(patch)
    .eq('id', routineId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function replaceRoutineExercises(
  routineId: string,
  exercises: RoutineExerciseInsert[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('workout_routine_exercises')
    .delete()
    .eq('routine_id', routineId);
  if (delErr) throw delErr;

  if (exercises.length === 0) return;

  const rows = exercises.map((e, i) => ({
    ...e,
    routine_id: routineId,
    sort_order: e.sort_order ?? i,
  }));
  const { error: insErr } = await supabase
    .from('workout_routine_exercises')
    .insert(rows);
  if (insErr) throw insErr;
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_routines')
    .delete()
    .eq('id', routineId);
  if (error) throw error;
}

// -------- Sessions (execuções diárias) --------

function dayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function listTodaySessions(
  userId: string,
): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('day', dayKey())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertSession(
  userId: string,
  payload: {
    routineId: string | null;
    routineName: string;
    durationMin?: number | null;
    notes?: string | null;
  },
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: userId,
      routine_id: payload.routineId,
      routine_name: payload.routineName,
      day: dayKey(),
      duration_min: payload.durationMin ?? null,
      notes: payload.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}
