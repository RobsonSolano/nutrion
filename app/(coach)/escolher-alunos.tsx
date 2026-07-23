import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Button, Card, Screen } from '@/components/ui';
import Checkbox from '@/components/ui/Checkbox';
import { useStudents, useSetActiveStudents } from '@/hooks/useStudents';
import { useDowngradeStatus } from '@/hooks/useDowngradeStatus';
import { useAlert } from '@/components/GlobalAlertProvider';
import { activeIds } from '@/lib/suspension';
import { colors } from '@/lib/theme';

/**
 * Seletor de alunos ATIVOS após downgrade. O professor marca até `limit`
 * alunos que ficam ativos; os demais ficam suspensos (sem acesso ao app até
 * reativar ou dar upgrade). NÃO desvincula/deleta — suspensão é reversível.
 */
export default function EscolherAlunosScreen() {
  const router = useRouter();
  const alert = useAlert();
  const studentsQ = useStudents();
  const { studentLimit } = useDowngradeStatus();
  const setActive = useSetActiveStudents();

  const students = studentsQ.data ?? [];
  const limit = studentLimit ?? 0;
  const [kept, setKept] = useState<Set<string>>(
    () => new Set(activeIds(students).slice(0, limit)),
  );
  const [working, setWorking] = useState(false);

  const toggle = (id: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < limit) next.add(id); // não passa do limite
      return next;
    });
  };

  const canConfirm = kept.size > 0 && kept.size <= limit && !working;

  async function handleConfirm() {
    setWorking(true);
    try {
      await setActive.mutateAsync(Array.from(kept));
      router.back();
    } catch (err) {
      alert.showError(err);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <Text className="text-text font-semibold">Quem fica ativo</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card accent="violet" padding="md">
          <Text className="text-text-dim text-[13px] leading-relaxed">
            Seu plano permite <Text className="text-text font-semibold">{limit}</Text> alunos
            ativos. Marque quem continua com acesso — os não marcados ficam{' '}
            <Text className="text-text font-semibold">suspensos</Text> (sem acesso ao app até
            você reativar ou fazer upgrade). Nada é apagado. Selecionados: {kept.size}/{limit}.
          </Text>
        </Card>

        {students.map((s) => (
          <Card key={s.id} padding="md">
            <Checkbox checked={kept.has(s.id)} onChange={() => toggle(s.id)}>
              <Text className="text-text text-[15px] font-semibold">
                {s.full_name ?? 'Aluno'}
              </Text>
            </Checkbox>
          </Card>
        ))}
      </ScrollView>

      <View className="px-5 pb-2">
        <Button
          label={working ? 'Salvando…' : `Salvar (${kept.size} ativo${kept.size === 1 ? '' : 's'})`}
          onPress={handleConfirm}
          variant="primary"
          size="lg"
          fullWidth
          loading={working}
          disabled={!canConfirm}
        />
      </View>
    </Screen>
  );
}
