import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, HeartPulse } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { useAnamnese } from '@/hooks/useAnamnese';
import { colors } from '@/lib/theme';
import type { StudentAnamnese } from '@/types/database';

type Props = {
  studentId: string;
};

export default function StudentAnamneseCard({ studentId }: Props) {
  const router = useRouter();
  const q = useAnamnese(studentId);
  const a = q.data;

  function open() {
    router.push(`/(coach)/aluno/${studentId}/anamnese` as never);
  }

  return (
    <Pressable onPress={open} className="active:opacity-80">
      <Card padding="md">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
            <HeartPulse size={20} color={colors.violetSoft} />
          </View>
          <View className="flex-1">
            <Text className="text-text text-sm font-semibold">
              Anamnese clínica
            </Text>
            <Text className="text-text-muted text-[11px] mt-0.5">
              {summary(a)}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textDim} />
        </View>

        {a && hasContent(a) && (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {a.injuries.length > 0 && (
              <Badge label={`${a.injuries.length} lesão(ões)`} />
            )}
            {a.chronic_conditions.length > 0 && (
              <Badge label={`${a.chronic_conditions.length} doença(s)`} />
            )}
            {a.surgeries.length > 0 && (
              <Badge label={`${a.surgeries.length} cirurgia(s)`} />
            )}
            {a.dietary_restrictions.length > 0 && (
              <Badge
                label={`${a.dietary_restrictions.length} restrição(ões) alim.`}
              />
            )}
            {a.has_medical_clearance === true && (
              <Badge label="Liberação médica" />
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-surface-muted border border-border px-2.5 py-1">
      <Text className="text-text-dim text-[10px] font-semibold">{label}</Text>
    </View>
  );
}

function summary(a: StudentAnamnese | null | undefined): string {
  if (!a) return 'Carregando…';
  if (!a.filled_at) return 'Aluno ainda não preencheu';
  return `Atualizada em ${formatDate(a.filled_at)}`;
}

function hasContent(a: StudentAnamnese): boolean {
  return (
    a.injuries.length > 0
    || a.chronic_conditions.length > 0
    || a.surgeries.length > 0
    || a.dietary_restrictions.length > 0
    || a.has_medical_clearance === true
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
