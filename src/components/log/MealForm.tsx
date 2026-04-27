import { useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Save, Flame, Utensils, Beef, Wheat, Droplet } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCreateFoodLog } from '@/hooks/useLogMutations';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Button, Card, Input } from '@/components/ui';
import { colors } from '@/lib/theme';

const MEAL_PRESETS = [
  'Café da manhã',
  'Almoço',
  'Lanche',
  'Jantar',
  'Pré-treino',
  'Pós-treino',
];

function toInt(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function MealForm() {
  const router = useRouter();
  const createFood = useCreateFoodLog();
  const kbHeight = useKeyboardHeight();

  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');

  const calRef = useRef<TextInput>(null);
  const protRef = useRef<TextInput>(null);
  const carbRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);

  async function handleSave() {
    const cal = toInt(calories);
    if (cal == null || cal === 0) {
      Alert.alert('Informe as calorias', 'Digite um valor em kcal.');
      return;
    }
    try {
      await createFood.mutateAsync({
        meal_name: mealName.trim() || null,
        description: description.trim() || null,
        calories: cal,
        protein_g: toInt(protein),
        carbs_g: toInt(carbs),
        fats_g: toInt(fats),
        photo_path: null,
        ai_feedback: null,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert(
        'Não consegui salvar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        paddingBottom: 40 + (Platform.OS === 'android' ? kbHeight : 0),
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      <Card>
        <View className="flex-row items-center gap-2 mb-3">
          <Utensils size={16} color={colors.accent} />
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            O que você comeu
          </Text>
        </View>
        <View className="gap-3">
          <Input
            label="Refeição"
            value={mealName}
            onChangeText={setMealName}
            placeholder="Ex: Almoço"
          />
          <View className="flex-row flex-wrap gap-2">
            {MEAL_PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setMealName(p)}
                className={`rounded-full border px-3 py-1.5 ${
                  mealName === p
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface-muted border-border'
                }`}
              >
                <Text
                  className={`text-xs ${
                    mealName === p ? 'text-accent' : 'text-text-dim'
                  }`}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input
            label="Descrição"
            value={description}
            onChangeText={setDescription}
            placeholder="150g arroz, 120g frango grelhado..."
            multiline
            numberOfLines={2}
          />
        </View>
      </Card>

      <Card glow accent="green">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Macros
        </Text>
        <View className="gap-3">
          <Input
            ref={calRef}
            label="Calorias (kcal)"
            value={calories}
            onChangeText={setCalories}
            placeholder="650"
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => protRef.current?.focus()}
            leftIcon={<Flame size={18} color={colors.accent} />}
          />
          <View className="flex-row gap-3">
            <View style={{ flex: 1 }}>
              <Input
                ref={protRef}
                label="Proteína (g)"
                value={protein}
                onChangeText={setProtein}
                placeholder="40"
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => carbRef.current?.focus()}
                leftIcon={<Beef size={16} color={colors.violetSoft} />}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                ref={carbRef}
                label="Carbo (g)"
                value={carbs}
                onChangeText={setCarbs}
                placeholder="80"
                keyboardType="number-pad"
                returnKeyType="next"
                onSubmitEditing={() => fatRef.current?.focus()}
                leftIcon={<Wheat size={16} color={colors.warn} />}
              />
            </View>
          </View>
          <Input
            ref={fatRef}
            label="Gordura (g)"
            value={fats}
            onChangeText={setFats}
            placeholder="15"
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            leftIcon={<Droplet size={16} color={colors.info} />}
          />
        </View>
      </Card>

      <Button
        label="Salvar refeição"
        onPress={handleSave}
        loading={createFood.isPending}
        icon={<Save size={18} color={colors.textInverse} />}
      />
    </ScrollView>
  );
}
