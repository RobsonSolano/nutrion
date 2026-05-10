// Helper: converte a row crua de student_anamneses num texto compacto
// pra usar como contexto no prompt da IA (coach-generate-plan,
// onboarding-plan). Omite campos vazios pra não poluir.
//
// Decisões de produto:
// - medications NÃO entra (risco de IA alucinar contraindicação).
// - allergy_medication e allergy_environmental NÃO entram (não afeta
//   plano de treino/nutrição).
// - emergency_contact_* NÃO entra (não tem uso na geração).

type Surgery = { date: string; type: string; notes?: string };

type AnamneseRow = {
  injuries: string[] | null;
  injuries_notes: string | null;
  surgeries: Surgery[] | null;
  chronic_conditions: string[] | null;
  chronic_conditions_notes: string | null;
  allergy_food: string | null;
  dietary_restrictions: string[] | null;
  dietary_notes: string | null;
  sport_history: string | null;
  goal_notes: string | null;
  has_medical_clearance: boolean | null;
  medical_clearance_notes: string | null;
};

const INJURY_LABEL: Record<string, string> = {
  ombro_d: 'ombro direito',
  ombro_e: 'ombro esquerdo',
  cotovelo_d: 'cotovelo direito',
  cotovelo_e: 'cotovelo esquerdo',
  punho_d: 'punho direito',
  punho_e: 'punho esquerdo',
  lombar: 'lombar',
  cervical: 'cervical',
  quadril_d: 'quadril direito',
  quadril_e: 'quadril esquerdo',
  joelho_d: 'joelho direito',
  joelho_e: 'joelho esquerdo',
  tornozelo_d: 'tornozelo direito',
  tornozelo_e: 'tornozelo esquerdo',
  outros: 'outros',
};

const CONDITION_LABEL: Record<string, string> = {
  hipertensao: 'hipertensão',
  diabetes_t1: 'diabetes tipo 1',
  diabetes_t2: 'diabetes tipo 2',
  hipotireoidismo: 'hipotireoidismo',
  hipertireoidismo: 'hipertireoidismo',
  asma: 'asma',
  cardiopatia: 'cardiopatia',
  dislipidemia: 'dislipidemia',
  artrose: 'artrose',
  artrite: 'artrite',
  fibromialgia: 'fibromialgia',
  epilepsia: 'epilepsia',
  depressao: 'depressão',
  ansiedade: 'ansiedade',
  outros: 'outras condições',
};

const DIET_LABEL: Record<string, string> = {
  vegetariano: 'vegetariano',
  vegano: 'vegano',
  ovolactovegetariano: 'ovolactovegetariano',
  pescetariano: 'pescetariano',
  sem_gluten: 'sem glúten',
  sem_lactose: 'sem lactose',
  low_carb: 'low carb',
  kosher: 'kosher',
  halal: 'halal',
  jejum_intermitente: 'jejum intermitente',
  outros: 'outras restrições',
};

export function formatAnamneseForPrompt(
  a: AnamneseRow | null | undefined,
): string | null {
  if (!a) return null;
  const lines: string[] = [];

  if (a.injuries && a.injuries.length > 0) {
    const labels = a.injuries.map((t) => INJURY_LABEL[t] ?? t).join(', ');
    const notes = truncate(a.injuries_notes, 200);
    lines.push(`- Lesões: ${labels}${notes ? ` (${notes})` : ''}`);
  } else if (a.injuries_notes) {
    lines.push(`- Lesões: ${truncate(a.injuries_notes, 200)}`);
  }

  if (a.surgeries && a.surgeries.length > 0) {
    const summary = a.surgeries
      .map((s) => `${s.type}${s.date ? ` (${s.date})` : ''}`)
      .join(', ');
    lines.push(`- Cirurgias prévias: ${truncate(summary, 250)}`);
  }

  if (a.chronic_conditions && a.chronic_conditions.length > 0) {
    const labels = a.chronic_conditions
      .map((t) => CONDITION_LABEL[t] ?? t)
      .join(', ');
    const notes = truncate(a.chronic_conditions_notes, 200);
    lines.push(`- Doenças crônicas: ${labels}${notes ? ` (${notes})` : ''}`);
  }

  if (a.allergy_food) {
    lines.push(`- Alergias alimentares: ${truncate(a.allergy_food, 200)}`);
  }

  if (a.dietary_restrictions && a.dietary_restrictions.length > 0) {
    const labels = a.dietary_restrictions
      .map((t) => DIET_LABEL[t] ?? t)
      .join(', ');
    const notes = truncate(a.dietary_notes, 200);
    lines.push(
      `- Restrições alimentares: ${labels}${notes ? ` (${notes})` : ''}`,
    );
  }

  if (a.sport_history) {
    lines.push(`- Histórico esportivo: ${truncate(a.sport_history, 200)}`);
  }

  if (a.goal_notes) {
    lines.push(`- Objetivo detalhado: ${truncate(a.goal_notes, 200)}`);
  }

  if (a.has_medical_clearance === true) {
    const notes = truncate(a.medical_clearance_notes, 200);
    lines.push(`- Liberação médica: sim${notes ? ` (${notes})` : ''}`);
  } else if (a.has_medical_clearance === false) {
    lines.push('- Liberação médica: não tem');
  }

  if (lines.length === 0) return null;
  return lines.join('\n');
}

export const ANAMNESE_PROMPT_RULES = `Se a anamnese indicar lesão em região X, evite exercícios que sobrecarreguem X (ex: lesão joelho -> evite agachamento profundo, leg press unilateral pesado, salto). Se houver doença crônica cardiovascular sem liberação médica, mantenha intensidade moderada (RPE máx 7) e priorize aeróbio leve. Se houver restrição alimentar, reflita nas metas (ex: sem lactose -> não sugerir whey de leite).`;

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
}
