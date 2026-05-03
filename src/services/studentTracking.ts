import { supabase } from './supabase';

export type DayActivity = {
  day: string; // YYYY-MM-DD em America/Sao_Paulo
  hasFood: boolean;
  hasWater: boolean;
  hasWorkout: boolean;
};

export type StudentTracking = {
  /** % de dias dos últimos 7 com pelo menos um food_log OU workout_session. */
  adherenceLast7: number;
  daysActiveLast7: number;
  /** Cada um dos últimos 7 dias com flags por tipo (mais antigo → mais recente). */
  weekActivity: DayActivity[];
  /** Snapshot de hoje. */
  today: {
    calories: number;
    protein: number;
    waterMl: number;
    foodLogs: { meal_name: string | null; calories: number | null; created_at: string }[];
    workoutSessions: { routine_name: string; duration_min: number | null; created_at: string }[];
  };
};

function dayKeyBR(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function dateInBR(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
}

function last7Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dayKeyBR(d));
  }
  return out;
}

export async function getStudentTracking(
  studentId: string,
): Promise<StudentTracking> {
  const days = last7Days();
  const start = `${days[0]}T00:00:00.000Z`; // limite inferior aproximado
  const today = days[days.length - 1];

  const [foodRes, waterRes, sessionRes] = await Promise.all([
    // food_logs últimos 7 dias (created_at é timestamptz, filtro por start
    // pega tudo que possa cair em qualquer fuso da janela).
    supabase
      .from('food_logs')
      .select('meal_name, calories, protein_g, created_at')
      .eq('user_id', studentId)
      .gte('created_at', start)
      .order('created_at', { ascending: false }),
    // water_logs por day (já é YYYY-MM-DD no banco).
    supabase
      .from('water_logs')
      .select('day, volume_ml')
      .eq('user_id', studentId)
      .gte('day', days[0]),
    // workout_sessions por day.
    supabase
      .from('workout_sessions')
      .select('routine_name, duration_min, day, created_at')
      .eq('user_id', studentId)
      .gte('day', days[0])
      .order('created_at', { ascending: false }),
  ]);

  if (foodRes.error) throw foodRes.error;
  if (waterRes.error) throw waterRes.error;
  if (sessionRes.error) throw sessionRes.error;

  const foods = foodRes.data ?? [];
  const waters = waterRes.data ?? [];
  const sessions = sessionRes.data ?? [];

  // Indexa por dia.
  const foodDays = new Set<string>();
  const waterDays = new Set<string>();
  const sessionDays = new Set<string>();

  for (const f of foods) {
    foodDays.add(dateInBR(f.created_at as string));
  }
  for (const w of waters) {
    if ((w.volume_ml ?? 0) > 0) waterDays.add(w.day as string);
  }
  for (const s of sessions) {
    sessionDays.add(s.day as string);
  }

  const weekActivity: DayActivity[] = days.map((day) => ({
    day,
    hasFood: foodDays.has(day),
    hasWater: waterDays.has(day),
    hasWorkout: sessionDays.has(day),
  }));

  const daysActiveLast7 = weekActivity.filter(
    (d) => d.hasFood || d.hasWorkout,
  ).length;
  const adherenceLast7 = Math.round((daysActiveLast7 / 7) * 100);

  // Hoje: agrega macros + listagens curtas.
  const todayFoods = foods.filter(
    (f) => dateInBR(f.created_at as string) === today,
  );
  const calories = todayFoods.reduce(
    (acc, f) => acc + ((f.calories as number | null) ?? 0),
    0,
  );
  const protein = todayFoods.reduce(
    (acc, f) => acc + ((f.protein_g as number | null) ?? 0),
    0,
  );
  const todayWater = waters.find((w) => w.day === today);
  const waterMl = (todayWater?.volume_ml as number | null) ?? 0;
  const todaySessions = sessions
    .filter((s) => s.day === today)
    .map((s) => ({
      routine_name: s.routine_name as string,
      duration_min: (s.duration_min as number | null) ?? null,
      created_at: s.created_at as string,
    }));

  return {
    adherenceLast7,
    daysActiveLast7,
    weekActivity,
    today: {
      calories,
      protein,
      waterMl,
      foodLogs: todayFoods.slice(0, 5).map((f) => ({
        meal_name: (f.meal_name as string | null) ?? null,
        calories: (f.calories as number | null) ?? null,
        created_at: f.created_at as string,
      })),
      workoutSessions: todaySessions,
    },
  };
}
