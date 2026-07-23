import { Pressable, Text, View } from 'react-native';
import { Crown, Sparkles, ArrowUpRight } from 'lucide-react-native';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useStudents } from '@/hooks/useStudents';
import { openPaywall } from '@/lib/paywall';
import { colors } from '@/lib/theme';

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Premium',
};

/**
 * Badge de plano na home do professor: mostra o tier atual + uso de alunos
 * (X/limite) e, quando não é premium, um atalho de upgrade (abre o paywall).
 * Premium ganha coroa e sem contador (ilimitado).
 */
export default function CoachPlanBadge() {
  const ent = useEntitlement().data;
  const count = useStudents().data?.length ?? 0;

  const tier = ent?.tier ?? 'free';
  const limit = ent?.student_limit; // null = ilimitado
  const isPremium = tier === 'premium';
  const canUpgrade = !isPremium;
  const atLimit = limit != null && count >= limit;

  const upgradeFeature = tier === 'pro' ? 'student_limit' : 'coach_generate_plan';

  const accent = isPremium ? colors.accent : colors.violetSoft;

  return (
    <View
      className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
      style={{
        borderColor: `${accent}55`,
        backgroundColor: `${accent}12`,
      }}
    >
      <View className="flex-row items-center gap-2.5 flex-1">
        {isPremium ? (
          <Crown size={18} color={colors.accent} />
        ) : (
          <Sparkles size={18} color={accent} />
        )}
        <View className="flex-1">
          <Text className="text-text text-sm font-bold">
            Plano {TIER_LABEL[tier] ?? 'Free'}
          </Text>
          <Text
            className="text-[12px] mt-0.5"
            style={{ color: atLimit ? colors.warn : colors.textDim }}
          >
            {limit == null
              ? 'Alunos ilimitados'
              : `${count}/${limit} aluno${limit === 1 ? '' : 's'}${atLimit ? ' · limite atingido' : ''}`}
          </Text>
        </View>
      </View>

      {canUpgrade && (
        <Pressable
          onPress={() => openPaywall(upgradeFeature)}
          hitSlop={6}
          className="flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70"
          style={{ borderColor: `${colors.accent}66`, backgroundColor: `${colors.accent}18` }}
        >
          <Text className="text-accent text-[12px] font-bold">Fazer upgrade</Text>
          <ArrowUpRight size={13} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}
