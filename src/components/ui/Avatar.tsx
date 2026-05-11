import { Image, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

type Accent = 'green' | 'violet';

type Props = {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  accent?: Accent;
};

/** Mostra a foto do user OU um círculo com a primeira letra do nome. */
export default function Avatar({
  url,
  name,
  size = 48,
  accent = 'green',
}: Props) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const radius = size / 2;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const textColor = accent === 'violet' ? colors.violetSoft : colors.accent;
  const fontSize = Math.round(size * 0.42);

  return (
    <View
      className="bg-surface-raised border border-border-strong items-center justify-center"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Text className="font-bold" style={{ color: textColor, fontSize }}>
        {initial}
      </Text>
    </View>
  );
}
