import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { OnboardingLayout, CharCounter } from '@/components/onboarding';
import { ConfirmModal, Input } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

const MAX_BIO = 500;

export default function OnboardingBio() {
  const router = useRouter();
  const { bio, patch } = useOnboardingStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function setBio(v: string) {
    if (v.length > MAX_BIO) return;
    patch({ bio: v });
  }

  return (
    <>
      <OnboardingLayout
        step={5}
        total={6}
        title="Conta um pouco sobre você"
        subtitle="Rotina, horários, o que te motiva. Quanto mais contexto, mais personalizado."
        onBack={() => router.back()}
        onSkip={() => router.replace('/(tabs)' as Href)}
        onContinue={() => setConfirmOpen(true)}
      >
        <View className="gap-2">
          <Input
            value={bio}
            onChangeText={setBio}
            placeholder="Ex: trabalho sentado 8h, durmo ~6h, treino à noite. Busco hipertrofia com foco em peito e ombro."
            multiline
            style={{ minHeight: 180, textAlignVertical: 'top' }}
          />
          <CharCounter value={bio} max={MAX_BIO} />
          <Text className="text-text-muted text-[11px] leading-relaxed">
            Dica: foque no que impacta sua rotina — horário de treino, sono,
            trabalho, nível de estresse, histórico de lesões.
          </Text>
        </View>
      </OnboardingLayout>

      <ConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Gerar plano agora?"
        message="A IA vai montar suas metas e treinos com base nas respostas. Depois de iniciar, não dá pra voltar e revisar os dados — só refazer pelo perfil (1 vez por dia)."
        icon={<Sparkles size={26} color={colors.accent} />}
        actions={[
          {
            label: 'Gerar plano',
            variant: 'primary',
            onPress: () => {
              setConfirmOpen(false);
              router.push('/onboarding/loading' as Href);
            },
          },
          {
            label: 'Revisar antes',
            variant: 'ghost',
            onPress: () => setConfirmOpen(false),
          },
        ]}
      />
    </>
  );
}
