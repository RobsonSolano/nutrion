import { Pressable, Text, View, ViewStyle } from 'react-native';
import ProBadge from './ProBadge';
import { openPaywall } from '@/lib/paywall';

type Props = {
  /** Feature key do billing-core — define a copy do paywall ao tocar. */
  feature: string;
  title: string;
  description: string;
  style?: ViewStyle;
};

/**
 * Aviso de recurso bloqueado (gating proativo do paywall-ui). Padrão visual único
 * reusado em chat, sanity check e área do coach. Toque → paywall contextual.
 */
export default function PaywallNotice({
  feature,
  title,
  description,
  style,
}: Props) {
  return (
    <Pressable
      onPress={() => openPaywall(feature)}
      style={style}
      className="rounded-2xl border border-violet/40 bg-violet/10 px-4 py-3 active:opacity-80"
    >
      <View className="flex-row items-center gap-2 mb-1">
        <ProBadge />
        <Text className="text-text text-[13px] font-semibold">{title}</Text>
      </View>
      <Text className="text-text-dim text-[12px] leading-relaxed">
        {description}
      </Text>
    </Pressable>
  );
}
