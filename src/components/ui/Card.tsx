import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  children: ReactNode;
  glow?: boolean;
  accent?: 'green' | 'violet' | 'none';
  padding?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

const padMap = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export default function Card({
  children,
  glow = false,
  accent = 'none',
  padding = 'md',
  style,
}: Props) {
  const glowColors =
    accent === 'violet'
      ? (['rgba(139,92,246,0.16)', 'rgba(139,92,246,0)'] as const)
      : (['rgba(57,255,20,0.10)', 'rgba(57,255,20,0)'] as const);

  return (
    <View
      className={`rounded-3xl border border-border bg-surface overflow-hidden ${padMap[padding]}`}
      style={[
        glow
          ? {
              shadowColor: accent === 'violet' ? '#8B5CF6' : '#39FF14',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.22,
              shadowRadius: 22,
              elevation: 4,
            }
          : undefined,
        style,
      ]}
    >
      {glow && (
        <LinearGradient
          colors={glowColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          pointerEvents="none"
        />
      )}
      <View>{children}</View>
    </View>
  );
}
