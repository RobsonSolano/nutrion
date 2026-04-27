import { Alert, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import {
  Flame,
  Beef,
  Droplets,
  Dumbbell,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useOnboardingResultStore } from '@/stores/useOnboardingResultStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useSaveOnboardingResult } from '@/hooks/useOnboarding';
import type { PlanRoutine } from '@/services/onboarding';

export default function OnboardingResultado() {
  const router = useRouter();
  const plan = useOnboardingResultStore((s) => s.plan);
  const input = useOnboardingResultStore((s) => s.input);
  const reset = useOnboardingStore((s) => s.reset);
  const save = useSaveOnboardingResult();

  // Se o usuário abriu essa tela sem ter gerado um plano, volta pra intro.
  if (!plan || !input) {
    return <Redirect href={'/onboarding' as Href} />;
  }

  async function handleConfirm() {
    try {
      if (!plan || !input) return;
      await save.mutateAsync({ input, plan });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      useOnboardingResultStore.setState({ plan: null, input: null });
      reset();
      router.replace('/(tabs)' as Href);
    } catch (err) {
      Alert.alert(
        'Não consegui salvar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  return (
    <Screen variant="hero" edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center mb-3">
            <Sparkles size={26} color={colors.accent} />
          </View>
          <Text className="text-text text-2xl font-bold text-center">
            Seu plano está pronto
          </Text>
          {plan.rationale && (
            <Text className="text-text-dim text-sm text-center mt-2 leading-relaxed px-2">
              {plan.rationale}
            </Text>
          )}
        </View>

        <Card glow accent="green" padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-4">
            Metas diárias
          </Text>
          <View className="gap-3">
            <GoalRow
              icon={<Flame size={16} color={colors.accent} />}
              label="Calorias"
              value={`${plan.calorie_goal} kcal`}
            />
            <GoalRow
              icon={<Beef size={16} color={colors.violet} />}
              label="Proteína"
              value={`${plan.protein_goal_g} g`}
            />
            <GoalRow
              icon={<Droplets size={16} color={colors.info} />}
              label="Água"
              value={`${plan.water_goal_ml} ml`}
            />
          </View>
        </Card>

        {plan.routines.length > 0 && (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Dumbbell size={14} color={colors.text} />
              <Text className="text-text text-base font-semibold">
                {plan.routines.length} treinos sugeridos
              </Text>
            </View>
            {plan.routines.map((r, i) => (
              <RoutinePreview key={i} routine={r} />
            ))}
          </View>
        )}

        <Card padding="sm">
          <Text className="text-text-muted text-[11px] leading-relaxed">
            💡 Você pode editar metas e treinos a qualquer momento no perfil.
            Use isso como ponto de partida — ajuste conforme for evoluindo.
          </Text>
        </Card>

        <Button
          label="Começar minha jornada"
          onPress={handleConfirm}
          loading={save.isPending}
          size="lg"
          icon={<CheckCircle2 size={18} color={colors.textInverse} />}
        />
        <Button
          label="Gerar outro plano"
          onPress={() => router.replace('/onboarding/loading' as Href)}
          variant="ghost"
        />
      </ScrollView>
    </Screen>
  );
}

function GoalRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-text-dim text-sm">{label}</Text>
      </View>
      <Text className="text-text text-base font-bold">{value}</Text>
    </View>
  );
}

function RoutinePreview({ routine }: { routine: PlanRoutine }) {
  return (
    <Card padding="md">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="h-8 w-8 rounded-xl bg-accent/10 border border-accent/30 items-center justify-center">
          <Dumbbell size={14} color={colors.accent} />
        </View>
        <View className="flex-1">
          <Text className="text-text text-sm font-semibold">{routine.name}</Text>
          {routine.description && (
            <Text className="text-text-muted text-[11px]">
              {routine.description}
            </Text>
          )}
        </View>
        <Text className="text-text-dim text-[11px]">
          {routine.exercises.length} exerc.
        </Text>
      </View>
      <View className="gap-1 mt-1">
        {routine.exercises.slice(0, 4).map((ex, i) => (
          <Text
            key={i}
            className="text-text-dim text-[12px]"
            numberOfLines={1}
          >
            • {ex.exercise_name} — {ex.sets}×{ex.reps_min}-{ex.reps_max}
          </Text>
        ))}
        {routine.exercises.length > 4 && (
          <Text className="text-text-muted text-[11px]">
            + {routine.exercises.length - 4} outros
          </Text>
        )}
      </View>
    </Card>
  );
}
