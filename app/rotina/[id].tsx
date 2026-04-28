import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  X,
  Pencil,
  Trash2,
  Dumbbell,
  Check,
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RoutineEditor from '@/components/routine/RoutineEditor';
import ExerciseImagesModal from '@/components/routine/ExerciseImagesModal';
import PreviewEyeButton from '@/components/routine/PreviewEyeButton';
import {
  useDeleteRoutine,
  useRoutineDetail,
  useUpdateRoutine,
} from '@/hooks/useRoutines';
import { useExerciseImagesMap } from '@/hooks/useExercises';
import { Button, Card, Screen } from '@/components/ui';
import Disclaimer from '@/components/Disclaimer';
import { colors } from '@/lib/theme';
import { MODALITY_LABELS, type RoutineExercise } from '@/types/database';

export default function RotinaDetalheScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detailQ = useRoutineDetail(id ?? null);
  const update = useUpdateRoutine();
  const remove = useDeleteRoutine();
  const imagesMap = useExerciseImagesMap();

  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{
    name: string;
    equipment: string | null;
    images: string[];
  } | null>(null);

  if (!id) return null;

  function handleDelete() {
    Alert.alert(
      'Excluir treino?',
      'Essa ação não pode ser desfeita. As sessões antigas mantêm o nome salvo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove.mutateAsync(id!);
              void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              router.back();
            } catch (err) {
              Alert.alert(
                'Não consegui excluir',
                err instanceof Error ? err.message : 'Tenta de novo.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Screen variant="hero" edges={['top']}>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <X size={18} color={colors.textDim} />
            </Pressable>
            <Text className="text-text font-semibold" numberOfLines={1}>
              {editing ? 'Editar treino' : detailQ.data?.name ?? 'Treino'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {detailQ.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !detailQ.data ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-text-dim">Treino não encontrado.</Text>
            </View>
          ) : editing ? (
            <RoutineEditor
              initialName={detailQ.data.name}
              initialDescription={detailQ.data.description ?? ''}
              initialModality={detailQ.data.modality}
              initialGroupId={detailQ.data.group_id}
              initialExercises={detailQ.data.exercises.map((e) => ({
                exercise_id: e.exercise_id,
                exercise_name: e.exercise_name,
                equipment: e.equipment,
                sort_order: e.sort_order,
                sets: e.sets,
                reps_min: e.reps_min,
                reps_max: e.reps_max,
                weight_min_kg: e.weight_min_kg,
                weight_max_kg: e.weight_max_kg,
                duration_min: e.duration_min,
                notes: e.notes,
              }))}
              submitLabel="Salvar alterações"
              loading={update.isPending}
              onSubmit={async (payload) => {
                await update.mutateAsync({
                  id: id!,
                  patch: {
                    name: payload.name,
                    modality: payload.modality,
                    group_id: payload.groupId,
                    description: payload.description,
                  },
                  exercises: payload.exercises,
                });
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                setEditing(false);
              }}
            />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              <Card glow accent="green">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center">
                    <Text className="text-xl">
                      {detailQ.data.group?.icon ?? '💪'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-xl font-bold" numberOfLines={2}>
                      {detailQ.data.name}
                    </Text>
                    <Text className="text-text-dim text-xs mt-0.5">
                      {MODALITY_LABELS[detailQ.data.modality]} ·{' '}
                      {detailQ.data.group?.name ?? 'Treino livre'} ·{' '}
                      {detailQ.data.exercises.length} exercícios
                    </Text>
                  </View>
                </View>
                {detailQ.data.description && (
                  <Text className="text-text-dim text-sm mt-4 leading-relaxed">
                    {detailQ.data.description}
                  </Text>
                )}
              </Card>

              <Card padding="md">
                <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
                  Prescrição
                </Text>
                {detailQ.data.exercises.length === 0 ? (
                  <Text className="text-text-muted text-sm text-center py-4">
                    Este treino ainda não tem exercícios.
                  </Text>
                ) : (
                  <View className="gap-3">
                    {detailQ.data.exercises.map((e, i) => {
                      const imgs = e.exercise_id
                        ? imagesMap.get(e.exercise_id) ?? null
                        : null;
                      return (
                        <ExerciseReadRow
                          key={e.id}
                          exercise={e}
                          index={i}
                          imageUrls={imgs}
                          onPreview={
                            imgs
                              ? () =>
                                  setPreview({
                                    name: e.exercise_name,
                                    equipment: e.equipment,
                                    images: imgs,
                                  })
                              : undefined
                          }
                        />
                      );
                    })}
                  </View>
                )}
              </Card>

              <Button
                label="Editar treino"
                onPress={() => setEditing(true)}
                variant="secondary"
                icon={<Pencil size={16} color={colors.text} />}
              />
              <Button
                label="Excluir treino"
                onPress={handleDelete}
                variant="danger"
                icon={<Trash2 size={16} color={colors.danger} />}
              />
              <Disclaimer />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Screen>

      <ExerciseImagesModal
        visible={!!preview}
        onClose={() => setPreview(null)}
        exerciseName={preview?.name ?? ''}
        equipment={preview?.equipment}
        imageUrls={preview?.images ?? []}
      />
    </>
  );
}

function ExerciseReadRow({
  exercise,
  index,
  imageUrls,
  onPreview,
}: {
  exercise: RoutineExercise;
  index: number;
  imageUrls: string[] | null;
  onPreview?: () => void;
}) {
  const repRange = formatRange(exercise.reps_min, exercise.reps_max);
  const weightRange = formatRange(exercise.weight_min_kg, exercise.weight_max_kg);
  const hasImages = !!imageUrls && imageUrls.length > 0;

  return (
    <View className="rounded-2xl border border-border bg-surface-muted p-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-text-muted text-[10px] w-5">#{index + 1}</Text>
        <View className="flex-1">
          <Text className="text-text text-sm font-semibold" numberOfLines={2}>
            {exercise.exercise_name}
          </Text>
          {exercise.equipment && (
            <Text className="text-text-muted text-[10px] mt-0.5">
              {exercise.equipment}
            </Text>
          )}
        </View>
        {hasImages && onPreview ? (
          <PreviewEyeButton onPress={onPreview} />
        ) : (
          <Dumbbell size={14} color={colors.textMuted} />
        )}
      </View>
      <View className="flex-row flex-wrap gap-2 mt-2">
        {exercise.sets != null && <Pill icon={<Check size={10} color={colors.accent} />} label={`${exercise.sets} séries`} />}
        {repRange && <Pill label={`${repRange} reps`} />}
        {weightRange && <Pill label={`${weightRange} kg`} />}
        {exercise.duration_min != null && (
          <Pill icon={<Clock size={10} color={colors.info} />} label={`${exercise.duration_min} min`} />
        )}
      </View>
      {exercise.notes && (
        <Text className="text-text-muted text-xs mt-2 italic">
          {exercise.notes}
        </Text>
      )}
    </View>
  );
}

function Pill({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1">
      {icon}
      <Text className="text-text-dim text-[11px]">{label}</Text>
    </View>
  );
}

function formatRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null && min !== max) return `${min}-${max}`;
  if (max != null) return String(max);
  if (min != null) return String(min);
  return null;
}
