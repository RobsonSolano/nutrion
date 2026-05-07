import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Plus, Sparkles, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button, Card, ConfirmModal } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { colors } from '@/lib/theme';
import {
  useDeleteProgressEntry,
  useProgressEntries,
} from '@/hooks/useProgressEntries';
import AddProgressEntryModal from './AddProgressEntryModal';
import type { ProgressEntry } from '@/types/database';

type Props = {
  userId: string;
  /** Quando true, mostra botão "+ Novo registro" e ações de excluir nos cards. */
  canEdit: boolean;
  /** Texto do empty state. Pode ser ajustado quando o coach está vendo do aluno. */
  emptyMessage?: string;
};

export default function ProgressTimeline({
  userId,
  canEdit,
  emptyMessage,
}: Props) {
  const entriesQ = useProgressEntries(userId);
  const remove = useDeleteProgressEntry();
  const alert = useAlert();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const entries = entriesQ.data ?? [];

  function handleConfirmDelete() {
    if (!deleteId) return;
    remove.mutate(deleteId, {
      onSuccess: () => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        setDeleteId(null);
      },
      onError: (err) => {
        setDeleteId(null);
        alert.showError(err);
      },
    });
  }

  return (
    <View className="gap-3">
      {canEdit && (
        <Button
          label="Novo registro"
          onPress={() => setAddOpen(true)}
          variant="secondary"
          icon={<Plus size={16} color={colors.text} />}
        />
      )}

      {entriesQ.isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <Card padding="md">
          <View className="items-center gap-2 py-4">
            <Sparkles size={26} color={colors.textMuted} />
            <Text className="text-text-muted text-sm text-center leading-relaxed">
              {emptyMessage ??
                (canEdit
                  ? 'Nenhum registro ainda. Comece anotando uma conquista, mudança de hábito ou meta batida.'
                  : 'O aluno ainda não registrou nada.')}
            </Text>
          </View>
        </Card>
      ) : (
        <View>
          {entries.map((entry, i) => (
            <TimelineItem
              key={entry.id}
              entry={entry}
              isFirst={i === 0}
              isLast={i === entries.length - 1}
              canEdit={canEdit}
              onDelete={() => setDeleteId(entry.id)}
            />
          ))}
        </View>
      )}

      <AddProgressEntryModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => setAddOpen(false)}
      />

      <ConfirmModal
        visible={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Apagar registro?"
        message="Esse marco vai sumir da sua linha do tempo. Não dá pra desfazer."
        icon={<Trash2 size={26} color={colors.danger} />}
        actions={[
          {
            label: 'Apagar',
            variant: 'danger',
            onPress: handleConfirmDelete,
            loading: remove.isPending,
          },
          {
            label: 'Cancelar',
            variant: 'ghost',
            onPress: () => setDeleteId(null),
          },
        ]}
      />
    </View>
  );
}

function TimelineItem({
  entry,
  isFirst,
  isLast,
  canEdit,
  onDelete,
}: {
  entry: ProgressEntry;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onDelete: () => void;
}) {
  return (
    <View className="flex-row" style={{ minHeight: 80 }}>
      <View
        style={{ width: 28, alignItems: 'center', paddingTop: 6 }}
      >
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 2,
            borderColor: colors.bgDeep ?? '#000',
          }}
        />
        {!isLast && (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: `${colors.accent}55`,
              marginTop: 2,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            {formatRelativeDate(entry.created_at)}
            {isFirst ? ' · agora há pouco' : ''}
          </Text>
          {canEdit && (
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              className="h-7 w-7 rounded-lg items-center justify-center active:opacity-60"
            >
              <Trash2 size={14} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Card padding="md">
          <Text className="text-text text-sm leading-relaxed">
            {entry.content}
          </Text>
        </Card>
      </View>
    </View>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay(d, now)) return `Hoje · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Ontem · ${time}`;
  if (diffDays < 7) return `${diffDays} dias atrás · ${time}`;
  return `${d.toLocaleDateString('pt-BR')} · ${time}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
