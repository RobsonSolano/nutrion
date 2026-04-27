// NutriOn — seeder de usuário fake (Gabriel Silva)
//
// Uso:
//   node --env-file=.env.local scripts/seed-user.mjs
// ou
//   npm run seed:user
//
// Requer: EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env.local.
// Pega a service_role em: Supabase Dashboard → Settings → API → service_role.
//
// Idempotente: pode rodar várias vezes. Se o user já existir, só atualiza os
// dados; se não existir, cria. Sempre limpa logs e rotinas antigas do user
// antes de repopular.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌ Faltam variáveis de ambiente. Adicione no .env.local:\n' +
      '   EXPO_PUBLIC_SUPABASE_URL (já configurado pro app)\n' +
      '   SUPABASE_SERVICE_ROLE_KEY (Supabase Dashboard → Settings → API → service_role)\n',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- DADOS DO GABRIEL ----
const EMAIL = 'gabriel.silva@gmail.com';
const PASSWORD = '123456789';
const FULL_NAME = 'Gabriel Silva';
const AGE = 35;
const WEIGHT_KG = 99;
const HEIGHT_CM = 180;
const GOAL_WEIGHT_KG = 85;
const GOAL_MONTHS = 5;
const DAILY_CALORIE_GOAL = 2200; // déficit moderado
const PROTEIN_GOAL_G = 165; // 1.67 g/kg
const WATER_GOAL_ML = 3500; // 35 ml/kg

// ---- HELPERS ----
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function setTime(date, h, m = 0) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- ETAPAS ----

async function getOrCreateUser() {
  // Busca user existente
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  if (listErr) throw listErr;

  const found = existing?.users?.find((u) => u.email === EMAIL);
  if (found) {
    console.log(`  ↺ user já existe (${found.id}) — atualizando senha + dados`);
    // Atualiza senha pra garantir que continua igual mesmo se mudou antes
    await supabase.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME, name: FULL_NAME },
    });
    return found.id;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, name: FULL_NAME },
  });
  if (createErr) throw createErr;
  console.log(`  ✅ user criado: ${created.user.id}`);
  return created.user.id;
}

async function updateProfile(userId) {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setMonth(targetDate.getMonth() + GOAL_MONTHS);

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: FULL_NAME,
      sex: 'm',
      birth_year: today.getFullYear() - AGE,
      weight_kg: WEIGHT_KG,
      height_cm: HEIGHT_CM,
      goal_weight_kg: GOAL_WEIGHT_KG,
      goal_target_date: ymd(targetDate),
      goal_type: 'lose_fat',
      practices_sport: true,
      sports: ['musculacao'],
      weekly_frequency: '4-5',
      water_goal_ml: WATER_GOAL_ML,
      daily_calorie_goal: DAILY_CALORIE_GOAL,
      protein_goal_g: PROTEIN_GOAL_G,
      allergies: 'Nenhuma alergia conhecida',
      physical_limitations: 'Dor leve no joelho direito ocasional — evita pliometria pesada',
      bio: 'Engenheiro, 35 anos. Trabalho sentado 8h, durmo ~6h, treino à noite. Quero perder gordura sem sacrificar massa magra. Foco em consistência > intensidade.',
      onboarding_completed_at: today.toISOString(),
      onboarding_skipped_at: null,
    })
    .eq('id', userId);
  if (error) throw error;
}

async function clearOldData(userId) {
  await Promise.all([
    supabase.from('food_logs').delete().eq('user_id', userId),
    supabase.from('workout_logs').delete().eq('user_id', userId),
    supabase.from('workout_sessions').delete().eq('user_id', userId),
    supabase.from('water_logs').delete().eq('user_id', userId),
    supabase.from('chat_messages').delete().eq('user_id', userId),
    supabase.from('ai_usage_log').delete().eq('user_id', userId),
  ]);
  // Rotinas: precisa deletar exercises (FK CASCADE deveria cuidar, mas
  // vamos explícito pra garantir)
  const { data: oldRoutines } = await supabase
    .from('workout_routines')
    .select('id')
    .eq('user_id', userId);
  if (oldRoutines && oldRoutines.length > 0) {
    const ids = oldRoutines.map((r) => r.id);
    await supabase.from('workout_routine_exercises').delete().in('routine_id', ids);
    await supabase.from('workout_routines').delete().in('id', ids);
  }
}

async function buildExerciseLookup() {
  const { data: groups, error: gErr } = await supabase
    .from('exercise_groups')
    .select('id, slug');
  if (gErr) throw gErr;
  const groupBySlug = Object.fromEntries(groups.map((g) => [g.slug, g.id]));

  const { data: exercises, error: eErr } = await supabase
    .from('exercises')
    .select('id, name, group_id, equipment');
  if (eErr) throw eErr;
  const exerciseByName = Object.fromEntries(exercises.map((e) => [e.name, e]));
  return { groupBySlug, exerciseByName };
}

const ROUTINES_SPEC = [
  {
    name: 'Peito + Tríceps',
    group_slug: 'chest',
    description: 'Foco força e hipertrofia',
    exercises: [
      { name: 'Supino reto (barra)', sets: 4, reps_min: 6, reps_max: 10, weight_min_kg: 60, weight_max_kg: 80 },
      { name: 'Supino inclinado (halteres)', sets: 4, reps_min: 8, reps_max: 12, weight_min_kg: 22, weight_max_kg: 28 },
      { name: 'Crucifixo reto (halteres)', sets: 3, reps_min: 10, reps_max: 12, weight_min_kg: 14, weight_max_kg: 18 },
      { name: 'Tríceps testa (barra)', sets: 3, reps_min: 8, reps_max: 12, weight_min_kg: 25, weight_max_kg: 35 },
      { name: 'Tríceps corda (pulley)', sets: 3, reps_min: 10, reps_max: 15, weight_min_kg: 25, weight_max_kg: 35 },
    ],
  },
  {
    name: 'Costas + Bíceps',
    group_slug: 'back',
    description: 'Volume + finalização',
    exercises: [
      { name: 'Levantamento terra (barra)', sets: 4, reps_min: 5, reps_max: 8, weight_min_kg: 80, weight_max_kg: 110 },
      { name: 'Puxada frontal (pulley)', sets: 4, reps_min: 8, reps_max: 12, weight_min_kg: 50, weight_max_kg: 70 },
      { name: 'Remada baixa (pulley)', sets: 4, reps_min: 8, reps_max: 12, weight_min_kg: 50, weight_max_kg: 65 },
      { name: 'Rosca direta (barra)', sets: 3, reps_min: 8, reps_max: 12, weight_min_kg: 25, weight_max_kg: 35 },
      { name: 'Rosca martelo (halteres)', sets: 3, reps_min: 10, reps_max: 12, weight_min_kg: 12, weight_max_kg: 18 },
    ],
  },
  {
    name: 'Pernas',
    group_slug: 'legs',
    description: 'Compostos pesados + isolamento, com cuidado no joelho',
    exercises: [
      { name: 'Agachamento livre (barra)', sets: 4, reps_min: 6, reps_max: 10, weight_min_kg: 80, weight_max_kg: 110, notes: 'Profundidade controlada por causa do joelho' },
      { name: 'Leg press 45°', sets: 4, reps_min: 10, reps_max: 15, weight_min_kg: 180, weight_max_kg: 240 },
      { name: 'Cadeira extensora', sets: 3, reps_min: 12, reps_max: 15, weight_min_kg: 40, weight_max_kg: 55 },
      { name: 'Mesa flexora', sets: 3, reps_min: 10, reps_max: 12, weight_min_kg: 35, weight_max_kg: 50 },
      { name: 'Panturrilha em pé (máquina)', sets: 4, reps_min: 12, reps_max: 20, weight_min_kg: 70, weight_max_kg: 100 },
    ],
  },
  {
    name: 'Ombros + Core',
    group_slug: 'shoulders',
    description: 'Estabilidade + abdômen',
    exercises: [
      { name: 'Desenvolvimento (halteres)', sets: 4, reps_min: 8, reps_max: 12, weight_min_kg: 18, weight_max_kg: 26 },
      { name: 'Elevação lateral (halteres)', sets: 4, reps_min: 10, reps_max: 15, weight_min_kg: 8, weight_max_kg: 14 },
      { name: 'Face pull (cabo)', sets: 3, reps_min: 12, reps_max: 15, weight_min_kg: 20, weight_max_kg: 30 },
      { name: 'Prancha (frontal)', sets: 3, duration_min: 1, notes: 'Manter 60s por série' },
      { name: 'Abdominal supra', sets: 3, reps_min: 15, reps_max: 25 },
    ],
  },
];

async function createRoutines(userId, exerciseByName, groupBySlug) {
  const created = [];
  for (const spec of ROUTINES_SPEC) {
    const { data: routine, error: rErr } = await supabase
      .from('workout_routines')
      .insert({
        user_id: userId,
        name: spec.name,
        group_id: groupBySlug[spec.group_slug] ?? null,
        description: spec.description,
      })
      .select('*')
      .single();
    if (rErr) throw rErr;

    const rows = spec.exercises
      .map((ex, i) => {
        const found = exerciseByName[ex.name];
        if (!found) {
          console.warn(`  ⚠️  exercise não encontrado no catálogo: ${ex.name}`);
          return null;
        }
        return {
          routine_id: routine.id,
          exercise_id: found.id,
          exercise_name: found.name,
          equipment: found.equipment,
          sort_order: i,
          sets: ex.sets ?? null,
          reps_min: ex.reps_min ?? null,
          reps_max: ex.reps_max ?? null,
          weight_min_kg: ex.weight_min_kg ?? null,
          weight_max_kg: ex.weight_max_kg ?? null,
          duration_min: ex.duration_min ?? null,
          notes: ex.notes ?? null,
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      const { error: exErr } = await supabase
        .from('workout_routine_exercises')
        .insert(rows);
      if (exErr) throw exErr;
    }

    created.push({ id: routine.id, name: routine.name });
  }
  return created;
}

async function createWeeklyStreak(userId, routines) {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  // Plano: cada dia uma rotina diferente, exceto 1 dia de cardio leve
  const plan = [
    routines[3], // -6 dias: Ombros + Core
    routines[0], // -5: Peito + Tríceps
    routines[1], // -4: Costas + Bíceps
    null, // -3: cardio leve (caminhada)
    routines[2], // -2: Pernas
    routines[3], // -1: Ombros + Core
    routines[0], // hoje: Peito + Tríceps
  ];

  const foodLogs = [];
  const waterLogs = [];
  const workoutSessions = [];

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dayStr = ymd(d);

    foodLogs.push(
      {
        user_id: userId,
        meal_name: 'Café',
        description: '4 ovos mexidos, 2 fatias pão integral, 1 banana',
        calories: 480,
        protein_g: 32,
        carbs_g: 52,
        fats_g: 14,
        created_at: setTime(d, 8).toISOString(),
      },
      {
        user_id: userId,
        meal_name: 'Almoço',
        description: '180g frango grelhado, 100g arroz, 80g feijão, salada',
        calories: 720,
        protein_g: 50,
        carbs_g: 75,
        fats_g: 18,
        created_at: setTime(d, 13).toISOString(),
      },
      {
        user_id: userId,
        meal_name: 'Pré-treino',
        description: '40g aveia + whey 30g',
        calories: 280,
        protein_g: 28,
        carbs_g: 30,
        fats_g: 4,
        created_at: setTime(d, 17).toISOString(),
      },
      {
        user_id: userId,
        meal_name: 'Jantar',
        description: '150g salmão, 200g batata doce, brócolis no vapor',
        calories: 620,
        protein_g: 42,
        carbs_g: 55,
        fats_g: 20,
        created_at: setTime(d, 20).toISOString(),
      },
    );

    waterLogs.push({
      user_id: userId,
      day: dayStr,
      volume_ml: rand(3100, 3600),
      updated_at: setTime(d, 22).toISOString(),
    });

    const routine = plan[i];
    if (routine) {
      workoutSessions.push({
        user_id: userId,
        routine_id: routine.id,
        routine_name: routine.name,
        day: dayStr,
        duration_min: rand(50, 70),
        notes: i === days.length - 1 ? 'Cargas progrediram em supino 🔥' : null,
        created_at: setTime(d, 19, 30).toISOString(),
      });
    } else {
      workoutSessions.push({
        user_id: userId,
        routine_id: null,
        routine_name: 'Cardio leve (caminhada)',
        day: dayStr,
        duration_min: 30,
        notes: 'Caminhada manhã, 5 km',
        created_at: setTime(d, 7).toISOString(),
      });
    }
  }

  const { error: fErr } = await supabase.from('food_logs').insert(foodLogs);
  if (fErr) throw fErr;

  const { error: wErr } = await supabase.from('water_logs').insert(waterLogs);
  if (wErr) throw wErr;

  const { error: sErr } = await supabase.from('workout_sessions').insert(workoutSessions);
  if (sErr) throw sErr;

  return {
    foodCount: foodLogs.length,
    waterCount: waterLogs.length,
    sessionCount: workoutSessions.length,
  };
}

// ---- MAIN ----
async function main() {
  console.log('🌱 Seeding NutriOn user:', EMAIL);
  console.log();

  const userId = await getOrCreateUser();

  console.log('  ⏳ atualizando profile...');
  await updateProfile(userId);

  console.log('  🧹 limpando logs e rotinas anteriores...');
  await clearOldData(userId);

  console.log('  📚 carregando catálogo de exercícios...');
  const { groupBySlug, exerciseByName } = await buildExerciseLookup();

  console.log('  🏋️  criando rotinas...');
  const routines = await createRoutines(userId, exerciseByName, groupBySlug);

  console.log('  📅 criando streak semanal (7 dias de food + água + treino)...');
  const stats = await createWeeklyStreak(userId, routines);

  console.log();
  console.log('🎉 Seed completo!');
  console.log(`  Email:     ${EMAIL}`);
  console.log(`  Senha:     ${PASSWORD}`);
  console.log(`  User ID:   ${userId}`);
  console.log(`  Rotinas:   ${routines.length} (${routines.map((r) => r.name).join(', ')})`);
  console.log(`  Logs:      ${stats.foodCount} food + ${stats.waterCount} água + ${stats.sessionCount} sessões`);
  console.log();
  console.log('Loga no app com esse email/senha pra ver o painel populado.');
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err);
  process.exit(1);
});
