import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingResultStore } from '@/stores/useOnboardingResultStore';
import { useGenerateOnboardingPlan } from '@/hooks/useOnboarding';
import { useProfile } from '@/hooks/useProfile';
import { captureError } from '@/lib/sentry';
import type { OnboardingInput } from '@/services/onboarding';

const STAGES = [
  'Analisando seu perfil...',
  'Calculando metas nutricionais...',
  'Selecionando exercícios seguros...',
  'Montando suas rotinas...',
];

export default function OnboardingLoading() {
  const router = useRouter();
  const generate = useGenerateOnboardingPlan();
  const profile = useProfile();
  const state = useOnboardingStore();
  const [stage, setStage] = useState(0);
  const triggeredRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 1600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;

    const input: OnboardingInput = {
      full_name: profile.data?.full_name ?? null,
      sex: state.sex,
      birth_year: state.birth_year,
      weight_kg: state.weight_kg,
      height_cm: state.height_cm,
      goal_type: state.goal_type,
      goal_weight_kg: state.goal_weight_kg,
      goal_target_date: state.goal_target_date,
      practices_sport: state.practices_sport,
      sports: state.sports.length ? state.sports : null,
      weekly_frequency: state.weekly_frequency,
      water_goal_ml: state.water_goal_ml,
      allergies: state.allergies.trim() || null,
      physical_limitations: state.physical_limitations.trim() || null,
      bio: state.bio.trim() || null,
    };

    generate
      .mutateAsync(input)
      .then((plan) => {
        useOnboardingResultStore.setState({ plan, input });
        router.replace('/onboarding/resultado' as Href);
      })
      .catch((err) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Tenta de novo em instantes.';
        if (!/limite/i.test(message)) {
          captureError(err, { feature: 'onboarding_plan' });
        }
        Alert.alert(
          'Não consegui gerar o plano',
          message,
          [
            {
              text: 'Tentar de novo',
              onPress: () => {
                triggeredRef.current = false;
                router.replace('/onboarding/loading' as Href);
              },
            },
            {
              text: 'Voltar',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ],
        );
      });
    // Roda uma vez só ao montar — state via closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8 gap-8">
        <Card glow accent="green" padding="lg">
          <View className="items-center gap-4">
            <View className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center">
              <Sparkles size={28} color={colors.accent} />
            </View>
            <Text className="text-text text-xl font-bold text-center">
              Gerando seu plano personalizado
            </Text>
            <Text className="text-text-dim text-sm text-center leading-relaxed">
              A IA está montando metas + treinos sob medida. Isso leva alguns
              segundos.
            </Text>
            <ActivityIndicator color={colors.accent} />
            <Text className="text-accent text-xs font-semibold">
              {STAGES[stage]}
            </Text>
          </View>
        </Card>

        <Text className="text-text-muted text-[11px] text-center leading-relaxed px-4">
          Uso informativo. As recomendações não substituem orientação
          profissional.
        </Text>

        <Button
          label="Cancelar"
          onPress={() => router.back()}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}
