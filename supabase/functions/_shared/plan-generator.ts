// Helper compartilhado entre onboarding-plan e coach-generate-plan.
// Encapsula a lógica de IA (Groq) que recebe a ficha de um usuário e
// devolve um plano estruturado (metas + rotinas com exercícios).
//
// As edge functions ficam responsáveis só por: auth, cota, persistência
// de log, e formatação da resposta HTTP. Toda a "inteligência" do plano
// vive aqui.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchReferences,
  formatReferencesForPrompt,
} from './references.ts';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type Sex = 'm' | 'f' | 'o';
export type GoalType =
  | 'lose_fat'
  | 'maintain'
  | 'gain_muscle'
  | 'reduce_body_fat';
export type Modality =
  | 'musculacao'
  | 'calistenia'
  | 'crossfit'
  | 'corrida'
  | 'generico';

export const MODALITY_LABEL: Record<Modality, string> = {
  musculacao: 'Musculação',
  calistenia: 'Calistenia',
  crossfit: 'CrossFit',
  corrida: 'Corrida',
  generico: 'Genérico (mobilidade/complementar)',
};

export type PlanInput = {
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
  /** Bloco formatado pela anamnese clínica (formatAnamneseForPrompt). */
  anamnese_summary?: string | null;
};

export type CatalogExercise = {
  id: string;
  name: string;
  group_slug: string;
  group_name: string;
  equipment: string | null;
  is_compound: boolean | null;
  modality: Modality;
};

export type RoutineExerciseOut = {
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

export type RoutineOut = {
  name: string;
  modality: Modality;
  group_slug: string | null;
  description?: string | null;
  exercises: RoutineExerciseOut[];
};

export type PlanOut = {
  calorie_goal: number;
  protein_goal_g: number;
  water_goal_ml: number;
  routines: RoutineOut[];
  rationale: string;
};

const BASE_SYSTEM_PROMPT = `Você é um personal trainer + nutricionista esportivo.
Recebe o perfil de um usuário e devolve um plano COMPLETO em JSON estrito
(sem texto antes/depois do JSON, sem markdown, sem explicações).

Regras gerais (siga com rigor):
- Calorias: Mifflin-St Jeor x fator de atividade + ajuste por objetivo.
  Déficit 15-20% para perda; superávit 10-15% para ganho; manutenção = TMB*fator.
- Proteína: 1.6-2.2 g/kg de peso corporal, conforme treino e objetivo.
- Água: 35 ml/kg base. +500ml se treina >= 3x/semana.
- Use APENAS exercícios do catálogo fornecido; cada item DEVE vir com o
  "exercise_id" exato retornado no catálogo (UUID). Use "exercise_name" igual
  ao "name" do catálogo.
- Respeite limitações físicas declaradas: não prescreva movimentos que piorem
  a condição (ex: joelho instável → evitar agachamento profundo/pliometria).
- Respeite o objetivo: perda de gordura → compostos + finalização aeróbica;
  ganho de massa → volume moderado com cargas pesadas.
- "weight_min_kg" / "weight_max_kg" podem ser null se não for sensato sugerir
  carga (ex: peso corporal, cardio). Use null em vez de 0.
- "duration_min" só para cardio/funcional baseado em tempo; caso contrário null.
- "group_slug" da rotina deve ser o slug do grupo principal (ou null para
  rotinas livres/full-body).

REGRA CRÍTICA — modalidades:
- Cada rotina DEVE declarar "modality" (uma das modalidades disponíveis).
- Os exercícios escolhidos pra essa rotina DEVEM ter exatamente a mesma
  "modality" no catálogo. NUNCA misture musculação com calistenia/crossfit/etc
  na mesma rotina.
- Se o usuário pratica múltiplas modalidades, distribua as rotinas entre elas.
- Cada rotina é monomodal.

Formato de saída obrigatório (somente JSON válido, nada mais):
{
  "calorie_goal": 2200,
  "protein_goal_g": 160,
  "water_goal_ml": 3500,
  "routines": [
    {
      "name": "Peito A",
      "modality": "musculacao",
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

function modalityGuidelines(m: Modality): string {
  switch (m) {
    case 'musculacao':
      return `MUSCULAÇÃO:
- Distribua grupos musculares (ex: Peito/Tríceps, Costas/Bíceps, Pernas, Ombros/Core).
- 5-8 exercícios por rotina, 3-5 séries, 6-12 reps.
- Use cargas progressivas (barra/halter/máquina).`;
    case 'calistenia':
      return `CALISTENIA:
- Foque progressões de peso corporal (push/pull/legs/core).
- 4-6 exercícios por rotina, 3-5 séries, reps até falha técnica
  (geralmente mais reps que musculação: 8-20).
- Inclua hold isométrico (prancha, L-sit) ocasionalmente — use duration_min.
- weight_min_kg/weight_max_kg = null sempre.`;
    case 'crossfit':
      return `CROSSFIT:
- Estruture como WODs: AMRAP (X minutos), EMOM, For Time, ou Strength + Met-Con.
- 3-6 movimentos por rotina, intensidade alta.
- Misture ginástica + halterofilismo + cardio.
- "duration_min" pra duração total do WOD; "sets" = número de rounds.
- Use "notes" pra esquema do WOD (ex: "AMRAP 12min: 10 thrusters + 15 box jumps").`;
    case 'corrida':
      return `CORRIDA:
- Cada rotina é UM tipo de treino (longão, intervalado, fartlek, regenerativo, etc).
- 1 exercício por rotina (o protocolo). Use "duration_min" pra duração total.
- "notes" descreve a estrutura (ex: "5x 800m na faixa 4'15"/km com 2min trote").
- weight_min_kg/weight_max_kg = null sempre.`;
    case 'generico':
      return `GENÉRICO (mobilidade/complementar):
- Foco em mobilidade, alongamento e prevenção de lesão.
- 5-8 exercícios por rotina, holds 30-60s.
- Use "duration_min" pra tempo do hold ou da sessão.`;
  }
}

const ANAMNESE_SAFETY_RULES = `

Regras de segurança a partir da anamnese clínica (quando presente no perfil do usuário):
- Lesão em região X: evitar exercícios que sobrecarreguem X (ex: lesão joelho -> evitar agachamento profundo, leg press unilateral pesado, salto plyo). Sugerir variações seguras (ex: leg curl, extensão isolada, bike).
- Doença cardiovascular sem liberação médica: intensidade moderada (RPE máx 7), priorizar aeróbio leve, evitar valsalva pesado.
- Restrição alimentar (vegano, sem lactose, etc): refletir nas metas e sugestões (ex: sem lactose -> não sugerir whey de leite; vegano -> proteínas vegetais).
- Cirurgia recente (< 12 meses) na região X: tratar como lesão ativa da região.`;

export function buildSystemPrompt(
  modalities: Modality[],
  onlyFood: boolean,
): string {
  if (onlyFood) {
    return `${BASE_SYSTEM_PROMPT}

MODO ESPECIAL — usuário escolheu NÃO TREINAR:
- Retorne "routines": [] (array vazio).
- Foque o "rationale" 100% em alimentação, hidratação e hábitos.
- NÃO invente rotinas mesmo se houver exercícios no catálogo.${ANAMNESE_SAFETY_RULES}`;
  }

  const labels = modalities.map((m) => MODALITY_LABEL[m]).join(', ');
  const guidelines = modalities.map(modalityGuidelines).join('\n\n');

  return `${BASE_SYSTEM_PROMPT}

Modalidades selecionadas pelo usuário: ${labels}

Diretrizes específicas por modalidade:

${guidelines}

Quantidade de rotinas:
- Entre 3 e 5 rotinas semanais no total, distribuídas entre as modalidades selecionadas
  proporcionalmente. Ex: se ele pratica musculação + corrida com freq 4x, gera ~3 musc + 1 corrida.
- Compatíveis com a frequência semanal informada.${ANAMNESE_SAFETY_RULES}`;
}

function mapSportsToModalities(sports: string[]): Modality[] {
  const out = new Set<Modality>();
  for (const raw of sports) {
    const s = raw.toLowerCase().trim();
    if (s === 'nenhum' || s === '') continue;
    if (s === 'musculacao' || s === 'musculação') out.add('musculacao');
    else if (s === 'calistenia') out.add('calistenia');
    else if (s === 'crossfit') out.add('crossfit');
    else if (s === 'corrida' || s === 'caminhada' || s === 'corrida_caminhada')
      out.add('corrida');
    else out.add('generico');
  }
  return Array.from(out);
}

export function pickRelevantModalities(input: PlanInput): {
  modalities: Modality[];
  onlyFood: boolean;
} {
  const sports = (input.sports ?? []).map((s) => s.toLowerCase().trim());
  const onlyFood =
    input.practices_sport === false &&
    (sports.length === 0 || sports.every((s) => s === 'nenhum'));

  if (onlyFood) return { modalities: [], onlyFood: true };

  const modalities = mapSportsToModalities(input.sports ?? []);
  if (modalities.length === 0) modalities.push('musculacao');
  return { modalities, onlyFood: false };
}

export async function fetchCatalog(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  modalities: Modality[],
): Promise<CatalogExercise[]> {
  if (modalities.length === 0) return [];

  const { data: groups, error: gErr } = await supabase
    .from('exercise_groups')
    .select('id, slug, name');
  if (gErr) throw gErr;

  const groupMap = new Map<string, { slug: string; name: string }>(
    (groups ?? []).map((g: { id: string; slug: string; name: string }) => [
      g.id,
      { slug: g.slug, name: g.name },
    ]),
  );

  const { data: exercises, error: exErr } = await supabase
    .from('exercises')
    .select('id, group_id, name, equipment, is_compound, modality')
    .in('modality', modalities);
  if (exErr) throw exErr;

  return (exercises ?? [])
    .map(
      (e: {
        id: string;
        group_id: string;
        name: string;
        equipment: string | null;
        is_compound: boolean | null;
        modality: Modality;
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
          modality: e.modality,
        } as CatalogExercise;
      },
    )
    .filter((x): x is CatalogExercise => x !== null);
}

export function buildUserBlock(
  input: PlanInput,
  catalog: CatalogExercise[],
  modalities: Modality[],
  onlyFood: boolean,
): string {
  const age =
    input.birth_year != null
      ? new Date().getFullYear() - input.birth_year
      : null;

  const sexLabel =
    input.sex === 'm' ? 'masculino' : input.sex === 'f' ? 'feminino' : 'outro';

  const sportsLabel = onlyFood
    ? 'NENHUM (foco apenas em alimentação — não gerar rotinas)'
    : modalities.map((m) => MODALITY_LABEL[m]).join(', ');

  const goalLabel = goalToLabel(input.goal_type);

  const lines = [
    'Perfil do usuário:',
    `- Nome: ${input.full_name ?? 'não informado'}`,
    `- Sexo: ${sexLabel}${age != null ? `, ${age} anos` : ''}`,
    `- Peso atual: ${input.weight_kg ?? '?'} kg, Altura: ${input.height_cm ?? '?'} cm`,
    `- Objetivo: ${goalLabel}${input.goal_weight_kg ? `, meta de peso ${input.goal_weight_kg} kg` : ''}${input.goal_target_date ? ` até ${input.goal_target_date}` : ''}`,
    `- Modalidades: ${sportsLabel}`,
    `- Frequência semanal: ${input.weekly_frequency ?? 'não informado'}`,
    `- Água atual/desejada: ${input.water_goal_ml ?? '?'} ml/dia`,
    `- Alergias: ${input.allergies ?? 'nenhuma relatada'}`,
    `- Limitações físicas: ${input.physical_limitations ?? 'nenhuma relatada'}`,
    `- Bio: ${input.bio ?? 'não informado'}`,
  ];

  if (input.anamnese_summary) {
    lines.push('', 'Anamnese clínica:', input.anamnese_summary);
  }

  if (!onlyFood) {
    lines.push(
      '',
      'Catálogo de exercícios disponíveis (use EXATAMENTE estes ids/nomes; cada exercício tem sua "modality" — rotina escolhe um modality e usa só exercícios desse modality):',
      JSON.stringify(
        catalog.map((e) => ({
          id: e.id,
          name: e.name,
          modality: e.modality,
          group_slug: e.group_slug,
          equipment: e.equipment,
          is_compound: e.is_compound,
        })),
      ),
    );
  }

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

export function sanitizePlan(
  plan: PlanOut,
  catalog: CatalogExercise[],
  modalities: Modality[],
  onlyFood: boolean,
): PlanOut {
  if (onlyFood) {
    return {
      calorie_goal: clampInt(plan.calorie_goal, 800, 6000, 2200),
      protein_goal_g: clampInt(plan.protein_goal_g, 40, 400, 140),
      water_goal_ml: clampInt(plan.water_goal_ml, 1000, 8000, 3000),
      routines: [],
      rationale: (plan.rationale ?? '').slice(0, 1000),
    };
  }

  const allowedModalities = new Set(modalities);
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const byName = new Map(
    catalog.map((e) => [e.name.toLowerCase(), e] as const),
  );

  const routines = (plan.routines ?? [])
    .map((r) => {
      const modality = isModality(r.modality) ? r.modality : null;
      if (!modality || !allowedModalities.has(modality)) return null;

      const exercises = (r.exercises ?? [])
        .map((ex) => {
          const hit =
            byId.get(ex.exercise_id) ??
            byName.get(ex.exercise_name?.toLowerCase() ?? '');
          if (!hit || hit.modality !== modality) return null;
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
        modality,
        group_slug: r.group_slug ?? null,
        description: r.description ?? null,
        exercises,
      } as RoutineOut;
    })
    .filter((r): r is RoutineOut => r !== null && r.exercises.length > 0);

  return {
    calorie_goal: clampInt(plan.calorie_goal, 800, 6000, 2200),
    protein_goal_g: clampInt(plan.protein_goal_g, 40, 400, 140),
    water_goal_ml: clampInt(plan.water_goal_ml, 1000, 8000, 3000),
    routines,
    rationale: (plan.rationale ?? '').slice(0, 1000),
  };
}

function isModality(v: unknown): v is Modality {
  return (
    v === 'musculacao' ||
    v === 'calistenia' ||
    v === 'crossfit' ||
    v === 'corrida' ||
    v === 'generico'
  );
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

export type GeneratePlanError =
  | { kind: 'empty_catalog' }
  | { kind: 'rate_limit' }
  | { kind: 'groq_api_error'; status: number; detail: string }
  | { kind: 'parse_failed'; raw: string };

/**
 * Gera um plano completo via Groq. Pure function: não toca em RLS, não
 * loga, não persiste. Caller decide cota, log e save. As referências
 * bibliográficas são injetadas no system prompt automaticamente.
 *
 * Retorna { plan } em sucesso, { error } em falhas previsíveis. Lança
 * exceção pra erros inesperados (network, etc).
 */
export type GeneratePlanResponse =
  | { plan: PlanOut; totalTokens: number | null; error?: undefined }
  | { error: GeneratePlanError; plan?: undefined; totalTokens?: undefined };

/**
 * Gera um plano completo via Groq. Pure function: não toca em RLS, não
 * loga, não persiste. Caller decide cota, log e save. As referências
 * bibliográficas são injetadas no system prompt automaticamente.
 */
export async function generatePlan(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  groqApiKey: string,
  model: string,
  input: PlanInput,
): Promise<GeneratePlanResponse> {
  const { modalities, onlyFood } = pickRelevantModalities(input);
  const [catalog, references] = await Promise.all([
    onlyFood ? Promise.resolve([]) : fetchCatalog(supabase, modalities),
    fetchReferences(supabase, ['nutricao', 'treino', 'geral']),
  ]);

  if (!onlyFood && catalog.length === 0) {
    return { error: { kind: 'empty_catalog' } };
  }

  const systemPrompt = buildSystemPrompt(modalities, onlyFood);
  const userBlock = buildUserBlock(input, catalog, modalities, onlyFood);
  const referencesBlock = formatReferencesForPrompt(references, {
    mode: 'json_field',
    jsonField: 'rationale',
  });

  const groqRes = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${systemPrompt}${referencesBlock}` },
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
    let detail = errText;
    try {
      const parsed = JSON.parse(errText);
      detail = parsed?.error?.message ?? errText;
    } catch {
      // raw
    }
    if (groqRes.status === 429) {
      return { error: { kind: 'rate_limit' } };
    }
    return {
      error: { kind: 'groq_api_error', status: groqRes.status, detail },
    };
  }

  const groqJson = await groqRes.json();
  const text: string = groqJson?.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonFromText(text) as PlanOut | null;

  if (!parsed) {
    return { error: { kind: 'parse_failed', raw: text.slice(0, 500) } };
  }

  const sanitized = sanitizePlan(parsed, catalog, modalities, onlyFood);
  const totalTokens =
    typeof groqJson?.usage?.total_tokens === 'number'
      ? groqJson.usage.total_tokens
      : null;

  return { plan: sanitized, totalTokens };
}
