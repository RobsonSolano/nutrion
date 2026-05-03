import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessagesSquare,
  Send,
  X,
} from 'lucide-react-native';
import { Button, Card, Input, Screen, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import {
  useCoachRequests,
  useRespondToRequest,
} from '@/hooks/useRequests';
import type {
  StudentRequestStatus,
} from '@/types/database';
import type { CoachRequestRow } from '@/services/requests';

type Filter = 'all' | StudentRequestStatus;

const FILTER_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em and.' },
  { value: 'done', label: 'Conclu.' },
  { value: 'all', label: 'Todas' },
] as const;

const STATUS_LABEL: Record<StudentRequestStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

export default function CoachSolicitacoesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('open');
  const requestsQ = useCoachRequests(filter);
  const respondMutation = useRespondToRequest();
  const [openItem, setOpenItem] = useState<CoachRequestRow | null>(null);

  const list = requestsQ.data ?? [];

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
          Solicitações
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 80,
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
        ) : list.length === 0 ? (
          <Card padding="md">
            <View className="items-center gap-2 py-8">
              <View className="h-12 w-12 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
                <MessagesSquare size={20} color={colors.violetSoft} />
              </View>
              <Text className="text-text text-sm font-semibold">
                Nada por aqui
              </Text>
              <Text className="text-text-muted text-xs text-center px-4 leading-relaxed">
                {filter === 'open'
                  ? 'Nenhuma solicitação aberta no momento.'
                  : 'Nenhuma solicitação nesse filtro.'}
              </Text>
            </View>
          </Card>
        ) : (
          list.map((r) => (
            <CoachRequestCard
              key={r.id}
              request={r}
              onPress={() => setOpenItem(r)}
            />
          ))
        )}
      </ScrollView>

      <RespondModal
        key={openItem?.id ?? 'closed'}
        request={openItem}
        onClose={() => setOpenItem(null)}
        onSubmit={async ({ status, response }) => {
          if (!openItem) return;
          try {
            await respondMutation.mutateAsync({
              requestId: openItem.id,
              status,
              response,
            });
            setOpenItem(null);
          } catch (err) {
            Alert.alert(
              'Não consegui salvar',
              err instanceof Error ? err.message : 'Tenta de novo.',
            );
          }
        }}
        saving={respondMutation.isPending}
      />
    </Screen>
  );
}

function CoachRequestCard({
  request,
  onPress,
}: {
  request: CoachRequestRow;
  onPress: () => void;
}) {
  const studentName = request.student?.full_name ?? 'Aluno sem nome';
  const date = new Date(request.created_at).toLocaleDateString('pt-BR');
  const tone = statusTone(request.status);

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card padding="md">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text text-sm font-semibold">{studentName}</Text>
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
              {STATUS_LABEL[request.status]}
            </Text>
          </View>
        </View>
        <Text
          className="text-text-dim text-xs leading-relaxed"
          numberOfLines={3}
        >
          {request.message}
        </Text>
        <Text className="text-text-muted text-[11px] mt-2">{date}</Text>
      </Card>
    </Pressable>
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

function RespondModal({
  request,
  onClose,
  onSubmit,
  saving,
}: {
  request: CoachRequestRow | null;
  onClose: () => void;
  onSubmit: (params: {
    status: StudentRequestStatus;
    response: string | null;
  }) => Promise<void>;
  saving: boolean;
}) {
  // O `key` no caller força remount a cada request — useState aqui
  // já entra com o valor inicial certo.
  const [response, setResponse] = useState(request?.coach_response ?? '');

  if (!request) return null;

  const studentName = request.student?.full_name ?? 'Aluno';

  return (
    <Modal
      visible={!!request}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'flex-end',
        }}
      >
        <View className="rounded-t-3xl bg-surface border-t border-border max-h-[88%]">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border-subtle">
            <Text className="text-text font-semibold text-base flex-1">
              {studentName}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="h-9 w-9 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <X size={16} color={colors.textDim} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{
              padding: 20,
              gap: 14,
              paddingBottom: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Card padding="md">
              <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
                Mensagem do aluno
              </Text>
              <Text className="text-text text-sm leading-relaxed">
                {request.message}
              </Text>
            </Card>

            <Card padding="md">
              <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
                Sua resposta (opcional)
              </Text>
              <Input
                value={response}
                onChangeText={(v) => v.length <= 1000 && setResponse(v)}
                placeholder="Resposta pro aluno (ele vê quando abrir a solicitação)..."
                multiline
                numberOfLines={4}
                style={{ minHeight: 110, textAlignVertical: 'top' }}
              />
              <Text className="text-text-muted text-[11px] text-right mt-2">
                {response.length}/1000
              </Text>
            </Card>

            <Text className="text-text-dim text-[11px] uppercase tracking-widest mt-2">
              Mudar status pra:
            </Text>
            <View className="gap-2">
              <Button
                label="Em andamento"
                onPress={() =>
                  onSubmit({ status: 'in_progress', response: response || null })
                }
                variant="secondary"
                icon={<Clock size={16} color={colors.text} />}
                loading={saving}
              />
              <Button
                label="Concluído"
                onPress={() =>
                  onSubmit({ status: 'done', response: response || null })
                }
                variant="primary"
                icon={<CheckCircle2 size={16} color={colors.textInverse} />}
                loading={saving}
              />
              <Button
                label="Salvar resposta sem mudar status"
                onPress={() =>
                  onSubmit({ status: request.status, response: response || null })
                }
                variant="ghost"
                icon={<Send size={16} color={colors.textDim} />}
                loading={saving}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
