import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';

type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  colorSoft?: string;
  showDots?: boolean;
  showFill?: boolean;
};

export default function Sparkline({
  values,
  width = 120,
  height = 40,
  color = colors.accent,
  colorSoft = colors.accentDeep,
  showDots = true,
  showFill = true,
}: Props) {
  if (!values || values.length === 0) {
    return <View style={{ width, height }} />;
  }

  if (values.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <Svg width={width} height={height}>
        <Circle cx={cx} cy={cy} r={3} fill={color} />
      </Svg>
    );
  }

  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const step = w / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padding + i * step;
    const y = padding + h - ((v - min) / range) * h;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colorSoft} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      {showFill && <Path d={fillD} fill="url(#spark-fill)" />}
      <Path
        d={pathD}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        points.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 2.5 : 1.5}
            fill={i === points.length - 1 ? color : colorSoft}
          />
        ))}
    </Svg>
  );
}
