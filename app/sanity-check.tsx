import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  X,
  Camera,
  ImageIcon,
  Sparkles,
  Scale,
  Utensils,
  Save,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { runSanityCheck, type SanityCheckResult } from '@/services/sanityCheck';
import { useCreateFoodLog } from '@/hooks/useLogMutations';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Button, Card, Input, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

type Stage = 'input' | 'analyzing' | 'result';

export default function SanityCheckScreen() {
  const router = useRouter();
  const createFood = useCreateFoodLog();
  const kbHeight = useKeyboardHeight();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [scaleWeight, setScaleWeight] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [result, setResult] = useState<SanityCheckResult | null>(null);

  async function pickImage(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        'Precisamos da permissão de ' +
          (source === 'camera' ? 'câmera' : 'galeria') +
          ' pra analisar o prato.',
      );
      return;
    }

    const launcher =
      source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

    const result = await launcher({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoBase64(asset.base64 ?? null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleAnalyze() {
    if (!photoBase64) {
      Alert.alert('Foto do prato', 'Tire ou escolha uma foto primeiro.');
      return;
    }
    if (description.trim().length < 3) {
      Alert.alert(
        'Descrição',
        'Descreve brevemente o prato (ex: 150g arroz, 120g frango).',
      );
      return;
    }

    setStage('analyzing');
    try {
      const res = await runSanityCheck({
        description: description.trim(),
        imageBase64: photoBase64,
        scaleWeightG: scaleWeight ? Number(scaleWeight) : undefined,
      });
      setResult(res);
      setStage('result');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setStage('input');
      Alert.alert(
        'Não consegui analisar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  async function handleSaveAsFoodLog() {
    if (!result?.macros) return;
    try {
      await createFood.mutateAsync({
        meal_name: 'Refeição (analisada)',
        description: description.trim(),
        calories: result.macros.kcal ?? null,
        protein_g: result.macros.protein_g ?? null,
        carbs_g: result.macros.carbs_g ?? null,
        fats_g: result.macros.fats_g ?? null,
        photo_path: null,
        ai_feedback: result.feedback ?? null,
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

  function handleReset() {
    setPhotoUri(null);
    setPhotoBase64(null);
    setDescription('');
    setScaleWeight('');
    setResult(null);
    setStage('input');
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Screen variant="violet" edges={['top']}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={0}
          className="flex-1"
        >
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <X size={18} color={colors.textDim} />
            </Pressable>
            <Text className="text-text font-semibold">Sanity Check</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 20,
              gap: 16,
              paddingBottom: 60 + (Platform.OS === 'android' ? kbHeight : 0),
            }}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {stage === 'input' && (
              <InputStage
                photoUri={photoUri}
                description={description}
                scaleWeight={scaleWeight}
                onPickCamera={() => pickImage('camera')}
                onPickLibrary={() => pickImage('library')}
                onDescriptionChange={setDescription}
                onScaleWeightChange={setScaleWeight}
                onAnalyze={handleAnalyze}
                canAnalyze={!!photoBase64 && description.trim().length >= 3}
              />
            )}

            {stage === 'analyzing' && (
              <AnalyzingStage photoUri={photoUri ?? undefined} />
            )}

            {stage === 'result' && result && (
              <ResultStage
                result={result}
                photoUri={photoUri ?? undefined}
                onReset={handleReset}
                onSave={handleSaveAsFoodLog}
                saving={createFood.isPending}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </>
  );
}

// ---------------- STAGES ----------------

function InputStage(props: {
  photoUri: string | null;
  description: string;
  scaleWeight: string;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onDescriptionChange: (v: string) => void;
  onScaleWeightChange: (v: string) => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
}) {
  return (
    <>
      <Card glow accent="violet">
        <View className="flex-row items-center gap-2 mb-3">
          <Sparkles size={16} color={colors.violetSoft} />
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            Validar refeição com IA
          </Text>
        </View>
        <Text className="text-text-dim text-sm leading-relaxed">
          Tire uma foto do prato (idealmente em cima da balança), descreva o que
          tem, e a IA valida se a descrição bate com o que dá pra ver.
        </Text>
      </Card>

      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Foto do prato
        </Text>
        {props.photoUri ? (
          <View className="rounded-2xl overflow-hidden border border-border-strong mb-3">
            <Image
              source={{ uri: props.photoUri }}
              style={{ width: '100%', aspectRatio: 4 / 3 }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View className="rounded-2xl border border-dashed border-border bg-surface-muted items-center justify-center py-12 mb-3">
            <ImageIcon size={28} color={colors.textMuted} />
            <Text className="text-text-muted text-xs mt-2">
              Nenhuma foto selecionada
            </Text>
          </View>
        )}
        <View className="flex-row gap-2">
          <View style={{ flex: 1 }}>
            <Button
              label="Câmera"
              onPress={props.onPickCamera}
              variant="secondary"
              size="md"
              icon={<Camera size={16} color={colors.text} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Galeria"
              onPress={props.onPickLibrary}
              variant="ghost"
              size="md"
              icon={<ImageIcon size={16} color={colors.textDim} />}
            />
          </View>
        </View>
      </Card>

      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Contexto
        </Text>
        <View className="gap-3">
          <Input
            label="Descrição do prato"
            value={props.description}
            onChangeText={props.onDescriptionChange}
            placeholder="150g arroz, 120g frango grelhado, 80g feijão, salada"
            multiline
            numberOfLines={3}
          />
          <Input
            label="Peso total na balança (g)"
            value={props.scaleWeight}
            onChangeText={props.onScaleWeightChange}
            placeholder="450 (opcional)"
            keyboardType="number-pad"
            leftIcon={<Scale size={16} color={colors.textMuted} />}
          />
        </View>
      </Card>

      <Button
        label="Analisar refeição"
        onPress={props.onAnalyze}
        disabled={!props.canAnalyze}
        icon={<Sparkles size={18} color={colors.textInverse} />}
      />
    </>
  );
}

function AnalyzingStage({ photoUri }: { photoUri?: string }) {
  return (
    <Card glow accent="violet">
      {photoUri && (
        <View className="rounded-2xl overflow-hidden border border-border-strong mb-4">
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', aspectRatio: 4 / 3, opacity: 0.7 }}
            resizeMode="cover"
          />
        </View>
      )}
      <View className="items-center py-6 gap-3">
        <View className="h-12 w-12 rounded-full bg-violet/15 border border-violet/40 items-center justify-center">
          <Sparkles size={22} color={colors.violetSoft} />
        </View>
        <Text className="text-text text-lg font-semibold">
          Analisando seu prato...
        </Text>
        <Text className="text-text-dim text-sm text-center">
          A IA está cruzando foto, descrição e peso informado.
        </Text>
      </View>
    </Card>
  );
}

function ResultStage({
  result,
  photoUri,
  onReset,
  onSave,
  saving,
}: {
  result: SanityCheckResult;
  photoUri?: string;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const ok = result.consistency === 'ok';
  const showMacros = !!result.macros;

  return (
    <>
      <Card glow accent={ok ? 'green' : 'violet'}>
        {photoUri && (
          <View className="rounded-2xl overflow-hidden border border-border-strong mb-4">
            <Image
              source={{ uri: photoUri }}
              style={{ width: '100%', aspectRatio: 4 / 3 }}
              resizeMode="cover"
            />
          </View>
        )}
        <View className="flex-row items-center gap-2 mb-3">
          {ok ? (
            <CheckCircle2 size={18} color={colors.accent} />
          ) : (
            <AlertTriangle size={18} color={colors.warn} />
          )}
          <Text
            className="text-[11px] uppercase tracking-widest font-semibold"
            style={{ color: ok ? colors.accent : colors.warn }}
          >
            {ok ? 'Consistente' : 'Diverge um pouco'}
          </Text>
        </View>
        {result.feedback ? (
          <Text className="text-text text-sm leading-relaxed">
            {result.feedback}
          </Text>
        ) : (
          <Text className="text-text-dim text-sm leading-relaxed">
            {result.raw ?? 'Sem feedback retornado.'}
          </Text>
        )}
      </Card>

      {result.items && result.items.length > 0 && (
        <Card padding="md">
          <View className="flex-row items-center gap-2 mb-3">
            <Utensils size={14} color={colors.violetSoft} />
            <Text className="text-text-dim text-[11px] uppercase tracking-widest">
              Itens identificados
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {result.items.map((item, i) => (
              <View
                key={`${item}-${i}`}
                className="rounded-full border border-border bg-surface-muted px-3 py-1"
              >
                <Text className="text-text-dim text-xs">{item}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {showMacros && (
        <Card glow accent="green">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Macros estimados
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <MacroBlock label="kcal" value={result.macros?.kcal} />
            <MacroBlock label="proteína (g)" value={result.macros?.protein_g} />
            <MacroBlock label="carbo (g)" value={result.macros?.carbs_g} />
            <MacroBlock label="gordura (g)" value={result.macros?.fats_g} />
          </View>
        </Card>
      )}

      <View className="gap-2">
        {showMacros && (
          <Button
            label="Salvar como refeição"
            onPress={onSave}
            loading={saving}
            icon={<Save size={18} color={colors.textInverse} />}
          />
        )}
        <Button
          label="Analisar outra foto"
          onPress={onReset}
          variant="ghost"
          size="md"
        />
      </View>
    </>
  );
}

function MacroBlock({ label, value }: { label: string; value?: number }) {
  return (
    <View className="rounded-2xl border border-border bg-surface-muted px-4 py-3" style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Text className="text-text-muted text-[10px] uppercase tracking-widest">
        {label}
      </Text>
      <Text className="text-text text-xl font-bold mt-1">
        {value != null ? value.toLocaleString('pt-BR') : '—'}
      </Text>
    </View>
  );
}
