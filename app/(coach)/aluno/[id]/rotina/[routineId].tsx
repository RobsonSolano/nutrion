import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookmarkPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RoutineEditor from '@/components/routine/RoutineEditor';
import SaveAsTemplateModal from '@/components/coach/SaveAsTemplateModal';
import { useRoutineDetail } from '@/hooks/useRoutines';
import { useCreateTemplate } from '@/hooks/useTemplates';
import { useUpdateStudentRoutine } from '@/hooks/useStudents';
import { useAlert } from '@/components/GlobalAlertProvider';
import { Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function CoachEditarRotinaAluno() {
  const router = useRouter();
  const { id, routineId } = useLocalSearchParams<{
    id: string;
    routineId: string;
  }>();
  const detailQ = useRoutineDetail(routineId ?? null);
  const update = useUpdateStudentRoutine();
  const createTemplate = useCreateTemplate();
  const alert = useAlert();
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  if (!id || !routineId) return null;

  async function handleSaveAsTemplate(name: string) {
    if (!detailQ.data) return;
    try {
      await createTemplate.mutateAsync({
        name,
        modality: detailQ.data.modality,
        groupId: detailQ.data.group_id,
        description: detailQ.data.description,
        exercises: detailQ.data.exercises.map((e) => ({
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
        })),
      });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      setSaveTemplateOpen(false);
      alert.showAlert({
        title: 'Salvo na biblioteca',
        message: `Template "${name}" criado.`,
        type: 'success',
      });
    } catch (err) {
      alert.showError(err);
    }
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
              <ArrowLeft size={18} color={colors.textDim} />
            </Pressable>
            <Text className="text-text font-semibold flex-1 text-center" numberOfLines={1}>
              Editar treino do aluno
            </Text>
            {detailQ.data ? (
              <Pressable
                onPress={() => setSaveTemplateOpen(true)}
                hitSlop={12}
                className="h-10 w-10 rounded-2xl bg-violet/10 border border-violet/40 items-center justify-center active:opacity-70"
              >
                <BookmarkPlus size={18} color={colors.violetSoft} />
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {detailQ.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !detailQ.data ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-text-dim">Treino não encontrado.</Text>
            </View>
          ) : (
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
                  studentId: id,
                  routineId,
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
                router.back();
              }}
            />
          )}
        </KeyboardAvoidingView>
      </Screen>

      <SaveAsTemplateModal
        visible={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        defaultName={detailQ.data?.name ?? ''}
        loading={createTemplate.isPending}
        onConfirm={handleSaveAsTemplate}
      />
    </>
  );
}
