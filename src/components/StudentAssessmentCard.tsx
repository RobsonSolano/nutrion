import { Text, View } from 'react-native';
import { Ruler } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { useLatestPhysicalAssessment } from '@/hooks/usePhysicalAssessments';
import { colors } from '@/lib/theme';
import type { PhysicalAssessment } from '@/types/database';

type Props = {
  studentId: string;
};

export default function StudentAssessmentCard({ studentId }: Props) {
  const q = useLatestPhysicalAssessment(studentId);
  const a = q.data;

  if (q.isLoading) return null;
  if (!a) return null; // Sem avaliação registrada — coach ainda não fez

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Ruler size={14} color={colors.accent} />
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            Última avaliação
          </Text>
        </View>
        <Text className="text-text-muted text-xs">
          {formatDate(a.assessed_at)}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {pickStats(a).map((s) => (
          <View
            key={s.label}
            className="rounded-2xl border border-border bg-surface-muted px-3 py-2"
            style={{ minWidth: 78 }}
          >
            <Text className="text-text-muted text-[10px] uppercase tracking-wider">
              {s.label}
            </Text>
            <Text className="text-text text-base font-semibold">
              {s.value}
              {s.unit ? (
                <Text className="text-text-dim text-xs"> {s.unit}</Text>
              ) : null}
            </Text>
          </View>
        ))}
      </View>

      <Text className="text-text-muted text-[11px] mt-3 leading-relaxed">
        Quem registra é o seu coach. Acompanhe a evolução conversando com
        ele(a).
      </Text>
    </Card>
  );
}

function pickStats(a: PhysicalAssessment) {
  const out: { label: string; value: string; unit?: string }[] = [];
  if (a.weight_kg != null)
    out.push({ label: 'Peso', value: fmt(a.weight_kg), unit: 'kg' });
  if (a.body_fat_pct != null)
    out.push({ label: '% Gord.', value: fmt(a.body_fat_pct), unit: '%' });
  if (a.bmi != null) out.push({ label: 'IMC', value: fmt(a.bmi) });
  if (a.lean_mass_kg != null)
    out.push({ label: 'M. magra', value: fmt(a.lean_mass_kg), unit: 'kg' });
  if (a.perim_waist_cm != null)
    out.push({ label: 'Cintura', value: fmt(a.perim_waist_cm), unit: 'cm' });
  return out;
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
