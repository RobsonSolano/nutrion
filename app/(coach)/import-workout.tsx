import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react-native';
import { Button, Card, Screen } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { colors } from '@/lib/theme';
import { readFileAsBase64 } from '@/lib/uploadFile';
import {
  useImportWorkoutAi,
  useSaveImportedWorkout,
} from '@/hooks/useWorkoutImport';
import type {
  ImportImage,
  ImportResult,
  SavedWorkout,
} from '@/services/workoutImport';
import ImportWorkoutPreview from '@/components/coach/ImportWorkoutPreview';

const MAX_IMAGES = 3;
const TARGET_WIDTH = 1280;

type Phase = 'setup' | 'extracting' | 'preview' | 'saving';

type LocalImage = {
  uri: string;
  base64: string;
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
};

export default function ImportWorkoutScreen() {
  const router = useRouter();
  const alert = useAlert();
  const params = useLocalSearchParams<{
    destination?: string;
    student_id?: string;
  }>();
  const destination =
    params.destination === 'aluno' ? 'aluno' : 'template';
  const studentId = params.student_id;

  const importMutation = useImportWorkoutAi();
  const saveMutation = useSaveImportedWorkout();

  const [phase, setPhase] = useState<Phase>('setup');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  async function pickImage(source: 'camera' | 'library') {
    if (images.length >= MAX_IMAGES) {
      Alert.alert(
        'Limite atingido',
        `Máximo de ${MAX_IMAGES} imagens por importação.`,
      );
      return;
    }
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        `Precisamos de acesso à ${source === 'camera' ? 'câmera' : 'galeria'}.`,
      );
      return;
    }
    const launcher =
      source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
    try {
      const picked = await launcher({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        exif: false,
        allowsEditing: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const resized = await manipulateAsync(
        asset.uri,
        asset.width > TARGET_WIDTH ? [{ resize: { width: TARGET_WIDTH } }] : [],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      const base64 = await readFileAsBase64(resized.uri);
      setImages((prev) => [
        ...prev,
        { uri: resized.uri, base64, mime: 'image/jpeg' },
      ]);
    } catch (err) {
      alert.showError(err);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    if (images.length === 0 && text.trim().length === 0) {
      Alert.alert(
        'Falta conteúdo',
        'Envie pelo menos uma imagem ou descreva o treino.',
      );
      return;
    }
    setPhase('extracting');
    try {
      const apiImages: ImportImage[] = images.map((i) => ({
        base64: i.base64,
        mime: i.mime,
      }));
      const data = await importMutation.mutateAsync({
        images: apiImages,
        text: text.trim(),
        destination,
        studentId,
      });
      if (!data.workouts || data.workouts.length === 0) {
        setPhase('setup');
        alert.showAlert({
          title: 'Não consegui extrair',
          message:
            'A IA não encontrou treinos no material enviado. Tente com imagens mais nítidas ou descrição mais detalhada.',
          type: 'warning',
        });
        return;
      }
      setResult(data);
      setPhase('preview');
    } catch (err) {
      setPhase('setup');
      alert.showError(err);
    }
  }

  async function handleSave(workouts: SavedWorkout[]) {
    setPhase('saving');
    try {
      const saved = await saveMutation.mutateAsync({
        destination,
        studentId,
        workouts,
      });
      const created =
        destination === 'aluno'
          ? saved.created_routine_ids.length
          : saved.created_template_ids.length;
      alert.showAlert({
        title: 'Treino importado',
        message: `${created} treino${created === 1 ? '' : 's'} criado${created === 1 ? '' : 's'}${
          saved.created_exercises_count > 0
            ? ` · ${saved.created_exercises_count} exercício${saved.created_exercises_count === 1 ? '' : 's'} novo${saved.created_exercises_count === 1 ? '' : 's'} na base`
            : ''
        }.`,
        type: 'success',
      });
      router.back();
    } catch (err) {
      setPhase('preview');
      alert.showError(err);
    }
  }

  if (phase === 'extracting') {
    return <FullScreen title="Lendo o material com IA…" />;
  }
  if (phase === 'saving') {
    return <FullScreen title="Salvando treino…" />;
  }
  if (phase === 'preview' && result) {
    return (
      <ImportWorkoutPreview
        result={result}
        destination={destination}
        onCancel={() => setPhase('setup')}
        onConfirm={handleSave}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <Text className="text-text font-semibold text-base flex-1">
          Importar treino via IA
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 60,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="md">
          <View className="flex-row items-start gap-3">
            <View className="h-9 w-9 rounded-2xl bg-warn/10 border border-warn/40 items-center justify-center mt-0.5">
              <AlertTriangle size={16} color={colors.warn} />
            </View>
            <View className="flex-1">
              <Text className="text-text text-sm font-semibold">
                Quanto mais nítido, melhor
              </Text>
              <Text className="text-text-dim text-[12px] mt-1 leading-relaxed">
                Tire as fotos com boa luz, papel plano e caligrafia legível. Se
                a IA errar, você revisa tudo antes de salvar.
              </Text>
            </View>
          </View>
        </Card>

        <Card padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Imagens (até {MAX_IMAGES})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {images.map((img, i) => (
              <View
                key={img.uri}
                className="rounded-2xl overflow-hidden border border-border bg-surface-muted"
                style={{ width: 92, height: 92 }}
              >
                <Image
                  source={{ uri: img.uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => removeImage(i)}
                  hitSlop={6}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-bg-deep/80 items-center justify-center border border-border"
                >
                  <Trash2 size={12} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <View className="flex-row gap-2">
                <AddTile
                  icon={<Camera size={16} color={colors.accent} />}
                  label="Câmera"
                  onPress={() => pickImage('camera')}
                />
                <AddTile
                  icon={<ImageIcon size={16} color={colors.accent} />}
                  label="Galeria"
                  onPress={() => pickImage('library')}
                />
              </View>
            )}
          </View>
        </Card>

        <Card padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Descrever treino (opcional)
          </Text>
          <View className="rounded-2xl border border-border bg-surface">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Cole a ficha ou descreva os treinos (A1, A2, A3… B1, B2…). Quanto mais detalhe, melhor."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 140,
                maxHeight: 320,
                color: colors.text,
                padding: 14,
                fontSize: 15,
                lineHeight: 22,
              }}
            />
          </View>
          <Text className="text-text-muted text-[11px] mt-2">
            {text.length} caracteres
          </Text>
        </Card>

        <Button
          label="Gerar treino com IA"
          onPress={handleGenerate}
          variant="primary"
          icon={<Sparkles size={16} color={colors.textInverse} />}
          disabled={images.length === 0 && text.trim().length === 0}
        />
      </ScrollView>
    </Screen>
  );
}

function AddTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-dashed border-border-strong bg-surface-muted items-center justify-center active:opacity-70"
      style={{ width: 92, height: 92 }}
    >
      <Plus size={16} color={colors.accent} />
      <View className="mt-1">{icon}</View>
      <Text className="text-text-dim text-[10px] mt-1">{label}</Text>
    </Pressable>
  );
}

function FullScreen({ title }: { title: string }) {
  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8 gap-4">
        <ActivityIndicator color={colors.violetSoft} />
        <Text className="text-text-dim text-sm text-center">{title}</Text>
      </View>
    </Screen>
  );
}
