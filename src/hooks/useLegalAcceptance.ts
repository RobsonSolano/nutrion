import { useQuery } from '@tanstack/react-query';
import { hasAcceptedRequiredLegal } from '@/services/legal';
import { useAuth } from './useAuth';

/**
 * Gate de aceite legal pós-login. Enabled só com sessão. Enquanto resolve,
 * `isChecking` é true (o SplashGate espera antes de rotear, pra não piscar as
 * tabs e voltar). `needsAcceptance` = usuário logado que ainda não aceitou.
 */
export function useLegalAcceptance() {
  const { user } = useAuth();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ['legal-acceptance', userId ?? 'none'],
    queryFn: hasAcceptedRequiredLegal,
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  return {
    // Só bloqueia quando o check resolveu como `false` (não aceito).
    needsAcceptance: q.data === false,
    isChecking: !!userId && q.isLoading,
  };
}
