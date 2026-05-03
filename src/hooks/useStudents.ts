import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStudent,
  generatePlanForStudent,
  getStudentDetail,
  listStudents,
  saveStudentPlan,
  sendStudentCredentials,
  type CreateStudentInput,
} from '@/services/students';
import type { OnboardingPlan } from '@/services/onboarding';
import { useAuth } from './useAuth';

const studentsKey = (coachId: string) => ['students', coachId] as const;
const studentDetailKey = (studentId: string) =>
  ['student_detail', studentId] as const;

export function useStudents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: studentsKey(user?.id ?? 'anon'),
    queryFn: listStudents,
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useStudentDetail(studentId: string | null) {
  return useQuery({
    queryKey: studentDetailKey(studentId ?? 'none'),
    queryFn: () => {
      if (!studentId) throw new Error('student_id ausente');
      return getStudentDetail(studentId);
    },
    enabled: !!studentId,
    staleTime: 15_000,
  });
}

export function useCreateStudent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => createStudent(input),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: studentsKey(user.id) });
      }
    },
  });
}

export function useGenerateStudentPlan() {
  return useMutation({
    mutationFn: (studentId: string) => generatePlanForStudent(studentId),
  });
}

export function useSaveStudentPlan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { studentId: string; plan: OnboardingPlan }) =>
      saveStudentPlan(params.studentId, params.plan),
    onSuccess: (_data, vars) => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: studentsKey(user.id) });
      }
      void qc.invalidateQueries({
        queryKey: studentDetailKey(vars.studentId),
      });
    },
  });
}

export function useSendStudentCredentials() {
  return useMutation({
    mutationFn: (params: { studentId: string; password: string }) =>
      sendStudentCredentials(params.studentId, params.password),
  });
}
