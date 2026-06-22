import { Image, Text, View } from 'react-native';
import symbol from './logo-symbol.png';

type Props = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tagline?: boolean;
};

const symbolSize = {
  sm: 36,
  md: 52,
  lg: 76,
  xl: 104,
} as const;

const textSize = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
} as const;

export default function Logo({ size = 'lg', tagline = false }: Props) {
  return (
    <View className="items-center">
      <Image
        source={symbol}
        style={{ width: symbolSize[size], height: symbolSize[size] }}
        resizeMode="contain"
      />
      <Text className={`${textSize[size]} font-bold tracking-tight text-text mt-3`}>
        Persona <Text className="text-accent">Fit</Text>
      </Text>
      {tagline && (
        <Text className="text-text-dim text-xs tracking-[3px] uppercase mt-2">
          Biohacking · Nutrição · Treino
        </Text>
      )}
    </View>
  );
}
