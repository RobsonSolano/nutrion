import { Redirect, Stack, type Href } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';

export default function OnboardingLayout() {
  const profileQ = useProfile();

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
