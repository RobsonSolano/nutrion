import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelRequest,
  createRequest,
  listCoachRequests,
  listMyRequests,
  respondToRequest,
} from '@/services/requests';
import { supabase } from '@/services/supabase';
import {
  getRequestsLastSeen,
  markRequestsSeen,
} from '@/lib/unreadRequests';
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

/**
 * Conta solicitações com resposta do professor (`coach_response IS
 * NOT NULL`) que tiveram updated_at após a última vez que o aluno
 * abriu a tela. "Última vez" fica em AsyncStorage local — sem campo
 * novo no banco.
 *
 * Quando lastSeen é null (nunca abriu), todas com coach_response
 * contam como não-lidas.
 */
const unreadKey = (userId: string, lastSeen: string | null) =>
  ['student_requests_unread', userId, lastSeen ?? 'never'] as const;

export function useUnreadStudentRequests() {
  const { user } = useAuth();
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [lastSeenLoaded, setLastSeenLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLastSeenLoaded(true);
      return;
    }
    void getRequestsLastSeen(user.id).then((v) => {
      setLastSeen(v);
      setLastSeenLoaded(true);
    });
  }, [user?.id]);

  return useQuery({
    queryKey: unreadKey(user?.id ?? 'anon', lastSeen),
    queryFn: async () => {
      if (!user?.id) return 0;
      let q = supabase
        .from('student_requests')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', user.id)
        .not('coach_response', 'is', null);
      if (lastSeen) q = q.gt('updated_at', lastSeen);
      const { count, error } = await q;
      if (error) {
        console.warn('[unread] count error:', error.message);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!user?.id && lastSeenLoaded,
    staleTime: 30_000,
  });
}

/**
 * Marca solicitações como vistas e invalida o badge. Chamado quando
 * o aluno abre /solicitacoes.
 */
export function useMarkRequestsSeen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return async () => {
    if (!user?.id) return;
    await markRequestsSeen(user.id);
    void qc.invalidateQueries({
      queryKey: ['student_requests_unread', user.id],
    });
  };
}
