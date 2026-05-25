import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';
import { Card, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import type { PhysicalAssessment } from '@/types/database';

type MetricKey = 'weight_kg' | 'body_fat_pct' | 'bmi' | 'perim_waist_cm';

const METRICS: readonly { value: MetricKey; label: string; unit: string }[] = [
  { value: 'weight_kg', label: 'Peso', unit: 'kg' },
  { value: 'body_fat_pct', label: '%G', unit: '%' },
  { value: 'bmi', label: 'IMC', unit: '' },
  { value: 'perim_waist_cm', label: 'Cintura', unit: 'cm' },
];

const W = 320;
const H = 180;
const PAD_X = 36;
const PAD_TOP = 16;
const PAD_BOT = 32;

type Props = {
  assessments: PhysicalAssessment[];
};

export default function EvolutionChart({ assessments }: Props) {
  const [metric, setMetric] = useState<MetricKey>('weight_kg');

  // Ordena cronologicamente (mais antiga primeiro) e filtra os com valor
  const points = useMemo(() => {
    const sorted = [...assessments].sort((a, b) =>
      a.assessed_at.localeCompare(b.assessed_at),
    );
    return sorted
      .map((a) => ({ date: a.assessed_at, value: a[metric] as number | null }))
      .filter((p): p is { date: string; value: number } => p.value != null);
  }, [assessments, metric]);

  const meta = METRICS.find((m) => m.value === metric)!;

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest">
          Evolução
        </Text>
        <Text className="text-text-muted text-xs">
          {points.length} {points.length === 1 ? 'ponto' : 'pontos'}
        </Text>
      </View>

      <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />

      <View className="mt-4">
        {points.length < 2 ? (
          <View className="py-8 items-center">
            <Text className="text-text-muted text-xs text-center px-4">
              {points.length === 0
                ? `Sem dados de ${meta.label} nas avaliações.`
                : 'Cadastre pelo menos duas avaliações para ver evolução.'}
            </Text>
          </View>
        ) : (
          <ChartSvg points={points} unit={meta.unit} />
        )}
      </View>
    </Card>
  );
}

function ChartSvg({
  points,
  unit,
}: {
  points: { date: string; value: number }[];
  unit: string;
}) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // padding vertical (5% pra cima e pra baixo, mínimo 1)
  const span = Math.max(max - min, 1);
  const yMin = min - span * 0.1;
  const yMax = max + span * 0.1;

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOT;

  function scaleX(i: number) {
    return PAD_X + (innerW * i) / (points.length - 1);
  }
  function scaleY(v: number) {
    return PAD_TOP + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  }

  const polylinePoints = points
    .map((p, i) => `${scaleX(i)},${scaleY(p.value)}`)
    .join(' ');

  // Área sob a linha (gradient suave)
  const areaPath =
    `M ${scaleX(0)} ${PAD_TOP + innerH} ` +
    points
      .map((p, i) => `L ${scaleX(i)} ${scaleY(p.value)}`)
      .join(' ') +
    ` L ${scaleX(points.length - 1)} ${PAD_TOP + innerH} Z`;

  // Marcas do eixo Y: min, mid, max
  const yMid = (yMin + yMax) / 2;
  const yMarks = [yMax, yMid, yMin];

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* gridlines + labels Y */}
        {yMarks.map((v) => (
          <Line
            key={`grid-${v}`}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={scaleY(v)}
            y2={scaleY(v)}
            stroke={colors.border}
            strokeWidth={0.5}
          />
        ))}
        {yMarks.map((v) => (
          <SvgText
            key={`ylab-${v}`}
            x={PAD_X - 6}
            y={scaleY(v) + 3}
            fontSize="9"
            fill={colors.textMuted}
            textAnchor="end"
          >
            {fmt(v)}
          </SvgText>
        ))}

        {/* área */}
        <Path d={areaPath} fill={colors.accent} fillOpacity={0.08} />

        {/* linha */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* pontos */}
        {points.map((p, i) => (
          <Circle
            key={`pt-${i}`}
            cx={scaleX(i)}
            cy={scaleY(p.value)}
            r={3.5}
            fill={colors.accent}
            stroke={colors.bgDeep}
            strokeWidth={1.5}
          />
        ))}

        {/* labels X — primeiro e último */}
        <SvgText
          x={scaleX(0)}
          y={H - 10}
          fontSize="9"
          fill={colors.textMuted}
          textAnchor="start"
        >
          {shortDate(points[0].date)}
        </SvgText>
        <SvgText
          x={scaleX(points.length - 1)}
          y={H - 10}
          fontSize="9"
          fill={colors.textMuted}
          textAnchor="end"
        >
          {shortDate(points[points.length - 1].date)}
        </SvgText>
      </Svg>

      <View className="flex-row justify-between mt-2 px-2">
        <Pill label="Mín" value={`${fmt(min)} ${unit}`} />
        <Pill label="Atual" value={`${fmt(values[values.length - 1])} ${unit}`} />
        <Pill label="Máx" value={`${fmt(max)} ${unit}`} />
      </View>
    </View>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-xl bg-surface-muted border border-border px-3 py-1.5">
      <Text className="text-text-muted text-[9px] uppercase tracking-wider text-center">
        {label}
      </Text>
      <Text className="text-text text-xs font-semibold text-center">
        {value}
      </Text>
    </View>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}
