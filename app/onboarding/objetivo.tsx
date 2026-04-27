import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Flame,
  Anchor,
  Dumbbell,
  Scale,
} from 'lucide-react-native';
import { OnboardingLayout, OptionCard } from '@/components/onboarding';
import { Input } from '@/components/ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { colors } from '@/lib/theme';
import type { GoalType } from '@/types/database';

const GOAL_OPTIONS: {
  value: GoalType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'lose_fat',
    label: 'Emagrecer',
    description: 'Reduzir peso corporal com déficit calórico',
    icon: <Flame size={18} color={colors.accent} />,
  },
  {
    value: 'maintain',
    label: 'Manter peso',
    description: 'Preservar o peso atual, evoluir composição',
    icon: <Anchor size={18} color={colors.accent} />,
  },
  {
    value: 'gain_muscle',
    label: 'Ganhar massa',
    description: 'Hipertrofia com leve superávit calórico',
    icon: <Dumbbell size={18} color={colors.accent} />,
  },
  {
    value: 'reduce_body_fat',
    label: 'Reduzir gordura',
    description: 'Recomposição: mais músculo, menos gordura',
    icon: <Scale size={18} color={colors.accent} />,
  },
];

export default function OnboardingObjetivo() {
  const router = useRouter();
  const { goal_type, goal_weight_kg, goal_target_date, patch } =
    useOnboardingStore();

  // Preserva exatamente o que o usuário está digitando; o valor no store só
  // é atualizado quando o texto for parseable.
  const [goalWeightText, setGoalWeightText] = useState(() =>
    goal_weight_kg != null ? String(goal_weight_kg) : '',
  );
  const [targetDateText, setTargetDateText] = useState(() =>
    displayDate(goal_target_date),
  );

  function handleGoalWeightChange(v: string) {
    setGoalWeightText(v);
    const n = Number(v.replace(',', '.'));
    patch({ goal_weight_kg: Number.isFinite(n) && n > 0 ? n : null });
  }

  function handleTargetDateChange(v: string) {
    // Formata automaticamente dd/mm/aaaa enquanto o usuário digita:
    // aceita só dígitos, insere barras em 2 e 5 caracteres.
    const digits = v.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setTargetDateText(formatted);
    patch({ goal_target_date: digits.length === 8 ? normalizeDate(formatted) : null });
  }

  const canContinue = !!goal_type;

  return (
    <OnboardingLayout
      step={2}
      total={6}
      title="Qual seu objetivo?"
      subtitle="Isso orienta o déficit/superávit calórico e o estilo de treino."
      onBack={() => router.back()}
      onSkip={() => router.replace('/(tabs)' as Href)}
      onContinue={() => router.push('/onboarding/esporte' as Href)}
      continueDisabled={!canContinue}
    >
      <View className="gap-3">
        {GOAL_OPTIONS.map((opt) => (
          <OptionCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
            selected={goal_type === opt.value}
            onPress={() => patch({ goal_type: opt.value })}
          />
        ))}
      </View>

      <View className="mt-2 gap-3">
        <Text className="text-text-dim text-xs uppercase tracking-widest">
          Meta (opcional)
        </Text>
        <View className="flex-row gap-3">
          <View style={{ flex: 1 }}>
            <Input
              label="Peso-alvo (kg)"
              value={goalWeightText}
              onChangeText={handleGoalWeightChange}
              placeholder="72"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Até quando"
              value={targetDateText}
              onChangeText={handleTargetDateChange}
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>
        <Text className="text-text-muted text-[11px]">
          Deixe em branco se ainda não tem prazo definido.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

function normalizeDate(v: string): string | null {
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // dd/mm/yyyy
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function displayDate(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
