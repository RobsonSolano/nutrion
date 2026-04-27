import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { OnboardingLayout, CharCounter } from '@/components/onboarding';
import { Input } from '@/components/ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

const MAX_BIO = 255;

export default function OnboardingBio() {
  const router = useRouter();
  const { bio, patch } = useOnboardingStore();

  function setBio(v: string) {
    if (v.length > MAX_BIO) return;
    patch({ bio: v });
  }

  return (
    <OnboardingLayout
      step={5}
      total={6}
      title="Conta um pouco sobre você"
      subtitle="Rotina, horários, o que te motiva. Quanto mais contexto, mais personalizado."
      onBack={() => router.back()}
      onSkip={() => router.replace('/(tabs)' as Href)}
      onContinue={() => router.push('/onboarding/loading' as Href)}
    >
      <View className="gap-2">
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="Ex: trabalho sentado 8h, durmo ~6h, treino à noite. Busco hipertrofia com foco em peito e ombro."
          multiline
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
        <CharCounter value={bio} max={MAX_BIO} />
        <Text className="text-text-muted text-[11px] leading-relaxed">
          Dica: foque no que impacta sua rotina — horário de treino, sono,
          trabalho, nível de estresse, histórico de lesões.
        </Text>
      </View>
    </OnboardingLayout>
  );
}
