import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { colors } from '@/lib/theme';

export default function Disclaimer() {
  return (
    <View className="flex-row items-start gap-2 rounded-2xl border border-border-subtle bg-surface-muted px-4 py-3">
      <Info size={14} color={colors.textMuted} />
      <Text className="flex-1 text-text-muted text-[11px] leading-relaxed">
        Uso informativo. Decisões de saúde devem ser validadas com médico,
        nutricionista ou educador físico.
      </Text>
    </View>
  );
}
