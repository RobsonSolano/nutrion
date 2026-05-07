import { supabase } from './supabase';
import type {
  ExerciseGroup,
  Modality,
  TemplateExercise,
  TemplateExerciseInsert,
  TemplateListItem,
  TemplateWithExercises,
  WorkoutTemplate,
} from '@/types/database';

export type ListTemplatesOptions = {
  archived?: boolean;
};

export async function listTemplates(
  coachId: string,
  options: ListTemplatesOptions = {},
): Promise<TemplateListItem[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*, exercises:workout_template_exercises(count)')
    .eq('coach_id', coachId)
    .eq('is_archived', options.archived ?? false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => {
    const { exercises, ...rest } = r as WorkoutTemplate & {
      exercises: { count: number }[] | null;
    };
    return {
      ...rest,
      exercises_count: exercises?.[0]?.count ?? 0,
    };
  });
}

export async function fetchTemplateDetail(
  templateId: string,
): Promise<TemplateWithExercises | null> {
  const { data: template, error: tErr } = await supabase
    .from('workout_templates')
    .select('*, group:exercise_groups(*)')
    .eq('id', templateId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!template) return null;

  const { data: exercises, error: exErr } = await supabase
    .from('workout_template_exercises')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });
  if (exErr) throw exErr;

  return {
    ...(template as WorkoutTemplate & { group: ExerciseGroup | null }),
    exercises: (exercises ?? []) as TemplateExercise[],
  };
}

export async function createTemplate(params: {
  coachId: string;
  name: string;
  modality: Modality;
  groupId: string | null;
  description: string | null;
  exercises: TemplateExerciseInsert[];
}): Promise<WorkoutTemplate> {
  const { data: template, error } = await supabase
    .from('workout_templates')
    .insert({
      coach_id: params.coachId,
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
      template_id: template.id,
      sort_order: e.sort_order ?? i,
    }));
    const { error: exErr } = await supabase
      .from('workout_template_exercises')
      .insert(rows);
    if (exErr) throw exErr;
  }

  return template;
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<
    Pick<
      WorkoutTemplate,
      'name' | 'group_id' | 'modality' | 'description' | 'is_archived'
    >
  >,
): Promise<WorkoutTemplate> {
  const { data, error } = await supabase
    .from('workout_templates')
    .update(patch)
    .eq('id', templateId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function replaceTemplateExercises(
  templateId: string,
  exercises: TemplateExerciseInsert[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('workout_template_exercises')
    .delete()
    .eq('template_id', templateId);
  if (delErr) throw delErr;

  if (exercises.length === 0) return;

  const rows = exercises.map((e, i) => ({
    ...e,
    template_id: templateId,
    sort_order: e.sort_order ?? i,
  }));
  const { error: insErr } = await supabase
    .from('workout_template_exercises')
    .insert(rows);
  if (insErr) throw insErr;
}

export async function archiveTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_templates')
    .update({ is_archived: true })
    .eq('id', templateId);
  if (error) throw error;
}

export async function unarchiveTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_templates')
    .update({ is_archived: false })
    .eq('id', templateId);
  if (error) throw error;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId);
  if (error) throw error;
}

export type ApplyTemplateResult = {
  created_routine_ids: string[];
};

export async function applyTemplates(params: {
  studentId: string;
  templateIds: string[];
}): Promise<ApplyTemplateResult> {
  const { data, error } = await supabase.functions.invoke<ApplyTemplateResult>(
    'coach-apply-template',
    {
      body: {
        student_id: params.studentId,
        template_ids: params.templateIds,
      },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('Resposta vazia da função coach-apply-template.');
  return data;
}
