import { supabase } from './supabase';
import type {
  GoalType,
  Profile,
  RoutineExerciseInsert,
  Sex,
  WeeklyFrequency,
  WorkoutRoutine,
} from '@/types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FN_URL = `${SUPABASE_URL}/functions/v1/onboarding-plan`;

export type OnboardingInput = {
  full_name: string | null;
  sex: Sex | null;
  birth_year: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal_type: GoalType | null;
  goal_weight_kg: number | null;
  goal_target_date: string | null;
  practices_sport: boolean | null;
  sports: string[] | null;
  weekly_frequency: WeeklyFrequency | null;
  water_goal_ml: number | null;
  allergies: string | null;
  physical_limitations: string | null;
  bio: string | null;
};

export type PlanRoutineExercise = {
  exercise_id: string;
  exercise_name: string;
  equipment?: string | null;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_min_kg?: number | null;
  weight_max_kg?: number | null;
  duration_min?: number | null;
  notes?: string | null;
};

export type PlanRoutine = {
  name: string;
  group_slug: string | null;
  description?: string | null;
  exercises: PlanRoutineExercise[];
};

export type OnboardingPlan = {
  calorie_goal: number;
  protein_goal_g: number;
  water_goal_ml: number;
  routines: PlanRoutine[];
  rationale: string;
};

/**
 * Chama a edge function onboarding-plan via fetch direto pra capturar detalhes
 * de erro (429, 502, etc.) — mesma estratégia do chat-ai.
 */
export async function generateOnboardingPlan(
  input: OnboardingInput,
): Promise<OnboardingPlan> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada. Faça login de novo.');
  }

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail ?? parsed?.error ?? text;
    } catch {
      // mantém texto cru
    }
    if (res.status === 429) {
      throw new Error(String(detail));
    }
    throw new Error(`${res.status} · ${detail}`);
  }

  const data = (await res.json()) as { plan?: OnboardingPlan };
  if (!data?.plan) {
    throw new Error('Resposta inválida da função onboarding-plan');
  }
  return data.plan;
}

export async function markOnboardingSkipped(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarding_skipped_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

/**
 * Salva o resultado do onboarding em batch:
 *  1. Atualiza o profile com inputs + metas da IA (onboarding_completed_at = now)
 *  2. Cria as rotinas sugeridas (+ exercícios prescritos)
 */
export async function saveOnboardingResult(params: {
  userId: string;
  input: OnboardingInput;
  plan: OnboardingPlan;
}): Promise<{ profile: Profile; routines: WorkoutRoutine[] }> {
  const { userId, input, plan } = params;

  const now = new Date().toISOString();

  // 1) Profile (metas + dados pessoais do onboarding)
  const profilePatch: Partial<Profile> = {
    full_name: input.full_name,
    sex: input.sex,
    birth_year: input.birth_year,
    weight_kg: input.weight_kg,
    height_cm: input.height_cm,
    goal_type: input.goal_type,
    goal_weight_kg: input.goal_weight_kg,
    goal_target_date: input.goal_target_date,
    practices_sport: input.practices_sport,
    sports: input.sports,
    weekly_frequency: input.weekly_frequency,
    allergies: input.allergies,
    physical_limitations: input.physical_limitations,
    bio: input.bio,
    daily_calorie_goal: plan.calorie_goal,
    protein_goal_g: plan.protein_goal_g,
    water_goal_ml: plan.water_goal_ml,
    onboarding_completed_at: now,
    onboarding_skipped_at: null,
  };

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', userId)
    .select('*')
    .single();
  if (pErr) throw pErr;

  // 2) Rotinas — precisa resolver group_slug → group_id
  const slugs = Array.from(
    new Set(plan.routines.map((r) => r.group_slug).filter((s): s is string => !!s)),
  );
  const groupIdBySlug = new Map<string, string>();
  if (slugs.length > 0) {
    const { data: groups, error: gErr } = await supabase
      .from('exercise_groups')
      .select('id, slug')
      .in('slug', slugs);
    if (gErr) throw gErr;
    for (const g of groups ?? []) {
      groupIdBySlug.set(g.slug, g.id);
    }
  }

  const createdRoutines = await Promise.all(
    plan.routines.map(async (r) => {
      const { data: routine, error: rErr } = await supabase
        .from('workout_routines')
        .insert({
          user_id: userId,
          name: r.name,
          group_id: r.group_slug
            ? groupIdBySlug.get(r.group_slug) ?? null
            : null,
          description: r.description ?? null,
        })
        .select('*')
        .single();
      if (rErr) throw rErr;

      if (r.exercises.length > 0) {
        const rows: (RoutineExerciseInsert & { routine_id: string })[] =
          r.exercises.map((ex, i) => ({
            routine_id: routine.id,
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            equipment: ex.equipment ?? null,
            sort_order: i,
            sets: ex.sets,
            reps_min: ex.reps_min,
            reps_max: ex.reps_max,
            weight_min_kg: ex.weight_min_kg ?? null,
            weight_max_kg: ex.weight_max_kg ?? null,
            duration_min: ex.duration_min ?? null,
            notes: ex.notes ?? null,
          }));
        const { error: exErr } = await supabase
          .from('workout_routine_exercises')
          .insert(rows);
        if (exErr) throw exErr;
      }

      return routine as WorkoutRoutine;
    }),
  );

  return { profile: profile as Profile, routines: createdRoutines };
}

/**
 * Marca o perfil para refazer o onboarding — zera `onboarding_completed_at`
 * para o gate de redirect disparar novamente.
 */
export async function resetOnboarding(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: null,
      onboarding_skipped_at: null,
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
