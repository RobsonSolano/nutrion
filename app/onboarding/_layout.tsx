import { Redirect, Stack, type Href } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { useUiStore } from '@/stores/useUiStore';

export default function OnboardingLayout() {
  const profileQ = useProfile();
  const isPromotingProfessor = useUiStore((s) => s.isPromotingProfessor);

  // Trava redirects durante signup-professor — sem isso o onboarding
  // pisca brevemente enquanto a promoção a role=professor está em curso.
  if (isPromotingProfessor) return null;

  // Professor não usa onboarding (que é o fluxo de IA pra gerar plano
  // pessoal). Se chegar aqui por qualquer caminho, redireciona pra
  // área do professor.
  if (profileQ.data?.role === 'professor') {
    return <Redirect href={'/(coach)' as Href} />;
  }

  // Aluno também não — o plano é gerado pelo professor dele.
  if (profileQ.data?.role === 'aluno') {
    return <Redirect href={'/(tabs)' as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        animation: 'slide_from_right',
      }}
    />
  );
}
