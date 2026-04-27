/**
 * Helpers biométricos baseados em peso, altura e metas.
 * Fórmulas consagradas na literatura de nutrição esportiva.
 */

export type BmiCategory = {
  label: string;
  color: string;
  description: string;
};

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) {
    return {
      label: 'Abaixo do peso',
      color: '#38BDF8',
      description: 'Considere aumento calórico com acompanhamento.',
    };
  }
  if (value < 25) {
    return {
      label: 'Peso saudável',
      color: '#39FF14',
      description: 'Faixa de referência ideal.',
    };
  }
  if (value < 30) {
    return {
      label: 'Sobrepeso',
      color: '#F59E0B',
      description: 'Déficit calórico moderado com treino regular.',
    };
  }
  return {
    label: 'Obesidade',
    color: '#F43F5E',
    description: 'Acompanhamento profissional recomendado.',
  };
}

/**
 * Mifflin-St Jeor — Taxa Metabólica Basal (TMB).
 * Assume estilo de vida moderadamente ativo (×1.55) para derivar calorias
 * diárias alvo de manutenção. Ajustes de déficit/superávit ficam a cargo
 * do nutricionista.
 */
export function suggestedCalories(params: {
  weightKg: number;
  heightCm: number;
  ageYears?: number;
  sex?: 'm' | 'f';
}): number | null {
  const { weightKg, heightCm, ageYears = 30, sex = 'm' } = params;
  if (!weightKg || !heightCm) return null;

  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const bmr = sex === 'm' ? base + 5 : base - 161;
  const activity = 1.55; // moderadamente ativo
  return Math.round(bmr * activity);
}

/**
 * Proteína sugerida para quem treina força: 1.8g/kg de peso corporal.
 * Referência: ISSN Position Stand 2017.
 */
export function suggestedProtein(weightKg: number): number | null {
  if (!weightKg) return null;
  return Math.round(weightKg * 1.8);
}

/**
 * Hidratação sugerida: 35ml/kg/dia.
 */
export function suggestedWater(weightKg: number): number | null {
  if (!weightKg) return null;
  return Math.round(weightKg * 35);
}
