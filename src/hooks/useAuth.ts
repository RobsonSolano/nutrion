import { useCallback, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import {
  AuthCancelled,
  signInWithEmailPassword,
  signInWithGoogle,
  signOut,
  signUpWithPassword,
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
