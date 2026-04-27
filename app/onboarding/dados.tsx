import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { OnboardingLayout, MultiSelectChips } from '@/components/onboarding';
import { Input } from '@/components/ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import type { Sex } from '@/types/database';

const SEX_OPTIONS = [
  { value: 'm', label: 'Masculino' },
  { value: 'f', label: 'Feminino' },
  { value: 'o', label: 'Outro' },
];

function initialAgeText(birth_year: number | null): string {
  if (!birth_year) return '';
  const age = new Date().getFullYear() - birth_year;
  return age > 0 && age < 120 ? String(age) : '';
}

function parseDecimal(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function OnboardingDados() {
  const router = useRouter();
  const {
    sex,
    birth_year,
    weight_kg,
    height_cm,
    patch,
  } = useOnboardingStore();

  const ageRef = useRef<TextInput>(null);
  const weightRef = useRef<TextInput>(null);
  const heightRef = useRef<TextInput>(null);

  // Inputs numéricos mantêm a string digitada pelo usuário em state local.
  // Só disparamos patch() no store quando o valor for parseable — isso evita
  // que dígitos intermediários (ex: "1" enquanto ainda não virou "18") sejam
  // descartados e resetem o campo.
  const [ageText, setAgeText] = useState(() => initialAgeText(birth_year));
  const [weightText, setWeightText] = useState(() =>
    weight_kg != null ? String(weight_kg) : '',
  );
  const [heightText, setHeightText] = useState(() =>
    height_cm != null ? String(height_cm) : '',
  );

  function handleAgeChange(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 3);
    setAgeText(digits);
    const n = Number(digits);
    if (Number.isFinite(n) && n >= 10 && n <= 110) {
      patch({ birth_year: new Date().getFullYear() - n });
    } else {
      patch({ birth_year: null });
    }
  }

  function handleWeightChange(v: string) {
    setWeightText(v);
    patch({ weight_kg: parseDecimal(v) });
  }

  function handleHeightChange(v: string) {
    setHeightText(v);
    patch({ height_cm: parseDecimal(v) });
  }

  const canContinue =
    !!sex && !!birth_year && !!weight_kg && !!height_cm;

  return (
    <OnboardingLayout
      step={1}
      total={6}
      title="Seus dados"
      subtitle="Isso serve pra calcular caloria e proteína com precisão."
      onBack={() => router.back()}
      onSkip={() => router.replace('/(tabs)' as Href)}
      onContinue={() => router.push('/onboarding/objetivo' as Href)}
      continueDisabled={!canContinue}
    >
      <View className="gap-4">
        <View>
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Sexo
          </Text>
          <MultiSelectChips
            single
            options={SEX_OPTIONS}
            selected={sex ? [sex] : []}
            onToggle={(v) => patch({ sex: v as Sex })}
          />
        </View>

        <View className="flex-row gap-3">
          <View style={{ flex: 1 }}>
            <Input
              ref={ageRef}
              label="Idade"
              value={ageText}
              onChangeText={handleAgeChange}
              placeholder="30"
              keyboardType="number-pad"
              returnKeyType="next"
              onSubmitEditing={() => weightRef.current?.focus()}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              ref={weightRef}
              label="Peso (kg)"
              value={weightText}
              onChangeText={handleWeightChange}
              placeholder="78"
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => heightRef.current?.focus()}
            />
          </View>
        </View>

        <View>
          <Input
            ref={heightRef}
            label="Altura (cm)"
            value={heightText}
            onChangeText={handleHeightChange}
            placeholder="178"
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}
