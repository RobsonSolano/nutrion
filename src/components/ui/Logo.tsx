import { Text, View } from 'react-native';

type Props = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tagline?: boolean;
};

const sizeMap = {
  sm: 'text-2xl',
  md: 'text-4xl',
  lg: 'text-5xl',
  xl: 'text-6xl',
} as const;

export default function Logo({ size = 'lg', tagline = false }: Props) {
  return (
    <View className="items-center">
      <Text
        className={`${sizeMap[size]} font-bold tracking-tight text-text`}
        style={{
          textShadowColor: 'rgba(57,255,20,0.35)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20,
        }}
      >
        Nutri<Text className="text-accent">On</Text>
      </Text>
      {tagline && (
        <Text className="text-text-dim text-xs tracking-[3px] uppercase mt-2">
          Biohacking · Nutrição · Treino
        </Text>
      )}
    </View>
  );
}
