import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

type SessionState = {
  session: Session | null;
  user: User | null;
  isBootstrapping: boolean;
  setSession: (session: Session | null) => void;
  setBootstrapping: (value: boolean) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  user: null,
  isBootstrapping: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setBootstrapping: (value) => set({ isBootstrapping: value }),
}));
