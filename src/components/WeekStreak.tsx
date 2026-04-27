import { Text, View } from 'react-native';
import { Check, X, Flame, Dumbbell, Droplet } from 'lucide-react-native';
import type { DayActivity } from '@/hooks/useWeeklyActivity';
import { colors } from '@/lib/theme';

type Props = {
  days: DayActivity[];
  streak: number;
};

export default function WeekStreak({ days, streak }: Props) {
  return (
    <View className="rounded-3xl border border-border bg-surface overflow-hidden p-5">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Flame size={14} color={streak > 0 ? colors.accent : colors.textMuted} />
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            Últimos 7 dias
          </Text>
        </View>
        {streak > 0 ? (
          <View className="rounded-full bg-accent/10 border border-accent/40 px-3 py-0.5">
            <Text className="text-accent text-[11px] font-semibold">
              {streak} dia{streak > 1 ? 's' : ''} seguido{streak > 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <Text className="text-text-muted text-[11px]">
            começa hoje
          </Text>
        )}
      </View>

      <View className="flex-row justify-between">
        {days.map((d) => (
          <DayCircle key={d.day} day={d} />
        ))}
      </View>

      <View className="flex-row items-center justify-center gap-4 mt-4">
        <LegendItem icon={<Flame size={10} color={colors.accent} />} label="refeição" />
        <LegendItem icon={<Dumbbell size={10} color={colors.violetSoft} />} label="treino" />
        <LegendItem icon={<Droplet size={10} color={colors.info} />} label="água" />
      </View>
    </View>
  );
}

function DayCircle({ day }: { day: DayActivity }) {
  const hasAny = day.hasFood || day.hasWorkout || day.hasWater;
  const isPerfect = day.hitCalorieGoal && day.hasWorkout && day.hasWater;

  const bg = day.isFuture
    ? 'bg-surface-muted'
    : isPerfect
      ? 'bg-accent/20'
      : hasAny
        ? 'bg-surface-raised'
        : 'bg-surface-muted';

  const borderColor = day.isToday
    ? 'border-accent'
    : isPerfect
      ? 'border-accent/60'
      : hasAny
        ? 'border-border-strong'
        : 'border-border';

  const center = day.isFuture ? (
    <Text className="text-text-muted text-[10px]">·</Text>
  ) : hasAny ? (
    <Check
      size={14}
      color={isPerfect ? colors.accent : colors.accentSoft}
      strokeWidth={3}
    />
  ) : (
    <X size={12} color={colors.textMuted} strokeWidth={2.5} />
  );

  return (
    <View className="items-center gap-1.5">
      <Text
        className={`text-[10px] font-semibold uppercase ${
          day.isToday ? 'text-accent' : 'text-text-muted'
        }`}
      >
        {day.label}
      </Text>
      <View
        className={`h-9 w-9 rounded-full items-center justify-center border ${bg} ${borderColor}`}
      >
        {center}
      </View>
      <View className="flex-row gap-0.5 mt-0.5">
        <Dot active={day.hasFood} color={colors.accent} />
        <Dot active={day.hasWorkout} color={colors.violetSoft} />
        <Dot active={day.hasWater} color={colors.info} />
      </View>
      <Text className="text-text-muted text-[9px]">{day.dayNumber}</Text>
    </View>
  );
}

function Dot({ active, color }: { active: boolean; color: string }) {
  return (
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: active ? color : colors.border,
      }}
    />
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      {icon}
      <Text className="text-text-muted text-[10px]">{label}</Text>
    </View>
  );
}

/**
 * Calcula quantos dias consecutivos, a partir de hoje ou ontem, têm atividade.
 * Regra: conta pra trás; se o dia mais recente (hoje) tem atividade, começa
 * em 1. Se não tem, verifica ontem e conta daí.
 */
export function calcStreak(days: DayActivity[]): number {
  if (days.length === 0) return 0;
  const ordered = [...days].reverse(); // mais recente primeiro
  let streak = 0;
  let started = false;

  for (const d of ordered) {
    const hasAny = d.hasFood || d.hasWorkout || d.hasWater;
    if (!started) {
      if (!hasAny && d.isToday) continue; // ainda não registrou hoje — pula
      if (!hasAny) break;
      started = true;
      streak += 1;
    } else {
      if (!hasAny) break;
      streak += 1;
    }
  }
  return streak;
}
