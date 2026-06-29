import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Dumbbell, Plus, ChevronRight, BookOpen, Activity, GraduationCap, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useRoutines } from '@/hooks/useRoutines';
import { useStartWorkoutFlow } from '@/hooks/useStartWorkoutFlow';
import { useExerciseGroups } from '@/hooks/useExercises';
import { queryKeys } from '@/lib/queryKeys';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import type {
  WorkoutRoutineListItem,
  ExerciseGroup,
} from '@/types/database';

export default function TreinoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const profileQ = useProfile();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);

  const routinesQ = useRoutines();
  const groupsQ = useExerciseGroups();
  const { requestStart } = useStartWorkoutFlow();

  const isStudent = profileQ.data?.role === 'aluno';

  const routines = routinesQ.data ?? [];
  const groupsById = new Map<string, ExerciseGroup>(
    (groupsQ.data ?? []).map((g) => [g.id, g]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!user?.id) return;
      await qc.invalidateQueries({ queryKey: queryKeys.routines(user.id) });
    } finally {
      setRefreshing(false);
    }
  }, [qc, user?.id]);

  function openNew() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/rotina/nova' as Href);
  }

  const renderItem = useCallback(
    ({ item }: { item: WorkoutRoutineListItem }) => (
      <RoutineCard
        routine={item}
        group={item.group_id ? groupsById.get(item.group_id) ?? null : null}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push(`/rotina/${item.id}` as Href);
        }}
        onStart={() => requestStart({ id: item.id, name: item.name })}
      />
    ),
    [groupsById, router, requestStart],
  );

  const isEmpty = !routinesQ.isLoading && routines.length === 0;

  return (
    <Screen variant="hero">
      <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
        <View className="flex-row items-center gap-3 flex-1">
          <View className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center">
            <Dumbbell size={22} color={colors.accent} />
          </View>
          <View className="flex-1">
            <Text className="text-text text-2xl font-bold">Meus Treinos</Text>
            <Text className="text-text-dim text-xs">
              {routines.length > 0
                ? `${routines.length} treino${routines.length > 1 ? 's' : ''} salvo${routines.length > 1 ? 's' : ''}`
                : 'monte seus treinos'}
            </Text>
          </View>
        </View>
      </View>

      {isEmpty ? (
        isStudent ? (
          <EmptyStudentState />
        ) : (
          <EmptyState onCreate={openNew} />
        )
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: 20,
            gap: 12,
            paddingBottom: tabBarHeight + 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}

      {!isStudent && (
        <Pressable
          onPress={openNew}
          className="absolute right-6 h-14 w-14 rounded-full bg-accent items-center justify-center active:opacity-80"
          style={{
            bottom: tabBarHeight + 16,
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.6,
            shadowRadius: 18,
            elevation: 12,
          }}
        >
          <Plus size={26} color={colors.textInverse} strokeWidth={3} />
        </Pressable>
      )}
    </Screen>
  );
}

function RoutineCard({
  routine,
  group,
  onPress,
  onStart,
}: {
  routine: WorkoutRoutineListItem;
  group: ExerciseGroup | null;
  onPress: () => void;
  onStart: () => void;
}) {
  const exercisesLabel =
    routine.exercises_count === 1
      ? '1 exercício'
      : `${routine.exercises_count} exercícios`;
  const fromCoach = !!routine.created_by_coach;
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card padding="md">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center">
            <Text className="text-lg">{group?.icon ?? '💪'}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-text text-base font-semibold" numberOfLines={1}>
              {routine.name}
            </Text>
            <Text className="text-text-dim text-xs mt-0.5" numberOfLines={1}>
              {group?.name ?? 'Treino livre'} · {exercisesLabel}
              {routine.description ? ` · ${routine.description}` : ''}
            </Text>
            {fromCoach && (
              <View className="flex-row items-center gap-1 mt-1.5">
                <View className="rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 flex-row items-center gap-1">
                  <GraduationCap size={9} color={colors.violetSoft} />
                  <Text className="text-violet-soft text-[10px] font-semibold">
                    do seu professor
                  </Text>
                </View>
              </View>
            )}
          </View>
          <Pressable
            onPress={onStart}
            hitSlop={10}
            className="h-10 w-10 rounded-full bg-accent/15 border border-accent/40 items-center justify-center active:opacity-70"
          >
            <Play size={16} color={colors.accent} fill={colors.accent} />
          </Pressable>
          <ChevronRight size={16} color={colors.textMuted} />
        </View>
      </Card>
    </Pressable>
  );
}

function EmptyStudentState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pb-20 gap-4">
      <View className="h-16 w-16 rounded-full bg-violet/10 border border-violet/30 items-center justify-center">
        <GraduationCap size={26} color={colors.violetSoft} />
      </View>
      <Text className="text-text text-xl font-semibold text-center">
        Aguardando seu professor
      </Text>
      <Text className="text-text-dim text-sm text-center leading-relaxed">
        Seu professor ainda não criou treinos pra você. Quando ele montar o
        plano, eles aparecem aqui. Se quiser pedir algo, abre uma solicitação
        no perfil.
      </Text>
    </View>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8 pb-20 gap-4">
      <View className="h-16 w-16 rounded-full bg-accent/10 border border-accent/30 items-center justify-center">
        <BookOpen size={26} color={colors.accent} />
      </View>
      <Text className="text-text text-xl font-semibold text-center">
        Nenhum treino ainda
      </Text>
      <Text className="text-text-dim text-sm text-center leading-relaxed">
        Crie treinos reutilizáveis (ex: &quot;Peito A&quot;, &quot;Cardio 30min&quot;) com
        os exercícios prescritos. No log diário você só precisa marcar qual
        fez — sem cadastrar exercício por exercício toda vez.
      </Text>
      <View className="mt-2 w-full">
        <Button
          label="Criar primeiro treino"
          onPress={onCreate}
          icon={<Activity size={18} color={colors.textInverse} />}
        />
      </View>
    </View>
  );
}
