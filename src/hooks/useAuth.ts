import { useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import {
  AuthCancelled,
  deleteMyAccount,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  signUpWithPassword,
  type DeleteMyAccountError,
} from '@/services/auth';
import { useSessionStore } from '@/stores/useSessionStore';

export function useAuthBootstrap() {
  const setSession = useSessionStore((s) => s.setSession);
  const setBootstrapping = useSessionStore((s) => s.setBootstrapping);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setBootstrapping(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [setSession, setBootstrapping]);
}

export function useAuth() {
  const session = useSessionStore((s) => s.session);
  const user = useSessionStore((s) => s.user);
  const isBootstrapping = useSessionStore((s) => s.isBootstrapping);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err instanceof AuthCancelled) return;
      throw err;
    }
  }, []);

  const loginWithEmail = useCallback(
    (email: string, password: string) =>
      signInWithEmailPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    (fullName: string, email: string, password: string) =>
      signUpWithPassword({ fullName, email, password }),
    [],
  );

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  return {
    session,
    user,
    isAuthenticated: !!session,
    isBootstrapping,
    loginWithGoogle,
    loginWithEmail,
    signUp,
    logout,
  };
}

/**
 * Auto-exclusão de conta (LGPD / Play Store / App Store).
 *
 * Após sucesso:
 *   1. `qc.clear()` zera todos os caches (evita refetch zumbi).
 *   2. `signOut()` invalida a sessão local; o token já está inválido
 *      no servidor depois do delete em auth.users.
 *   3. UI deve redirecionar pra `/(auth)/login` no `onSuccess`.
 *
 * Erros conhecidos vêm em `err.info`:
 *   - `has_students` (professor com alunos vinculados → UI mostra
 *     modal de bloqueio)
 *   - `unauthorized` (sessão expirou)
 *   - `unknown` (falha genérica do servidor)
 */
export function useDeleteMyAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string | null) => deleteMyAccount(reason),
    onSuccess: async () => {
      // Ordem importa: clear ANTES de signOut pra não refetch com
      // sessão zumbi enquanto a session ainda existe no estado local.
      qc.clear();
      try {
        await signOut();
      } catch {
        // signOut pode falhar se o token já foi invalidado server-side
        // pelo delete em auth.users — não é crítico.
      }
    },
  });
}

export type { DeleteMyAccountError };
