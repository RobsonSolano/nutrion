import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Card, Screen } from '@/components/ui';
import { usePhysicalAssessment } from '@/hooks/usePhysicalAssessments';
import { colors } from '@/lib/theme';
import type { PhysicalAssessment } from '@/types/database';

export default function CompararAvaliacaoScreen() {
  const router = useRouter();
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const queryA = usePhysicalAssessment(a ?? null);
  const queryB = usePhysicalAssessment(b ?? null);

  const dataA = queryA.data;
  const dataB = queryB.data;
  const loading = queryA.isLoading || queryB.isLoading;
  // Mais antiga à esquerda, mais recente à direita — facilita ler "evolução"
  const [older, newer] = orderByDate(dataA, dataB);
  const daysBetween =
    older && newer
      ? Math.round(
          (new Date(`${newer.assessed_at}T00:00:00`).getTime() -
            new Date(`${older.assessed_at}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Screen variant="hero" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Comparar</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <Card padding="md">
              <Text className="text-text-muted text-xs">Carregando…</Text>
            </Card>
          ) : !older || !newer ? (
            <Card padding="md">
              <Text className="text-text font-semibold mb-1">
                Não foi possível comparar
              </Text>
              <Text className="text-text-muted text-xs">
                Uma das avaliações não foi encontrada.
              </Text>
            </Card>
          ) : (
            <>
              <Card padding="md">
                <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
                  Período comparado
                </Text>
                <Text className="text-text text-base font-semibold">
                  {formatDate(older.assessed_at)}  →  {formatDate(newer.assessed_at)}
                </Text>
                {daysBetween != null && (
                  <Text className="text-text-muted text-xs mt-1">
                    {daysBetween === 0
                      ? 'mesmo dia'
                      : `${daysBetween} ${daysBetween === 1 ? 'dia' : 'dias'} entre as avaliações`}
                  </Text>
                )}
              </Card>

              <CompareBlock
                title="Composição"
                rows={composicaoRows(older, newer)}
              />
              <CompareBlock
                title="Perimetria (cm)"
                rows={perimetriaRows(older, newer)}
              />
              {(older.protocol !== 'none' || newer.protocol !== 'none') && (
                <CompareBlock
                  title="Dobras (mm)"
                  rows={dobrasRows(older, newer)}
                />
              )}
            </>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

// =====================================================================
// Bloco genérico de comparação
// =====================================================================
type Row = {
  label: string;
  oldVal: number | null;
  newVal: number | null;
  unit?: string;
  fractionDigits?: number;
};

function CompareBlock({ title, rows }: { title: string; rows: Row[] }) {
  const visible = rows.filter((r) => r.oldVal != null || r.newVal != null);
  if (visible.length === 0) return null;
  return (
    <Card padding="md">
      <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
        {title}
      </Text>
      {/* Header */}
      <View className="flex-row pb-2 border-b border-border-subtle">
        <Text className="flex-1 text-text-muted text-[11px] uppercase tracking-wider">
          Métrica
        </Text>
        <Text
          className="text-text-muted text-[11px] uppercase tracking-wider text-right"
          style={{ width: 70 }}
        >
          Antes
        </Text>
        <Text
          className="text-text-muted text-[11px] uppercase tracking-wider text-right"
          style={{ width: 70 }}
        >
          Depois
        </Text>
        <Text
          className="text-text-muted text-[11px] uppercase tracking-wider text-right"
          style={{ width: 70 }}
        >
          Δ
        </Text>
      </View>
      {visible.map((r) => (
        <RowView key={r.label} row={r} />
      ))}
    </Card>
  );
}

function RowView({ row }: { row: Row }) {
  const delta =
    row.oldVal != null && row.newVal != null
      ? row.newVal - row.oldVal
      : null;
  const digits = row.fractionDigits ?? 1;

  return (
    <View className="flex-row py-2 items-center">
      <Text className="flex-1 text-text text-sm">{row.label}</Text>
      <Text
        className="text-text-dim text-sm text-right"
        style={{ width: 70 }}
      >
        {fmt(row.oldVal, digits, row.unit)}
      </Text>
      <Text
        className="text-text text-sm font-semibold text-right"
        style={{ width: 70 }}
      >
        {fmt(row.newVal, digits, row.unit)}
      </Text>
      <Text
        className="text-sm font-semibold text-right"
        style={{
          width: 70,
          color:
            delta == null
              ? colors.textMuted
              : delta === 0
                ? colors.textDim
                : colors.text,
        }}
      >
        {fmtDelta(delta, digits)}
      </Text>
    </View>
  );
}

// =====================================================================
// Constructors das linhas
// =====================================================================
function composicaoRows(o: PhysicalAssessment, n: PhysicalAssessment): Row[] {
  return [
    { label: 'Peso', oldVal: o.weight_kg, newVal: n.weight_kg, unit: 'kg' },
    { label: 'IMC', oldVal: o.bmi, newVal: n.bmi, fractionDigits: 1 },
    { label: '% Gordura', oldVal: o.body_fat_pct, newVal: n.body_fat_pct, unit: '%' },
    { label: 'Massa gorda', oldVal: o.fat_mass_kg, newVal: n.fat_mass_kg, unit: 'kg' },
    { label: 'Massa magra', oldVal: o.lean_mass_kg, newVal: n.lean_mass_kg, unit: 'kg' },
  ];
}

function perimetriaRows(o: PhysicalAssessment, n: PhysicalAssessment): Row[] {
  return [
    { label: 'Braço esq.', oldVal: o.perim_arm_l_cm, newVal: n.perim_arm_l_cm },
    { label: 'Braço dir.', oldVal: o.perim_arm_r_cm, newVal: n.perim_arm_r_cm },
    { label: 'Antebraço esq.', oldVal: o.perim_forearm_l_cm, newVal: n.perim_forearm_l_cm },
    { label: 'Antebraço dir.', oldVal: o.perim_forearm_r_cm, newVal: n.perim_forearm_r_cm },
    { label: 'Peito', oldVal: o.perim_chest_cm, newVal: n.perim_chest_cm },
    { label: 'Cintura', oldVal: o.perim_waist_cm, newVal: n.perim_waist_cm },
    { label: 'Quadril', oldVal: o.perim_hip_cm, newVal: n.perim_hip_cm },
    { label: 'Coxa esq.', oldVal: o.perim_thigh_l_cm, newVal: n.perim_thigh_l_cm },
    { label: 'Coxa dir.', oldVal: o.perim_thigh_r_cm, newVal: n.perim_thigh_r_cm },
    { label: 'Pant. esq.', oldVal: o.perim_calf_l_cm, newVal: n.perim_calf_l_cm },
    { label: 'Pant. dir.', oldVal: o.perim_calf_r_cm, newVal: n.perim_calf_r_cm },
  ];
}

function dobrasRows(o: PhysicalAssessment, n: PhysicalAssessment): Row[] {
  return [
    { label: 'Peitoral', oldVal: o.skin_chest_mm, newVal: n.skin_chest_mm },
    { label: 'Axilar', oldVal: o.skin_midaxillary_mm, newVal: n.skin_midaxillary_mm },
    { label: 'Tríceps', oldVal: o.skin_triceps_mm, newVal: n.skin_triceps_mm },
    { label: 'Subescapular', oldVal: o.skin_subscapular_mm, newVal: n.skin_subscapular_mm },
    { label: 'Abdominal', oldVal: o.skin_abdominal_mm, newVal: n.skin_abdominal_mm },
    { label: 'Suprailíaca', oldVal: o.skin_suprailiac_mm, newVal: n.skin_suprailiac_mm },
    { label: 'Coxa', oldVal: o.skin_thigh_mm, newVal: n.skin_thigh_mm },
  ];
}

// =====================================================================
// Helpers
// =====================================================================
function orderByDate(
  a: PhysicalAssessment | null | undefined,
  b: PhysicalAssessment | null | undefined,
): [PhysicalAssessment | null, PhysicalAssessment | null] {
  if (!a || !b) return [a ?? null, b ?? null];
  return a.assessed_at <= b.assessed_at ? [a, b] : [b, a];
}

function fmt(n: number | null, digits: number, unit?: string): string {
  if (n == null) return '—';
  const s = n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return unit ? `${s}${unit === '%' ? unit : ''}` : s;
}

function fmtDelta(delta: number | null, digits: number): string {
  if (delta == null) return '—';
  if (delta === 0) return '0';
  const abs = Math.abs(delta).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return delta > 0 ? `+${abs}` : `−${abs}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
