import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RoutineEditor from '@/components/routine/RoutineEditor';
import { useRoutineDetail } from '@/hooks/useRoutines';
import { useUpdateStudentRoutine } from '@/hooks/useStudents';
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

  if (!id || !routineId) return null;

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
            <Text className="text-text font-semibold" numberOfLines={1}>
              Editar treino do aluno
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
    </>
  );
}
