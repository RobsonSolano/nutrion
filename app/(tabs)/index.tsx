import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { Flame, Beef, Dumbbell, Droplet, Plus, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useDailyTotals } from '@/hooks/useDailyTotals';
import { useLastWorkout } from '@/hooks/useLastWorkout';
import { useTodaySessions } from '@/hooks/useRoutines';
import { useWaterToday } from '@/hooks/useWaterToday';
import { useWeeklyActivity } from '@/hooks/useWeeklyActivity';
import { queryKeys, todayKey } from '@/lib/queryKeys';
import { Card, Screen, StatRing } from '@/components/ui';
import WeekStreak, { calcStreak } from '@/components/WeekStreak';
import Disclaimer from '@/components/Disclaimer';
import { colors } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);

  const profileQ = useProfile();
  const dailyQ = useDailyTotals();
  const lastWorkoutQ = useLastWorkout();
  const sessionsTodayQ = useTodaySessions();
  const waterQ = useWaterToday();

  const profile = profileQ.data;
  const totals = dailyQ.data?.totals;
  const lastWorkout = lastWorkoutQ.data;
  const sessionsToday = sessionsTodayQ.data ?? [];
  const waterToday = waterQ.data;

  const weeklyQ = useWeeklyActivity(profile?.daily_calorie_goal ?? undefined);
  const weeklyDays = weeklyQ.data ?? [];
  const streak = calcStreak(weeklyDays);

  const displayName =
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'atleta';

  const calGoal = profile?.daily_calorie_goal ?? 2500;
  const proteinGoal = profile?.protein_goal_g ?? 180;
  const waterGoal = profile?.water_goal_ml ?? 4000;
  const calConsumed = totals?.calories ?? 0;
  const protein = totals?.protein_g ?? 0;
  const water = waterToday?.volume_ml ?? 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!user?.id) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.dailyTotals(user.id, todayKey()) }),
        qc.invalidateQueries({ queryKey: queryKeys.lastWorkout(user.id) }),
        qc.invalidateQueries({ queryKey: queryKeys.todaySessions(user.id, todayKey()) }),
        qc.invalidateQueries({ queryKey: queryKeys.waterToday(user.id, todayKey()) }),
        qc.invalidateQueries({ queryKey: queryKeys.weeklyActivity(user.id, todayKey()) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, user?.id]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  function handleFab() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/log' as Href);
  }

  return (
    <Screen variant="hero">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View className="flex-row items-end justify-between mt-2">
          <View className="flex-1">
            <Text className="text-text-dim text-sm">{greeting},</Text>
            <Text className="text-text text-3xl font-bold mt-1">
              {displayName}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/editar-perfil' as Href)}
            className="h-12 w-12 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <Text className="text-accent text-xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <Card glow accent="green">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Flame size={16} color={colors.accent} />
              <Text className="text-text-dim text-[11px] uppercase tracking-widest">
                Calorias de hoje
              </Text>
            </View>
            <Text className="text-text-muted text-xs">
              meta {calGoal.toLocaleString('pt-BR')}
            </Text>
          </View>
          <View className="items-center py-2">
            <StatRing
              value={calConsumed}
              goal={calGoal}
              label="kcal"
              unit={`de ${calGoal}`}
              size={170}
              strokeWidth={14}
            />
          </View>
          <Text className="text-text-dim text-xs text-center mt-4">
            {totals?.mealsCount === 0 || !totals
              ? 'Registre sua primeira refeição para começar'
              : calConsumed >= calGoal
                ? '✨ Meta diária batida'
                : `Faltam ${(calGoal - calConsumed).toLocaleString('pt-BR')} kcal · ${totals.mealsCount} refeiç${totals.mealsCount > 1 ? 'ões' : 'ão'} hoje`}
          </Text>
        </Card>

        {weeklyDays.length > 0 && (
          <WeekStreak days={weeklyDays} streak={streak} />
        )}

        <View className="flex-row gap-3">
          <Card padding="md" style={{ flex: 1 }}>
            <View className="flex-row items-center gap-2 mb-3">
              <Beef size={14} color={colors.violetSoft} />
              <Text className="text-text-dim text-[10px] uppercase tracking-widest">
                Proteína
              </Text>
            </View>
            <Text className="text-text text-3xl font-bold">{protein}</Text>
            <Text className="text-text-muted text-xs mt-1">
              de {proteinGoal}g
            </Text>
            <View className="h-1 rounded-full bg-border-subtle mt-3 overflow-hidden">
              <View
                className="h-1 rounded-full bg-violet-soft"
                style={{
                  width: `${Math.min((protein / proteinGoal) * 100, 100)}%`,
                }}
              />
            </View>
          </Card>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/log?tab=water' as Href);
            }}
            className="active:opacity-80"
            style={{ flex: 1 }}
          >
            <Card padding="md">
              <View className="flex-row items-center gap-2 mb-3">
                <Droplet size={14} color={colors.info} />
                <Text className="text-text-dim text-[10px] uppercase tracking-widest">
                  Água
                </Text>
              </View>
              <Text className="text-text text-3xl font-bold">
                {(water / 1000).toFixed(1)}
                <Text className="text-text-muted text-base font-normal">L</Text>
              </Text>
              <Text className="text-text-muted text-xs mt-1">
                de {(waterGoal / 1000).toFixed(1)}L
              </Text>
              <View className="h-1 rounded-full bg-border-subtle mt-3 overflow-hidden">
                <View
                  className="h-1 rounded-full bg-info"
                  style={{
                    width: `${Math.min((water / waterGoal) * 100, 100)}%`,
                  }}
                />
              </View>
            </Card>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/sanity-check' as Href);
          }}
          className="active:opacity-80"
        >
          <Card padding="md" accent="violet" glow>
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-violet/15 border border-violet/40 items-center justify-center">
                <Camera size={20} color={colors.violetSoft} />
              </View>
              <View className="flex-1">
                <Text className="text-text font-semibold">
                  Analisar um prato com IA
                </Text>
                <Text className="text-text-dim text-xs mt-0.5">
                  Foto + peso + descrição → feedback e macros estimados
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>

        <Card>
          <View className="flex-row items-center gap-2 mb-3">
            <Dumbbell size={14} color={colors.accent} />
            <Text className="text-text-dim text-[11px] uppercase tracking-widest">
              {sessionsToday.length > 0 ? 'Treinos de hoje' : 'Último treino'}
            </Text>
          </View>
          {sessionsToday.length > 0 ? (
            <View className="gap-2">
              {sessionsToday.map((s) => (
                <View
                  key={s.id}
                  className="flex-row items-center gap-2 rounded-xl bg-accent/10 border border-accent/30 px-3 py-2"
                >
                  <View className="h-7 w-7 rounded-lg bg-accent/15 items-center justify-center">
                    <Dumbbell size={13} color={colors.accent} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>
                      {s.routine_name}
                    </Text>
                    {s.duration_min != null && (
                      <Text className="text-text-muted text-[11px]">
                        {s.duration_min} min
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : lastWorkout ? (
            <>
              <Text className="text-text text-xl font-semibold">
                {lastWorkout.exercise_name}
              </Text>
              <Text className="text-text-dim text-sm mt-1">
                {lastWorkout.sets ?? '—'}×{lastWorkout.reps ?? '—'} com{' '}
                <Text className="text-accent font-semibold">
                  {lastWorkout.weight_kg ?? '—'}kg
                </Text>
              </Text>
              <Text className="text-text-muted text-xs mt-2">
                {new Date(lastWorkout.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-text text-xl font-semibold">
                Nada registrado ainda
              </Text>
              <Text className="text-text-muted text-xs mt-1">
                Crie um treino em Meus Treinos e marque aqui.
              </Text>
            </>
          )}
        </Card>

        <Disclaimer />
      </ScrollView>

      <Pressable
        onPress={handleFab}
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
    </Screen>
  );
}
