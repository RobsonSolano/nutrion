import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Card, Screen, SegmentedControl } from '@/components/ui';
import ProgressTimeline from '@/components/ProgressTimeline';
import AssessmentList from '@/components/coach/AssessmentList';
import { useStudentDetail } from '@/hooks/useStudents';
import { colors } from '@/lib/theme';

type ViewMode = 'avaliacoes' | 'marcos';

const TABS: readonly { value: ViewMode; label: string }[] = [
  { value: 'avaliacoes', label: 'Avaliações' },
  { value: 'marcos', label: 'Marcos' },
];

export default function EvolucaoAlunoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detailQ = useStudentDetail(id ?? null);
  const [view, setView] = useState<ViewMode>('avaliacoes');

  if (!id) return null;

  const studentName = detailQ.data?.profile.full_name ?? 'aluno';

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
          <Text className="text-text font-semibold">Evolução</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            gap: 14,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          <SegmentedControl options={TABS} value={view} onChange={setView} />

          {view === 'avaliacoes' ? (
            <AssessmentList studentId={id} />
          ) : (
            <>
              <Card padding="md">
                <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
                  Marcos de {studentName}
                </Text>
                <Text className="text-text-muted text-xs leading-relaxed">
                  Registros que o aluno fez. Você só lê — quem registra é o
                  próprio aluno pelo perfil dele.
                </Text>
              </Card>

              <ProgressTimeline
                userId={id}
                canEdit={false}
                emptyMessage="O aluno ainda não registrou nenhum marco."
              />
            </>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}
