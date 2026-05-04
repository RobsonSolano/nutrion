import { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft, MessageSquarePlus, MessagesSquare } from 'lucide-react-native';
import { Button, Card, Screen, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import {
  useMyRequests,
  useCancelRequest,
  useMarkRequestsSeen,
} from '@/hooks/useRequests';
import type {
  StudentRequest,
  StudentRequestStatus,
} from '@/types/database';

type Filter = 'all' | StudentRequestStatus;

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em and.' },
  { value: 'done', label: 'Conclu.' },
  { value: 'cancelled', label: 'Cancel.' },
] as const;

const STATUS_LABEL: Record<StudentRequestStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

export default function MinhasSolicitacoesScreen() {
  const router = useRouter();
  const requestsQ = useMyRequests();
  const cancelMutation = useCancelRequest();
  const markSeen = useMarkRequestsSeen();
  const [filter, setFilter] = useState<Filter>('all');

  // Marca como visto ao abrir a tela — zera o badge de não-lidas.
  useEffect(() => {
    void markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const all = requestsQ.data ?? [];
    if (filter === 'all') return all;
    return all.filter((r) => r.status === filter);
  }, [requestsQ.data, filter]);

  function handleCancel(req: StudentRequest) {
    Alert.alert(
      'Cancelar solicitação?',
      'Não pode ser desfeita. O professor vê como cancelada.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(req.id);
            } catch (err) {
              Alert.alert(
                'Não consegui cancelar',
                err instanceof Error ? err.message : 'Tenta de novo.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <Text className="text-text font-semibold text-base flex-1">
          Minhas solicitações
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 100,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />

        {requestsQ.isLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color={colors.violetSoft} />
          </View>
        ) : filtered.length === 0 ? (
          <Card padding="md">
            <View className="items-center gap-2 py-8">
              <View className="h-12 w-12 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
                <MessagesSquare size={20} color={colors.violetSoft} />
              </View>
              <Text className="text-text text-sm font-semibold">
                Nenhuma solicitação
              </Text>
              <Text className="text-text-muted text-xs text-center px-4 leading-relaxed">
                Use o botão abaixo pra abrir uma solicitação ao seu professor
                (mudar treino, relatar alergia, etc).
              </Text>
            </View>
          </Card>
        ) : (
          filtered.map((r) => (
            <RequestCard key={r.id} request={r} onCancel={() => handleCancel(r)} />
          ))
        )}

        <Button
          label="+ Nova solicitação"
          onPress={() => router.push('/solicitacoes/nova' as Href)}
          variant="primary"
          icon={<MessageSquarePlus size={18} color={colors.textInverse} />}
        />
      </ScrollView>
    </Screen>
  );
}

function RequestCard({
  request,
  onCancel,
}: {
  request: StudentRequest;
  onCancel: () => void;
}) {
  const statusLabel = STATUS_LABEL[request.status];
  const date = new Date(request.created_at).toLocaleDateString('pt-BR');
  const tone = statusTone(request.status);

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-2">
        <View
          className="rounded-full border px-2.5 py-0.5"
          style={{
            borderColor: `${tone}55`,
            backgroundColor: `${tone}15`,
          }}
        >
          <Text
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: tone }}
          >
            {statusLabel}
          </Text>
        </View>
        <Text className="text-text-muted text-[11px]">{date}</Text>
      </View>

      <Text className="text-text text-sm leading-relaxed">{request.message}</Text>

      {request.coach_response && (
        <View className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <Text className="text-accent text-[10px] uppercase tracking-widest font-semibold mb-1">
            Resposta do professor
          </Text>
          <Text className="text-text-dim text-xs leading-relaxed">
            {request.coach_response}
          </Text>
        </View>
      )}

      {request.status === 'open' && (
        <Pressable
          onPress={onCancel}
          className="self-start mt-3 rounded-full border border-danger/30 bg-danger/5 px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-danger text-[11px] font-semibold">
            Cancelar solicitação
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

function statusTone(status: StudentRequestStatus): string {
  switch (status) {
    case 'open':
      return colors.warn;
    case 'in_progress':
      return colors.violetSoft;
    case 'done':
      return colors.accent;
    case 'cancelled':
      return colors.textMuted;
  }
}
