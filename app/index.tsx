import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/useUiStore';
import { Logo, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function SplashGate() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const isPromotingProfessor = useUiStore((s) => s.isPromotingProfessor);

  if (isBootstrapping || isPromotingProfessor) {
    return (
      <Screen variant="hero" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-6">
          <Logo size="xl" tagline />
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return isAuthenticated ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
