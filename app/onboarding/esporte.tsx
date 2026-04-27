import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { OnboardingLayout, MultiSelectChips } from '@/components/onboarding';
import { Card } from '@/components/ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import type { WeeklyFrequency } from '@/types/database';

const SPORTS_CURRENT = [
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'calistenia', label: '🤸 Calistenia' },
  { value: 'danca', label: '💃 Dança' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'ciclismo', label: '🚴 Ciclismo' },
  { value: 'powerlifting', label: '💪 Powerlifting' },
  { value: 'crossfit', label: '🔥 CrossFit' },
  { value: 'luta', label: '🥊 Luta' },
  { value: 'natacao', label: '🏊 Natação' },
  { value: 'outro', label: '🎯 Outro' },
];

const SPORTS_PLAN = [
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'calistenia', label: '🤸 Calistenia' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'danca', label: '💃 Dança' },
  { value: 'nenhum', label: '🍎 Apenas alimentação' },
];

const FREQUENCY_OPTIONS: WeeklyFrequency[] = [
  '1-2',
  '2-3',
  '3-4',
  '4-5',
  '5-6',
  '6-7',
];

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
];

export default function OnboardingEsporte() {
  const router = useRouter();
  const {
    practices_sport,
    sports,
    weekly_frequency,
    patch,
    toggleSport,
  } = useOnboardingStore();

  const practicesSportValue =
    practices_sport === true ? ['yes'] : practices_sport === false ? ['no'] : [];

  function setPracticesSport(v: string) {
    patch({ practices_sport: v === 'yes', sports: [] });
  }

  const hasSportSelected = sports.length > 0;
  const onlyFood = practices_sport === false && sports.includes('nenhum');
  const needsFrequency = !onlyFood;
  const canContinue =
    practices_sport != null &&
    hasSportSelected &&
    (!needsFrequency || !!weekly_frequency);

  return (
    <OnboardingLayout
      step={3}
      total={6}
      title="Sua relação com esporte"
      subtitle="Isso define o tipo e a intensidade dos treinos sugeridos."
      onBack={() => router.back()}
      onSkip={() => router.replace('/(tabs)' as Href)}
      onContinue={() => router.push('/onboarding/habitos' as Href)}
      continueDisabled={!canContinue}
    >
      <View>
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Pratica algum esporte hoje?
        </Text>
        <MultiSelectChips
          single
          options={YES_NO_OPTIONS}
          selected={practicesSportValue}
          onToggle={setPracticesSport}
        />
      </View>

      {practices_sport === true && (
        <View className="gap-3">
          <Text className="text-text-dim text-xs uppercase tracking-widest">
            Quais?
          </Text>
          <MultiSelectChips
            options={SPORTS_CURRENT}
            selected={sports}
            onToggle={toggleSport}
          />
        </View>
      )}

      {practices_sport === false && (
        <View className="gap-3">
          <Text className="text-text-dim text-xs uppercase tracking-widest">
            Pretende iniciar?
          </Text>
          <MultiSelectChips
            single
            options={SPORTS_PLAN}
            selected={sports}
            onToggle={(v) => patch({ sports: sports.includes(v) ? [] : [v] })}
          />
        </View>
      )}

      {needsFrequency && hasSportSelected && (
        <View className="gap-3">
          <Text className="text-text-dim text-xs uppercase tracking-widest">
            Quantas vezes por semana?
          </Text>
          <MultiSelectChips
            single
            options={FREQUENCY_OPTIONS.map((f) => ({
              value: f,
              label: `${f}x`,
            }))}
            selected={weekly_frequency ? [weekly_frequency] : []}
            onToggle={(v) => patch({ weekly_frequency: v as WeeklyFrequency })}
          />
        </View>
      )}

      <Card padding="sm">
        <Text className="text-text-muted text-[11px] leading-relaxed">
          💡 Sem treino também é plano. A IA entrega só as metas de caloria,
          proteína e água — sem rotinas — quando você escolhe &quot;apenas
          alimentação&quot;.
        </Text>
      </Card>
    </OnboardingLayout>
  );
}
