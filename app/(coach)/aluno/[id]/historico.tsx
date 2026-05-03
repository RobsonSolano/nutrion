import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  Beef,
  Droplet,
  History,
  Dumbbell,
} from 'lucide-react-native';
import { Card, MarkdownText, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import {
  usePlanRevisionDetail,
  useStudentPlanRevisions,
} from '@/hooks/usePlanHistory';
import type { PlanRevision } from '@/services/planHistory';

export default function HistoricoPlanos() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const revisionsQ = useStudentPlanRevisions(id ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!id) return null;

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
        <View className="flex-1">
          <Text className="text-text font-semibold text-base">
            Histórico de planos
          </Text>
          <Text className="text-text-muted text-[11px]">
            Cada geração de plano fica registrada aqui.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 80,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {revisionsQ.isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator color={colors.violetSoft} />
          </View>
        ) : revisionsQ.data && revisionsQ.data.length > 0 ? (
          revisionsQ.data.map((rev, idx) => (
            <RevisionCard
              key={rev.id}
              revision={rev}
              isLatest={idx === 0}
              isExpanded={expanded === rev.id}
              onToggle={() =>
                setExpanded((prev) => (prev === rev.id ? null : rev.id))
              }
            />
          ))
        ) : (
          <Card padding="md">
            <View className="items-center gap-2 py-8">
              <View className="h-12 w-12 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
                <History size={20} color={colors.violetSoft} />
              </View>
              <Text className="text-text text-sm font-semibold">
                Sem histórico
              </Text>
              <Text className="text-text-muted text-xs text-center px-4 leading-relaxed">
                Os planos gerados ficam registrados aqui a partir desta
                versão. Planos antigos (anteriores ao histórico) não estão
                disponíveis.
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function RevisionCard({
  revision,
  isLatest,
  isExpanded,
  onToggle,
}: {
  revision: PlanRevision;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const date = new Date(revision.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = new Date(revision.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card padding="md" glow={isLatest} accent={isLatest ? 'green' : undefined}>
      <Pressable onPress={onToggle} hitSlop={4} className="active:opacity-80">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-text text-sm font-semibold">
                {date} · {time}
              </Text>
              {isLatest && (
                <View className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
                  <Text className="text-accent text-[10px] font-bold">
                    ATIVO
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-text-muted text-[11px] mt-1">
              {revision.routines_count} rotina
              {revision.routines_count === 1 ? '' : 's'}
              {revision.calorie_goal != null
                ? ` · ${revision.calorie_goal} kcal · ${revision.protein_goal_g}g prot · ${(revision.water_goal_ml ?? 0) / 1000}L água`
                : ''}
            </Text>
          </View>
          {isExpanded ? (
            <ChevronUp size={16} color={colors.textDim} />
          ) : (
            <ChevronDown size={16} color={colors.textDim} />
          )}
        </View>
      </Pressable>

      {isExpanded && <RevisionDetails revisionId={revision.id} />}
    </Card>
  );
}

function RevisionDetails({ revisionId }: { revisionId: string }) {
  const detailQ = usePlanRevisionDetail(revisionId);

  if (detailQ.isLoading) {
    return (
      <View className="py-6 items-center">
        <ActivityIndicator color={colors.violetSoft} />
      </View>
    );
  }

  if (!detailQ.data) {
    return (
      <Text className="text-text-muted text-xs py-4">
        Não consegui carregar os detalhes.
      </Text>
    );
  }

  const { revision, routines } = detailQ.data;

  return (
    <View className="mt-4 gap-3 border-t border-border-subtle pt-4">
      {revision.rationale && (
        <View>
          <Text className="text-text-dim text-[10px] uppercase tracking-widest mb-1">
            Raciocínio
          </Text>
          <MarkdownText
            value={revision.rationale}
            textColor={colors.textDim}
            fontSize={12}
          />
        </View>
      )}

      <View>
        <Text className="text-text-dim text-[10px] uppercase tracking-widest mb-2">
          Metas
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Pill
            icon={<Flame size={11} color={colors.accent} />}
            label={`${revision.calorie_goal ?? '?'} kcal`}
          />
          <Pill
            icon={<Beef size={11} color={colors.violetSoft} />}
            label={`${revision.protein_goal_g ?? '?'}g prot`}
          />
          <Pill
            icon={<Droplet size={11} color={colors.info} />}
            label={`${(revision.water_goal_ml ?? 0) / 1000}L água`}
          />
        </View>
      </View>

      {routines.length > 0 && (
        <View>
          <Text className="text-text-dim text-[10px] uppercase tracking-widest mb-2">
            Rotinas ({routines.length})
          </Text>
          <View className="gap-2">
            {routines.map((r) => (
              <View
                key={r.id}
                className="rounded-2xl border border-border bg-surface-muted p-3"
              >
                <View className="flex-row items-center gap-2 mb-1">
                  <Dumbbell size={12} color={colors.accent} />
                  <Text className="text-text text-xs font-semibold flex-1">
                    {r.name}
                  </Text>
                  <Text className="text-text-muted text-[10px]">
                    {r.exercises.length} ex
                  </Text>
                </View>
                {r.description && (
                  <Text className="text-text-muted text-[10px] mb-1.5">
                    {r.description}
                  </Text>
                )}
                <View className="gap-0.5">
                  {r.exercises.slice(0, 6).map((ex, j) => (
                    <Text
                      key={j}
                      className="text-text-dim text-[11px]"
                      numberOfLines={1}
                    >
                      • {ex.exercise_name} — {ex.sets ?? '?'}×
                      {ex.reps_min ?? '?'}-{ex.reps_max ?? '?'}
                    </Text>
                  ))}
                  {r.exercises.length > 6 && (
                    <Text className="text-text-muted text-[10px]">
                      + {r.exercises.length - 6} outros
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Pill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1">
      {icon}
      <Text className="text-text-dim text-[11px]">{label}</Text>
    </View>
  );
}
