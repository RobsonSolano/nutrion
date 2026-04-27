import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

type Props = {
  value: number;
  goal: number;
  label: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
  accent?: 'green' | 'violet';
};

export default function StatRing({
  value,
  goal,
  label,
  unit,
  size = 140,
  strokeWidth = 12,
  accent = 'green',
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const strokeOffset = circumference * (1 - pct);

  const gradId = `grad-${accent}`;
  const c1 = accent === 'violet' ? colors.violetSoft : colors.accent;
  const c2 = accent === 'violet' ? colors.violetDeep : colors.accentDeep;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} stopOpacity="1" />
            <Stop offset="1" stopColor={c2} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View className="items-center">
        <Text className="text-text text-3xl font-bold">
          {value.toLocaleString('pt-BR')}
        </Text>
        {unit && <Text className="text-text-dim text-xs">{unit}</Text>}
        <Text className="text-text-muted text-[10px] uppercase tracking-widest mt-1">
          {label}
        </Text>
      </View>
    </View>
  );
}
