import { supabase } from './supabase';
import type { Modality } from '@/types/database';

export type ImportImage = {
  base64: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type ImportedExercise = {
  name: string;
  equipment: string | null;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  duration_min: number | null;
  notes: string | null;
  suggested_group_slug: string;
  matched_exercise_id: string | null;
  match_confidence: 'high' | 'medium' | 'low';
};

export type ImportedWorkout = {
  name: string;
  modality: Modality;
  group_slug: string | null;
  exercises: ImportedExercise[];
};

export type ImportResult = {
  workouts: ImportedWorkout[];
};

export async function importWorkoutFromAi(params: {
  images: ImportImage[];
  text: string;
  destination: 'aluno' | 'template';
  studentId?: string;
}): Promise<ImportResult> {
  const { data, error } = await supabase.functions.invoke<ImportResult>(
    'coach-import-workout-ai',
    {
      body: {
        images: params.images,
        text: params.text,
        destination: params.destination,
        student_id: params.studentId,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('Resposta vazia ao importar treino.');
  return data;
}

// ===== Save =====

export type SavedExerciseRef =
  | { kind: 'existing'; exercise_id: string }
  | {
      kind: 'new';
      name: string;
      group_slug: string;
      modality: Modality;
      equipment?: string | null;
    };

export type SavedExercise = {
  ref: SavedExerciseRef;
  exercise_name: string;
  equipment: string | null;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  duration_min: number | null;
  notes: string | null;
};

export type SavedWorkout = {
  name: string;
  modality: Modality;
  group_slug: string | null;
  description?: string | null;
  exercises: SavedExercise[];
};

export type SaveImportResult = {
  created_routine_ids: string[];
  created_template_ids: string[];
  created_exercises_count: number;
};

export async function saveImportedWorkout(params: {
  destination: 'aluno' | 'template';
  studentId?: string;
  workouts: SavedWorkout[];
}): Promise<SaveImportResult> {
  const { data, error } = await supabase.functions.invoke<SaveImportResult>(
    'coach-save-imported-workout',
    {
      body: {
        destination: params.destination,
        student_id: params.studentId,
        workouts: params.workouts,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('Resposta vazia ao salvar treino importado.');
  return data;
}
