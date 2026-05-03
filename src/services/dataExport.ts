import { supabase } from './supabase';

export type DataExport = {
  exported_at: string;
  user: {
    id: string;
    email: string | null;
  };
  profile: unknown;
  coach: unknown;
  workout_routines: unknown[];
  workout_routine_exercises: unknown[];
  workout_sessions: unknown[];
  workout_logs: unknown[];
  food_logs: unknown[];
  water_logs: unknown[];
  chat_messages: unknown[];
  ai_usage_log: unknown[];
  student_requests: unknown[];
  coach_notes: unknown[];
  student_plan_revisions: unknown[];
};

/**
 * Coleta todos os dados que o user logado consegue ler via RLS e
 * retorna num único JSON. RLS já garante que cada usuário só recebe
 * o que é dele (ou do que ele tem acesso, no caso do professor lendo
 * dados dos alunos — pra MVP, mantemos esse comportamento; o
 * professor que quer exportar dados de UM aluno especifico passa por
 * outro fluxo se for relevante depois).
 */
export async function exportMyData(): Promise<DataExport> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const [
    profileRes,
    coachRes,
    routinesRes,
    routineExercisesRes,
    sessionsRes,
    workoutLogsRes,
    foodLogsRes,
    waterLogsRes,
    chatRes,
    usageRes,
    requestsRes,
    notesRes,
    revisionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('coaches').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('workout_routines').select('*').eq('user_id', user.id),
    supabase
      .from('workout_routine_exercises')
      .select('*, routine:workout_routines!inner(user_id)')
      .eq('routine.user_id', user.id),
    supabase.from('workout_sessions').select('*').eq('user_id', user.id),
    supabase.from('workout_logs').select('*').eq('user_id', user.id),
    supabase.from('food_logs').select('*').eq('user_id', user.id),
    supabase.from('water_logs').select('*').eq('user_id', user.id),
    supabase.from('chat_messages').select('*').eq('user_id', user.id),
    supabase.from('ai_usage_log').select('*').eq('user_id', user.id),
    supabase.from('student_requests').select('*').eq('student_id', user.id),
    supabase.from('coach_notes').select('*').eq('coach_id', user.id),
    supabase
      .from('student_plan_revisions')
      .select('*')
      .or(`student_id.eq.${user.id},coach_id.eq.${user.id}`),
  ]);

  // Erros são logados mas não bloqueiam o export — preferimos um arquivo
  // com o que conseguimos ao invés de nada.
  for (const r of [
    profileRes,
    coachRes,
    routinesRes,
    routineExercisesRes,
    sessionsRes,
    workoutLogsRes,
    foodLogsRes,
    waterLogsRes,
    chatRes,
    usageRes,
    requestsRes,
    notesRes,
    revisionsRes,
  ]) {
    if (r.error) {
      console.warn('[exportMyData] partial error:', r.error.message);
    }
  }

  return {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile: profileRes.data ?? null,
    coach: coachRes.data ?? null,
    workout_routines: routinesRes.data ?? [],
    workout_routine_exercises: routineExercisesRes.data ?? [],
    workout_sessions: sessionsRes.data ?? [],
    workout_logs: workoutLogsRes.data ?? [],
    food_logs: foodLogsRes.data ?? [],
    water_logs: waterLogsRes.data ?? [],
    chat_messages: chatRes.data ?? [],
    ai_usage_log: usageRes.data ?? [],
    student_requests: requestsRes.data ?? [],
    coach_notes: notesRes.data ?? [],
    student_plan_revisions: revisionsRes.data ?? [],
  };
}
