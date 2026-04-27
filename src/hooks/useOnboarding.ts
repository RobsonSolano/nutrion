import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateOnboardingPlan,
  markOnboardingSkipped,
  resetOnboarding,
  saveOnboardingResult,
  type OnboardingInput,
  type OnboardingPlan,
} from '@/services/onboarding';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';

export function useGenerateOnboardingPlan() {
  return useMutation({
    mutationFn: (input: OnboardingInput) => generateOnboardingPlan(input),
  });
}

export function useSaveOnboardingResult() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { input: OnboardingInput; plan: OnboardingPlan }) => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return saveOnboardingResult({ userId: user.id, ...params });
    },
    onSuccess: (res) => {
      if (!user?.id) return;
      qc.setQueryData(queryKeys.profile(user.id), res.profile);
      void qc.invalidateQueries({ queryKey: queryKeys.routines(user.id) });
    },
  });
}

export function useSkipOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return markOnboardingSkipped(user.id);
    },
    onSuccess: (profile) => {
      if (!user?.id) return;
      qc.setQueryData(queryKeys.profile(user.id), profile);
    },
  });
}

export function useResetOnboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sessão expirada.');
      return resetOnboarding(user.id);
    },
    onSuccess: (profile) => {
      if (!user?.id) return;
      qc.setQueryData(queryKeys.profile(user.id), profile);
    },
  });
}
