import { create } from 'zustand';
import type { OnboardingInput, OnboardingPlan } from '@/services/onboarding';

type ResultState = {
  plan: OnboardingPlan | null;
  input: OnboardingInput | null;
};

/**
 * Transporta o resultado do loading → resultado sem refazer a chamada à IA.
 * É descartável — após o user confirmar, os dados viram profile + rotinas
 * e este store pode ser zerado.
 */
export const useOnboardingResultStore = create<ResultState>(() => ({
  plan: null,
  input: null,
}));
