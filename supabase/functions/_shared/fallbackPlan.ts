// Plano de fallback usado quando Groq está fora ou em rate-limit.
// Não substitui um plano por IA — é uma rede de segurança pro user não
// ficar travado no onboarding/regeneração com erro.
//
// Estratégia: macros via Mifflin-St Jeor com ajuste leve por goal_type,
// hidratação em 35ml/kg, 3 rotinas Full Body A/B/C usando exercícios
// compostos do catálogo (peso corporal/livre quando possível pra cobrir
// qualquer setup).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanInput, PlanOut, RoutineOut } from './plan-generator.ts';

const FALLBACK_RATIONALE = `**Plano gerado em modo de segurança.** Por instabilidade momentânea na IA, geramos um plano base seguro pra você não ficar parado. Quando quiser, regenere pra ter um plano 100% personalizado.

- **Treinos:** 3 sessões Full Body A/B/C com exercícios compostos. Volume e intensidade conservadores.
- **Nutrição:** TMB calculada com Mifflin-St Jeor, ajustada ao seu objetivo.
- **Hidratação:** ~35 ml por kg de peso corporal.

> Esse plano é genérico e baseado em recomendações gerais. Pra contexto e contraindicações específicas, regenere quando voltar ao normal ou consulte um profissional.`;

/** Tenta carregar 3 rotinas Full Body do catálogo. Se faltar exercício,
 *  reduz/pula sets pra não quebrar. */
export async function buildFallbackPlan(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  input: PlanInput,
): Promise<PlanOut> {
  const weight = input.weight_kg ?? 70;
  const height = input.height_cm ?? 170;
  const age =
    input.birth_year != null ? new Date().getFullYear() - input.birth_year : 30;
  const sexMale = input.sex === 'm';

  // Mifflin-St Jeor
  const bmr = sexMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // Fator de atividade conservador (sedentário+)
  const tdee = bmr * 1.4;

  // Ajuste por objetivo
  let calorie_goal = tdee;
  if (input.goal_type === 'lose_fat' || input.goal_type === 'reduce_body_fat') {
    calorie_goal = tdee - 400; // déficit moderado
  } else if (input.goal_type === 'gain_muscle') {
    calorie_goal = tdee + 250; // superávit leve
  }

  const protein_goal_g = Math.round(weight * 1.8);
  const water_goal_ml = Math.round(weight * 35);

  // Tenta carregar exercícios pra montar 3 rotinas Full Body
  const routines = await buildFallbackRoutines(supabase);

  return {
    calorie_goal: Math.round(calorie_goal),
    protein_goal_g,
    water_goal_ml,
    routines,
    rationale: FALLBACK_RATIONALE,
  };
}

async function buildFallbackRoutines(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
): Promise<RoutineOut[]> {
  // Selecionar exercícios por nome canônico (são os do seed). Se algum
  // não estiver no banco, vira null e a routine pula esse exercício.
  const wanted = [
    // Full Body A — push + perna
    { name: 'Supino reto (halteres)', sets: 3, repsMin: 8, repsMax: 12 },
    { name: 'Agachamento livre (barra)', sets: 3, repsMin: 8, repsMax: 12 },
    { name: 'Desenvolvimento (halteres)', sets: 3, repsMin: 8, repsMax: 12 },
    { name: 'Flexão de braço', sets: 2, repsMin: 8, repsMax: 15 },
    { name: 'Prancha (frontal)', sets: 3, repsMin: 30, repsMax: 60 },
    // Full Body B — pull + perna
    { name: 'Remada curvada (halteres)', sets: 3, repsMin: 8, repsMax: 12 },
    { name: 'Levantamento terra (barra)', sets: 3, repsMin: 5, repsMax: 8 },
    { name: 'Rosca direta (halteres)', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Barra fixa (pronada)', sets: 2, repsMin: 5, repsMax: 10 },
    { name: 'Abdominal supra', sets: 3, repsMin: 12, repsMax: 20 },
    // Full Body C — pernas + core
    { name: 'Afundo (halteres)', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Stiff (halteres)', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Panturrilha em pé (máquina)', sets: 3, repsMin: 12, repsMax: 15 },
    { name: 'Tríceps corda (pulley)', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Russian twist', sets: 3, repsMin: 15, repsMax: 25 },
  ];

  const { data } = await supabase
    .from('exercises')
    .select('id, name, equipment')
    .in('name', wanted.map((w) => w.name));

  const byName = new Map((data ?? []).map((e) => [e.name as string, e]));

  const build = (
    name: string,
    group_slug: string,
    items: typeof wanted,
  ): RoutineOut => ({
    name,
    modality: 'musculacao',
    group_slug,
    description: 'Rotina full body gerada em modo de segurança.',
    exercises: items
      .map((w) => {
        const e = byName.get(w.name);
        if (!e) return null;
        return {
          exercise_id: e.id as string,
          exercise_name: e.name as string,
          equipment: (e.equipment as string | null) ?? null,
          sets: w.sets,
          reps_min: w.repsMin,
          reps_max: w.repsMax,
          weight_min_kg: null,
          weight_max_kg: null,
          duration_min: null,
          notes: null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  });

  return [
    build('Full Body A', 'full_body', wanted.slice(0, 5)),
    build('Full Body B', 'full_body', wanted.slice(5, 10)),
    build('Full Body C', 'full_body', wanted.slice(10, 15)),
  ].filter((r) => r.exercises.length > 0);
}
