import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';

/**
 * Rede de segurança: ao abrir a home do professor, reconcilia o acesso dos
 * alunos (caso um webhook de downgrade/upgrade tenha falhado). Invalida a
 * lista de alunos depois pra refletir suspensões/reativações.
 */
export function useCoachAccessSync(): void {
  const { user } = useAuth();
  const qc = useQueryClient();

  useQuery({
    queryKey: ['coach-access-sync', user?.id ?? 'none'],
    queryFn: async () => {
      const { error } = await supabase.rpc('sync_coach_student_access', {
        p_coach_id: user!.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['students', user!.id] });
      return true;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
