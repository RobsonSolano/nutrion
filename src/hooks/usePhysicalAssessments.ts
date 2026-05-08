import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAssessment,
  deleteAssessment,
  getAssessment,
  getLatestAssessment,
  listAssessments,
  updateAssessment,
} from '@/services/physicalAssessments';
import { queryKeys } from '@/lib/queryKeys';
import type {
  PhysicalAssessmentInput,
  PhysicalAssessmentPatch,
} from '@/types/database';

export function usePhysicalAssessments(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.physicalAssessments(studentId ?? 'none'),
    queryFn: () => {
      if (!studentId) throw new Error('student_id ausente');
      return listAssessments(studentId);
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export function usePhysicalAssessment(assessmentId: string | null) {
  return useQuery({
    queryKey: queryKeys.physicalAssessmentDetail(assessmentId ?? 'none'),
    queryFn: () => {
      if (!assessmentId) throw new Error('assessment_id ausente');
      return getAssessment(assessmentId);
    },
    enabled: !!assessmentId,
    staleTime: 30_000,
  });
}

export function useLatestPhysicalAssessment(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.latestPhysicalAssessment(studentId ?? 'none'),
    queryFn: () => {
      if (!studentId) throw new Error('student_id ausente');
      return getLatestAssessment(studentId);
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export function useCreatePhysicalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PhysicalAssessmentInput) => createAssessment(input),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.physicalAssessments(vars.student_id),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.latestPhysicalAssessment(vars.student_id),
      });
    },
  });
}

export function useUpdatePhysicalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      assessmentId: string;
      studentId: string;
      patch: PhysicalAssessmentPatch;
    }) => updateAssessment(params.assessmentId, params.patch),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.physicalAssessments(vars.studentId),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.physicalAssessmentDetail(vars.assessmentId),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.latestPhysicalAssessment(vars.studentId),
      });
    },
  });
}

export function useDeletePhysicalAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { assessmentId: string; studentId: string }) =>
      deleteAssessment(params.assessmentId),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.physicalAssessments(vars.studentId),
      });
      void qc.invalidateQueries({
        queryKey: queryKeys.latestPhysicalAssessment(vars.studentId),
      });
    },
  });
}
