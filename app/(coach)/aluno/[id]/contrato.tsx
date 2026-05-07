import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  Edit3,
  FileText,
  Plus,
  XCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button, Card, ConfirmModal, Screen } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { colors } from '@/lib/theme';
import { formatBRL } from '@/lib/money';
import {
  useCancelContract,
  useCreateContract,
  useStudentContracts,
  useUpdateContract,
} from '@/hooks/useContracts';
import ContractForm from '@/components/coach/ContractForm';
import type { ContractType, StudentContract } from '@/types/database';

const TYPE_LABEL: Record<ContractType, string> = {
  mensal: 'Mensal',
  treino: 'Treino a treino',
  semanal: 'Semanal',
  parceria: 'Parceria',
};

type Mode =
  | { kind: 'view' }
  | { kind: 'create' }
  | { kind: 'edit'; contract: StudentContract };

export default function ContratoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alert = useAlert();
  const contractsQ = useStudentContracts(id ?? null);
  const create = useCreateContract();
  const update = useUpdateContract();
  const cancel = useCancelContract();

  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  if (!id) return null;

  const list = contractsQ.data ?? [];
  const active = list.find((c) => c.effective_status === 'active') ?? null;
  const history = list.filter((c) => c.effective_status !== 'active');

  function handleConfirmCancel() {
    if (!confirmCancelId || !id) return;
    cancel.mutate(
      { id: confirmCancelId, studentId: id },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          setConfirmCancelId(null);
        },
        onError: (err) => {
          setConfirmCancelId(null);
          alert.showError(err);
        },
      },
    );
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Screen variant="hero" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => {
              if (mode.kind !== 'view') {
                setMode({ kind: 'view' });
              } else {
                router.back();
              }
            }}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">
            {mode.kind === 'create'
              ? 'Novo contrato'
              : mode.kind === 'edit'
                ? 'Editar contrato'
                : 'Contrato'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 40,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          {mode.kind === 'create' && (
            <ContractForm
              studentId={id}
              mode="create"
              loading={create.isPending}
              onSubmit={async (payload) => {
                try {
                  await create.mutateAsync(payload);
                  void Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  setMode({ kind: 'view' });
                } catch (err) {
                  alert.showError(err);
                }
              }}
            />
          )}

          {mode.kind === 'edit' && (
            <ContractForm
              studentId={id}
              mode="edit"
              initial={mode.contract}
              loading={update.isPending}
              onSubmit={async (payload) => {
                try {
                  await update.mutateAsync({
                    id: mode.contract.id,
                    studentId: id,
                    patch: {
                      type: payload.type,
                      start_date: payload.start_date,
                      end_date: payload.end_date,
                      value_cents: payload.value_cents,
                      payment_day: payload.payment_day,
                      notes: payload.notes,
                    },
                  });
                  void Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                  setMode({ kind: 'view' });
                } catch (err) {
                  alert.showError(err);
                }
              }}
            />
          )}

          {mode.kind === 'view' && (
            <>
              {contractsQ.isLoading ? (
                <View className="py-12 items-center">
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : (
                <>
                  {active ? (
                    <ContractCard
                      contract={active}
                      isActive
                      onEdit={() => setMode({ kind: 'edit', contract: active })}
                      onCancel={() => setConfirmCancelId(active.id)}
                    />
                  ) : (
                    <Card padding="md">
                      <View className="items-center gap-2 py-4">
                        <FileText size={28} color={colors.textMuted} />
                        <Text className="text-text-muted text-sm text-center leading-relaxed">
                          Sem contrato ativo. Crie um para registrar o que foi
                          combinado.
                        </Text>
                      </View>
                    </Card>
                  )}

                  <Button
                    label="Novo contrato"
                    onPress={() => setMode({ kind: 'create' })}
                    variant="secondary"
                    icon={<Plus size={16} color={colors.text} />}
                  />

                  {history.length > 0 && (
                    <>
                      <Text className="text-text-dim text-[11px] uppercase tracking-widest mt-4 px-1">
                        Histórico ({history.length})
                      </Text>
                      <View className="gap-2">
                        {history.map((c) => (
                          <ContractCard
                            key={c.id}
                            contract={c}
                            isActive={false}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </Screen>

      <ConfirmModal
        visible={!!confirmCancelId}
        onClose={() => setConfirmCancelId(null)}
        title="Encerrar contrato?"
        message="O contrato vai para o histórico marcado como cancelado, com data de fim hoje."
        icon={<XCircle size={26} color={colors.danger} />}
        actions={[
          {
            label: 'Sim, encerrar',
            variant: 'danger',
            onPress: handleConfirmCancel,
            loading: cancel.isPending,
          },
          {
            label: 'Cancelar',
            variant: 'ghost',
            onPress: () => setConfirmCancelId(null),
          },
        ]}
      />
    </>
  );
}

function ContractCard({
  contract,
  isActive,
  onEdit,
  onCancel,
}: {
  contract: StudentContract;
  isActive: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const isParceria = contract.type === 'parceria';

  return (
    <Card glow={isActive} accent={isActive ? 'green' : 'none'} padding="md">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-text text-base font-bold">
              {TYPE_LABEL[contract.type]}
            </Text>
            <StatusBadge status={contract.effective_status} />
          </View>
          {!isParceria && (
            <Text className="text-text text-2xl font-bold mt-1">
              {formatBRL(contract.value_cents)}
            </Text>
          )}
        </View>
      </View>

      <View className="gap-1.5 mt-3">
        <Row
          icon={<CalendarDays size={12} color={colors.textMuted} />}
          label="Início"
          value={formatDateBR(contract.start_date)}
        />
        <Row
          icon={<CalendarDays size={12} color={colors.textMuted} />}
          label="Fim"
          value={
            contract.end_date ? formatDateBR(contract.end_date) : 'Sem prazo'
          }
        />
        {!isParceria && contract.payment_day != null && (
          <Row label="Pagamento" value={`Todo dia ${contract.payment_day}`} />
        )}
      </View>

      {contract.notes && (
        <Text className="text-text-dim text-xs mt-3 leading-relaxed">
          {contract.notes}
        </Text>
      )}

      {isActive && onEdit && onCancel && (
        <View className="flex-row gap-2 mt-4">
          <View className="flex-1">
            <Button
              label="Editar"
              onPress={onEdit}
              variant="secondary"
              size="md"
              icon={<Edit3 size={14} color={colors.text} />}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Encerrar"
              onPress={onCancel}
              variant="danger"
              size="md"
              icon={<XCircle size={14} color={colors.danger} />}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: StudentContract['effective_status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <View
      className="rounded-full border px-2 py-0.5"
      style={{
        backgroundColor: `${config.color}15`,
        borderColor: `${config.color}55`,
      }}
    >
      <Text className="text-[10px] font-bold" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

const STATUS_CONFIG: Record<
  StudentContract['effective_status'],
  { label: string; color: string }
> = {
  active: { label: 'ATIVO', color: colors.accent },
  ended: { label: 'ENCERRADO', color: colors.textMuted },
  cancelled: { label: 'CANCELADO', color: colors.danger },
};

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <Text className="text-text-muted text-[11px] flex-1">{label}</Text>
      <Text className="text-text-dim text-xs font-semibold">{value}</Text>
    </View>
  );
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
