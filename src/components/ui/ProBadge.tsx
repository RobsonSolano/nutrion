import { Text, View } from 'react-native';

type Props = {
  /** 'sm' pra inline em CTAs; 'md' pra destaque. */
  size?: 'sm' | 'md';
  label?: string;
};

/**
 * Pílula "PRO" — sinaliza recurso pago (gating proativo do paywall-ui).
 * Usa o roxo da marca (violet) pra distinguir do verde de ação (accent).
 */
export default function ProBadge({ size = 'sm', label = 'PRO' }: Props) {
  const isSm = size === 'sm';
  return (
    <View
      className={`flex-row items-center self-start rounded-full bg-violet/20 border border-violet ${
        isSm ? 'px-2 py-0.5' : 'px-2.5 py-1'
      }`}
    >
      <Text
        className={`font-bold tracking-wider text-violet-soft ${
          isSm ? 'text-[10px]' : 'text-xs'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
