import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelContract,
  createContract,
  getActiveContract,
  listStudentContracts,
  updateContract,
} from '@/services/contracts';
import { queryKeys } from '@/lib/queryKeys';
import type { ContractInput, ContractPatch } from '@/types/database';

export function useStudentContracts(studentId: string | null | undefined) {
  return useQuery({
    queryKey: studentId
      ? queryKeys.studentContracts(studentId)
      : ['student-contracts', 'none'],
    queryFn: () => listStudentContracts(studentId!),
    enabled: !!studentId,
  });
}

export function useActiveContract(studentId: string | null | undefined) {
  return useQuery({
    queryKey: studentId
      ? queryKeys.activeContract(studentId)
      : ['active-contract', 'none'],
    queryFn: () => getActiveContract(studentId!),
    enabled: !!studentId,
  });
}

function invalidateContracts(qc: ReturnType<typeof useQueryClient>, studentId: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.studentContracts(studentId) });
  void qc.invalidateQueries({ queryKey: queryKeys.activeContract(studentId) });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ContractInput) => createContract(input),
    onSuccess: (_data, vars) => {
      invalidateContracts(qc, vars.student_id);
    },
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      studentId: string;
      patch: ContractPatch;
    }) => updateContract(params.id, params.patch),
    onSuccess: (_data, vars) => {
      invalidateContracts(qc, vars.studentId);
    },
  });
}

export function useCancelContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; studentId: string }) =>
      cancelContract(params.id),
    onSuccess: (_data, vars) => {
      invalidateContracts(qc, vars.studentId);
    },
  });
}
