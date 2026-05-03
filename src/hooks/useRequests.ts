import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRequest,
  createRequest,
  listCoachRequests,
  listMyRequests,
  respondToRequest,
} from '@/services/requests';
import type { StudentRequestStatus } from '@/types/database';
import { useAuth } from './useAuth';

const myRequestsKey = (userId: string) => ['student_requests', 'mine', userId];
const coachRequestsKey = (
  userId: string,
  status: StudentRequestStatus | 'all',
) => ['student_requests', 'coach', userId, status];

export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: myRequestsKey(user?.id ?? 'anon'),
    queryFn: listMyRequests,
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useCoachRequests(
  status: StudentRequestStatus | 'all' = 'all',
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: coachRequestsKey(user?.id ?? 'anon', status),
    queryFn: () => listCoachRequests(status),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useCreateRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => createRequest(message),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: myRequestsKey(user.id) });
      }
    },
  });
}

export function useCancelRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelRequest(requestId),
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({ queryKey: myRequestsKey(user.id) });
      }
    },
  });
}

export function useRespondToRequest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: respondToRequest,
    onSuccess: () => {
      if (user?.id) {
        void qc.invalidateQueries({
          queryKey: ['student_requests', 'coach', user.id],
        });
      }
    },
  });
}
