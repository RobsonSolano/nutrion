import { ActivityIndicator, View } from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useLegalAcceptance } from '@/hooks/useLegalAcceptance';
import { useUiStore } from '@/stores/useUiStore';
import { Logo, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function SplashGate() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const isPromotingProfessor = useUiStore((s) => s.isPromotingProfessor);
  const { needsAcceptance, isChecking } = useLegalAcceptance();

  const splash = (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-6">
        <Logo size="xl" tagline />
        <ActivityIndicator color={colors.accent} />
      </View>
    </Screen>
  );

  if (isBootstrapping || isPromotingProfessor) return splash;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  // Autenticado: espera o check de aceite antes de rotear (evita piscar as tabs).
  if (isChecking) return splash;
  if (needsAcceptance) return <Redirect href={'/consent' as Href} />;
  return <Redirect href="/(tabs)" />;
}
