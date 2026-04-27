// NutriOn — Edge Function onboarding-plan
// Recebe o perfil preenchido no onboarding e devolve um plano completo:
// metas de caloria/proteína/água + rotinas de treino sugeridas com
// exercícios escolhidos do catálogo público.
//
// Saída SEMPRE em JSON estrito (sem texto antes/depois).

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

const MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Sex = 'm' | 'f' | 'o';
type GoalType = 'lose_fat' | 'maintain' | 'gain_muscle' | 'reduce_body_fat';

type OnboardingInput = {
  full_name?: string | null;
  sex?: Sex | null;
  birth_year?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  goal_type?: GoalType | null;
  goal_weight_kg?: number | null;
  goal_target_date?: string | null;
  practices_sport?: boolean | null;
  sports?: string[] | null;
  weekly_frequency?: string | null;
  water_goal_ml?: number | null;
  allergies?: string | null;
  physical_limitations?: string | null;
  bio?: string | null;
};

type CatalogExercise = {
  id: string;
  name: string;
  group_slug: string;
  group_name: string;
  equipment: string | null;
  is_compound: boolean | null;
};

type RoutineExerciseOut = {
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

type RoutineOut = {
  name: string;
  group_slug: string | null;
  description?: string | null;
  exercises: RoutineExerciseOut[];
};

type PlanOut = {
  calorie_goal: number;
  protein_goal_g: number;
  water_goal_ml: number;
  routines: RoutineOut[];
  rationale: string;
};

const SYSTEM_PROMPT = `Você é um personal trainer + nutricionista esportivo.
Recebe o perfil de um usuário recém-cadastrado e devolve um plano COMPLETO em
JSON estrito (sem texto antes/depois do JSON, sem markdown, sem explicações).

Regras (siga com rigor):
- Calorias: Mifflin-St Jeor x fator de atividade + ajuste por objetivo.
  Déficit 15-20% para perda; superávit 10-15% para ganho; manutenção = TMB*fator.
- Proteína: 1.6-2.2 g/kg de peso corporal, conforme treino e objetivo.
- Água: 35 ml/kg base. +500ml se treina >= 3x/semana.
- Rotinas: gere entre 3 e 5 rotinas semanais, compatíveis com a frequência
  escolhida. Distribua grupos musculares (ex: Peito/Tríceps, Costas/Bíceps,
  Pernas, Ombros/Core). Cada rotina tem 5 a 8 exercícios.
- Use APENAS exercícios do catálogo fornecido; cada item DEVE vir com o
  "exercise_id" exato retornado no catálogo (UUID). Use "exercise_name" igual
  ao "name" do catálogo.
- Respeite limitações físicas declaradas: não prescreva movimentos que piorem
  a condição (ex: joelho instável → evitar agachamento profundo/pliometria).
- Respeite o objetivo: perda de gordura → compostos + finalização aeróbica;
  ganho de massa → volume moderado com cargas pesadas.
- Para cada exercício defina sets (3-5) e reps_min/reps_max coerentes com o
  objetivo (ex: 6-10 para força, 8-12 para hipertrofia, 12-20 para resistência).
- "weight_min_kg" / "weight_max_kg" podem ser null se não for sensato sugerir
  carga (ex: peso corporal, cardio). Use null em vez de 0.
- "duration_min" só para cardio/funcional baseado em tempo; caso contrário null.
- "group_slug" da rotina deve ser o slug do grupo principal (ou null para
  rotinas livres/full-body).

Formato de saída obrigatório (somente JSON válido, nada mais):
{
  "calorie_goal": 2200,
  "protein_goal_g": 160,
  "water_goal_ml": 3500,
  "routines": [
    {
      "name": "Peito A",
      "group_slug": "chest",
      "description": "Foco força e hipertrofia",
      "exercises": [
        {
          "exercise_id": "uuid-do-catalogo",
          "exercise_name": "Supino reto (barra)",
          "sets": 4,
          "reps_min": 6,
          "reps_max": 10,
          "weight_min_kg": null,
          "weight_max_kg": null,
          "duration_min": null,
          "notes": "Aumentar carga quando bater 4x10"
        }
      ]
    }
  ],
  "rationale": "Resumo em 2-3 frases do raciocínio (isso será mostrado ao usuário)."
}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!GROQ_API_KEY) {
    return json(
      {
        error: 'missing_secret',
        detail:
          'GROQ_API_KEY não configurada. Rode: npx supabase secrets set GROQ_API_KEY=gsk_xxx',
      },
      500,
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as OnboardingInput;
    if (!body || typeof body !== 'object') {
      return json({ error: 'invalid_body' }, 400);
    }

    // Busca catálogo filtrado por grupos relevantes ao perfil.
    const slugs = pickRelevantGroups(body);
    const catalog = await fetchCatalog(supabase, slugs);

    if (catalog.length === 0) {
      return json(
        {
          error: 'empty_catalog',
          detail:
            'Catálogo de exercícios vazio no banco — rode npm run db:push com o seed.',
        },
        500,
      );
    }

    const userBlock = buildUserBlock(body, catalog);

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userBlock },
        ],
        temperature: 0.4,
        max_tokens: 2400,
        top_p: 0.9,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[onboarding-plan] Groq ${groqRes.status}:`, errText);
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed?.error?.message ?? errText;
      } catch {
        // keep raw
      }
      if (groqRes.status === 429) {
        return json(
          {
            error: 'rate_limit',
            detail:
              'Muitas requisições. Aguarda ~1 minuto e tenta gerar o plano de novo.',
          },
          429,
        );
      }
      return json(
        { error: 'groq_api_error', detail: `${groqRes.status}: ${detail}` },
        502,
      );
    }

    const groqJson = await groqRes.json();
    const text: string = groqJson?.choices?.[0]?.message?.content ?? '';
    const plan = parseJsonFromText(text) as PlanOut | null;

    if (!plan) {
      console.error('[onboarding-plan] parse_failed:', text.slice(0, 500));
      return json(
        {
          error: 'parse_failed',
          detail: 'IA não retornou JSON válido. Tenta de novo.',
        },
        502,
      );
    }

    const sanitized = sanitizePlan(plan, catalog);

    return json({ plan: sanitized, usage: groqJson?.usage ?? null, model: MODEL });
  } catch (err) {
    console.error('[onboarding-plan] unexpected error', err);
    return json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

function pickRelevantGroups(input: OnboardingInput): string[] {
  const base = [
    'chest',
    'back',
    'legs',
    'shoulders',
    'biceps',
    'triceps',
    'core',
    'full_body',
    'cardio',
  ];

  const sports = (input.sports ?? []).map((s) => s.toLowerCase());
  const onlyFood =
    input.practices_sport === false && sports.length === 0;

  if (onlyFood) {
    // Sem treino — devolve cardio leve + core só como fallback caso a IA
    // invente algo; praticamente o plano sai sem rotinas.
    return ['cardio', 'core'];
  }

  // Caso contrário inclui tudo. Filtro mais esperto pode ser feito depois.
  return base;
}

async function fetchCatalog(
  supabase: ReturnType<typeof createClient>,
  slugs: string[],
): Promise<CatalogExercise[]> {
  const { data: groups, error: gErr } = await supabase
    .from('exercise_groups')
    .select('id, slug, name')
    .in('slug', slugs);

  if (gErr) throw gErr;

  const groupMap = new Map<string, { slug: string; name: string }>(
    (groups ?? []).map((g: { id: string; slug: string; name: string }) => [
      g.id,
      { slug: g.slug, name: g.name },
    ]),
  );

  if (groupMap.size === 0) return [];

  const { data: exercises, error: exErr } = await supabase
    .from('exercises')
    .select('id, group_id, name, equipment, is_compound')
    .in('group_id', Array.from(groupMap.keys()));

  if (exErr) throw exErr;

  return (exercises ?? [])
    .map((e: {
      id: string;
      group_id: string;
      name: string;
      equipment: string | null;
      is_compound: boolean | null;
    }) => {
      const g = groupMap.get(e.group_id);
      if (!g) return null;
      return {
        id: e.id,
        name: e.name,
        group_slug: g.slug,
        group_name: g.name,
        equipment: e.equipment,
        is_compound: e.is_compound,
      } as CatalogExercise;
    })
    .filter((x): x is CatalogExercise => x !== null);
}

function buildUserBlock(input: OnboardingInput, catalog: CatalogExercise[]) {
  const age =
    input.birth_year != null
      ? new Date().getFullYear() - input.birth_year
      : null;

  const sexLabel =
    input.sex === 'm' ? 'masculino' : input.sex === 'f' ? 'feminino' : 'outro';

  const sports =
    input.practices_sport === false
      ? 'nenhum (quer focar apenas em alimentação)'
      : (input.sports ?? []).join(', ') || 'não informado';

  const goalLabel = goalToLabel(input.goal_type);

  const lines = [
    'Perfil do usuário:',
    `- Nome: ${input.full_name ?? 'não informado'}`,
    `- Sexo: ${sexLabel}${age != null ? `, ${age} anos` : ''}`,
    `- Peso atual: ${input.weight_kg ?? '?'} kg, Altura: ${input.height_cm ?? '?'} cm`,
    `- Objetivo: ${goalLabel}${input.goal_weight_kg ? `, meta de peso ${input.goal_weight_kg} kg` : ''}${input.goal_target_date ? ` até ${input.goal_target_date}` : ''}`,
    `- Pratica esporte: ${sports}`,
    `- Frequência semanal: ${input.weekly_frequency ?? 'não informado'}`,
    `- Água atual/desejada: ${input.water_goal_ml ?? '?'} ml/dia`,
    `- Alergias: ${input.allergies ?? 'nenhuma relatada'}`,
    `- Limitações físicas: ${input.physical_limitations ?? 'nenhuma relatada'}`,
    `- Bio: ${input.bio ?? 'não informado'}`,
    '',
    'Catálogo de exercícios disponíveis (use EXATAMENTE estes ids/nomes):',
    JSON.stringify(
      catalog.map((e) => ({
        id: e.id,
        name: e.name,
        group_slug: e.group_slug,
        equipment: e.equipment,
        is_compound: e.is_compound,
      })),
    ),
  ];

  return lines.join('\n');
}

function goalToLabel(g: GoalType | null | undefined): string {
  switch (g) {
    case 'lose_fat':
      return 'perda de peso/emagrecimento';
    case 'maintain':
      return 'manter o peso';
    case 'gain_muscle':
      return 'ganho de massa muscular';
    case 'reduce_body_fat':
      return 'redução de gordura corporal';
    default:
      return 'não informado';
  }
}

// Tolerante: lida com ```json ... ``` e com texto adjacente.
function parseJsonFromText(text: string): unknown {
  if (!text) return null;
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fallthrough
  }

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fallthrough
    }
  }

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      return null;
    }
  }

  return null;
}

// Remove exercícios que o modelo inventou fora do catálogo e normaliza valores.
function sanitizePlan(plan: PlanOut, catalog: CatalogExercise[]): PlanOut {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const byName = new Map(
    catalog.map((e) => [e.name.toLowerCase(), e] as const),
  );

  const routines = (plan.routines ?? []).map((r) => {
    const exercises = (r.exercises ?? [])
      .map((ex) => {
        const hit =
          byId.get(ex.exercise_id) ?? byName.get(ex.exercise_name?.toLowerCase() ?? '');
        if (!hit) return null;
        return {
          exercise_id: hit.id,
          exercise_name: hit.name,
          equipment: hit.equipment ?? null,
          sets: clampInt(ex.sets, 1, 10, 3),
          reps_min: clampInt(ex.reps_min, 1, 100, 8),
          reps_max: clampInt(ex.reps_max, 1, 100, 12),
          weight_min_kg: nullableNum(ex.weight_min_kg),
          weight_max_kg: nullableNum(ex.weight_max_kg),
          duration_min: nullableInt(ex.duration_min),
          notes: ex.notes ?? null,
        } as RoutineExerciseOut;
      })
      .filter((e): e is RoutineExerciseOut => e !== null);

    return {
      name: (r.name ?? 'Treino').slice(0, 60),
      group_slug: r.group_slug ?? null,
      description: r.description ?? null,
      exercises,
    } as RoutineOut;
  });

  return {
    calorie_goal: clampInt(plan.calorie_goal, 800, 6000, 2200),
    protein_goal_g: clampInt(plan.protein_goal_g, 40, 400, 140),
    water_goal_ml: clampInt(plan.water_goal_ml, 1000, 8000, 3000),
    routines: routines.filter((r) => r.exercises.length > 0),
    rationale: (plan.rationale ?? '').slice(0, 1000),
  };
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof v === 'number' ? Math.round(v) : Number.parseInt(String(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function nullableNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nullableInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? Math.round(v) : Number.parseInt(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
