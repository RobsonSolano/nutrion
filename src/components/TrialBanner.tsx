import { Pressable, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { openPaywall } from '@/lib/paywall';

/**
 * Aviso discreto de período de teste (trial de servidor, spec #3). Mostra os dias
 * restantes e leva ao paywall. Some quando o usuário não está em trial.
 */
export default function TrialBanner() {
  const { inTrial, daysLeft } = useTrialStatus();
  if (!inTrial) return null;

  const plural = daysLeft === 1 ? '' : 's';

  return (
    <Pressable
      onPress={() => openPaywall('chat')}
      className="flex-row items-center gap-2 rounded-2xl border border-violet/40 bg-violet/10 px-4 py-2.5 active:opacity-80"
    >
      <Sparkles size={16} color={colors.violetSoft} />
      <Text className="text-text text-[13px] font-semibold flex-1">
        Período de teste · {daysLeft} dia{plural} restante{plural}
      </Text>
      <Text className="text-violet-soft text-[12px] font-semibold">Assinar</Text>
    </Pressable>
  );
}
