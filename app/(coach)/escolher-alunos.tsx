import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Button, Card, Screen } from '@/components/ui';
import Checkbox from '@/components/ui/Checkbox';
import { useStudents, useUnlinkStudent } from '@/hooks/useStudents';
import { useDowngradeStatus } from '@/hooks/useDowngradeStatus';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/components/GlobalAlertProvider';
import { queryKeys } from '@/lib/queryKeys';
import { colors } from '@/lib/theme';

/**
 * "Escolhe quem fica" (revenuecat-integration #5a, [RC]-04). Professor que sofreu downgrade
 * (acima do novo limite) escolhe quais alunos mantém; os demais são desvinculados (viram
 * comum + ganham trial, via coach-unlink-student do #3).
 */
export default function EscolherAlunosScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const alert = useAlert();
  const studentsQ = useStudents();
  const { studentLimit } = useDowngradeStatus();
  const unlink = useUnlinkStudent();

  const students = studentsQ.data ?? [];
  const limit = studentLimit ?? 0;
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const toggle = (id: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < limit) next.add(id); // não deixa passar do limite
      return next;
    });
  };

  const canConfirm = kept.size > 0 && kept.size <= limit && !working;

  async function handleConfirm() {
    const toUnlink = students.filter((s) => !kept.has(s.id));
    setWorking(true);
    try {
      // Paralelo + tolerante: os que falharem não derrubam os que deram certo.
      const results = await Promise.allSettled(
        toUnlink.map((s) => unlink.mutateAsync(s.id)),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        // Os bem-sucedidos já saíram da lista (invalidação no hook); re-tentar resolve o resto.
        alert.showAlert({
          type: 'error',
          title: 'Alguns não saíram',
          message: `${failed} aluno(s) não foram desvinculados. Tenta de novo.`,
        });
        return;
      }
      if (user?.id) {
        await qc.invalidateQueries({ queryKey: queryKeys.entitlement(user.id) });
      }
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
        <Text className="text-text font-semibold">Escolha quem continua</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card accent="violet" padding="md">
          <Text className="text-text-dim text-[13px] leading-relaxed">
            Seu plano permite <Text className="text-text font-semibold">{limit}</Text> alunos.
            Marque quem continua com você — os não marcados viram contas individuais (e ganham
            7 dias de teste). Selecionados: {kept.size}/{limit}.
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
          label={working ? 'Aplicando…' : `Manter ${kept.size} e desvincular ${students.length - kept.size}`}
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
