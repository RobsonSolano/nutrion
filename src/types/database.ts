// Types das tabelas Supabase (sincronizado com supabase/migrations/20260419220000_init.sql)

export type Sex = 'm' | 'f' | 'o';
export type GoalType =
  | 'lose_fat'
  | 'maintain'
  | 'gain_muscle'
  | 'reduce_body_fat';
export type WeeklyFrequency = '1-2' | '2-3' | '3-4' | '4-5' | '5-6' | '6-7';

export type ProfileRole = 'comum' | 'aluno' | 'professor';

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal_weight_kg: number | null;
  daily_calorie_goal: number | null;
  protein_goal_g: number | null;
  water_goal_ml: number | null;
  sex: Sex | null;
  birth_year: number | null;
  goal_type: GoalType | null;
  goal_target_date: string | null;
  bio: string | null;
  allergies: string | null;
  physical_limitations: string | null;
  practices_sport: boolean | null;
  sports: string[] | null;
  weekly_frequency: WeeklyFrequency | null;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  user_number: number | null;
  is_early_adopter: boolean | null;
  role: ProfileRole;
  coach_id: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
};

export type Coach = {
  id: string;
  bio: string | null;
  cref: string | null;
  max_students: number;
  show_contact_to_students: boolean;
  contact_phone: string | null;
  created_at: string;
};

export type CoachContact = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  cref: string | null;
  show_contact_to_students: boolean;
  contact_phone: string | null;
};

export type StudentRequestStatus =
  | 'open'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type StudentRequest = {
  id: string;
  student_id: string;
  coach_id: string;
  message: string;
  status: StudentRequestStatus;
  coach_response: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<
  Omit<Profile, 'id' | 'created_at' | 'updated_at'>
>;

export type WorkoutLog = {
  id: string;
  user_id: string;
  exercise_name: string;
  exercise_id: string | null;
  group_id: string | null;
  sets: number | null;
  reps: number | null;
  reps_min: number | null;
  reps_max: number | null;
  weight_kg: number | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  intensity_rpe: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutLogInsert = Omit<WorkoutLog, 'id' | 'user_id' | 'created_at'>;

export type ExerciseGroup = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type Modality =
  | 'musculacao'
  | 'calistenia'
  | 'crossfit'
  | 'corrida'
  | 'generico';

export const MODALITY_LABELS: Record<Modality, string> = {
  musculacao: 'Musculação',
  calistenia: 'Calistenia',
  crossfit: 'CrossFit',
  corrida: 'Corrida',
  generico: 'Genérico',
};

export type Exercise = {
  id: string;
  group_id: string;
  name: string;
  equipment: string | null;
  is_compound: boolean | null;
  image_urls: string[] | null;
  modality: Modality;
};

export type WaterLog = {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD
  volume_ml: number;
  updated_at: string;
};

export type WorkoutRoutine = {
  id: string;
  user_id: string;
  name: string;
  group_id: string | null;
  modality: Modality;
  description: string | null;
  is_archived: boolean;
  created_by_coach: string | null;
  source_template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplate = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  group_id: string | null;
  modality: Modality;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_id: string | null;
  exercise_name: string;
  equipment: string | null;
  sort_order: number;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  duration_min: number | null;
  notes: string | null;
};

export type TemplateExerciseInsert = Omit<TemplateExercise, 'id' | 'template_id'>;

export type TemplateWithExercises = WorkoutTemplate & {
  exercises: TemplateExercise[];
  group: ExerciseGroup | null;
};

export type TemplateListItem = WorkoutTemplate & {
  exercises_count: number;
};

/** Versão do listItem com contagem de exercícios (via PostgREST aggregate). */
export type WorkoutRoutineListItem = WorkoutRoutine & {
  exercises_count: number;
};

export type RoutineExercise = {
  id: string;
  routine_id: string;
  exercise_id: string | null;
  exercise_name: string;
  equipment: string | null;
  sort_order: number;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  weight_min_kg: number | null;
  weight_max_kg: number | null;
  duration_min: number | null;
  notes: string | null;
};

export type RoutineExerciseInsert = Omit<RoutineExercise, 'id' | 'routine_id'> & {
  routine_id?: string;
};

export type RoutineWithExercises = WorkoutRoutine & {
  exercises: RoutineExercise[];
  group: ExerciseGroup | null;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string;
  day: string;
  duration_min: number | null;
  notes: string | null;
  created_at: string;
};

export type FoodLog = {
  id: string;
  user_id: string;
  meal_name: string | null;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fats_g: number | null;
  photo_path: string | null;
  ai_feedback: string | null;
  created_at: string;
};

export type FoodLogInsert = Omit<FoodLog, 'id' | 'user_id' | 'created_at'>;

export type ChatAiRequest = {
  message: string;
  imageBase64?: string;
  imageMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  scaleWeightG?: number;
  mode?: 'chat' | 'sanity_check';
};

export type ChatAiResponse = {
  text: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  } | null;
};

export type ContractType = 'mensal' | 'treino' | 'semanal' | 'parceria';
export type ContractStatus = 'active' | 'ended' | 'cancelled';

export type StudentContract = {
  id: string;
  student_id: string;
  coach_id: string;
  type: ContractType;
  start_date: string;
  end_date: string | null;
  value_cents: number | null;
  payment_day: number | null;
  status: ContractStatus;
  effective_status: ContractStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractInput = Omit<
  StudentContract,
  'id' | 'coach_id' | 'effective_status' | 'created_at' | 'updated_at' | 'status'
>;

export type ContractPatch = Partial<
  Pick<
    StudentContract,
    'type' | 'start_date' | 'end_date' | 'value_cents' | 'payment_day' | 'notes'
  >
>;

