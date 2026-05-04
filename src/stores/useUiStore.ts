import { create } from 'zustand';

type UiState = {
  /**
   * Quando true, gates de redirect (auth, tabs, onboarding) seguram a
   * navegação automática. Usado durante o signup-professor pra evitar
   * que o user veja a tela de onboarding piscar antes de ser
   * promovido a professor e redirecionado pra /(coach).
   */
  isPromotingProfessor: boolean;
  setPromotingProfessor: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isPromotingProfessor: false,
  setPromotingProfessor: (v) => set({ isPromotingProfessor: v }),
}));
