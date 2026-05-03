import { useQuery } from '@tanstack/react-query';
import {
  getPlanRevisionDetail,
  listStudentPlanRevisions,
} from '@/services/planHistory';

export function useStudentPlanRevisions(studentId: string | null) {
  return useQuery({
    queryKey: ['plan_revisions', studentId ?? 'none'] as const,
    queryFn: () => {
      if (!studentId) throw new Error('student_id ausente');
      return listStudentPlanRevisions(studentId);
    },
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

export function usePlanRevisionDetail(revisionId: string | null) {
  return useQuery({
    queryKey: ['plan_revision_detail', revisionId ?? 'none'] as const,
    queryFn: () => {
      if (!revisionId) throw new Error('revision_id ausente');
      return getPlanRevisionDetail(revisionId);
    },
    enabled: !!revisionId,
    staleTime: Infinity, // revision é imutável
  });
}
