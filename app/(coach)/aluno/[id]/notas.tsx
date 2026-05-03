import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  X,
  Save,
} from 'lucide-react-native';
import {
  Button,
  Card,
  ConfirmModal,
  Input,
  Screen,
} from '@/components/ui';
import { colors } from '@/lib/theme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import {
  useCoachNotes,
  useCreateNote,
  useDeleteNote,
  useUpdateNote,
} from '@/hooks/useCoachNotes';
import type { CoachNote } from '@/services/coachNotes';

const MAX = 2000;

export default function NotasScreen() {
  const router = useRouter();
  const kbHeight = useKeyboardHeight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const notesQ = useCoachNotes(id ?? null);
  const createMutation = useCreateNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<CoachNote | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CoachNote | null>(null);

  if (!id) return null;

  async function handleAdd() {
    if (!id || draft.trim().length === 0) return;
    try {
      await createMutation.mutateAsync({ studentId: id, body: draft });
      setDraft('');
    } catch (err) {
      Alert.alert(
        'Não consegui salvar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  async function handleConfirmDelete() {
    if (!id || !confirmDelete) return;
    try {
      await deleteMutation.mutateAsync({
        noteId: confirmDelete.id,
        studentId: id,
      });
      setConfirmDelete(null);
    } catch (err) {
      Alert.alert(
        'Não consegui excluir',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-text font-semibold text-base">
              Anotações privadas
            </Text>
            <Text className="text-text-muted text-[11px]">
              Visíveis só pra você. O aluno não vê.
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32 + (Platform.OS === 'android' ? kbHeight : 0),
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Card padding="md">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
              Nova anotação
            </Text>
            <Input
              value={draft}
              onChangeText={(v) => v.length <= MAX && setDraft(v)}
              placeholder="Ex: hoje pesou 78kg, queixou-se do joelho no agachamento — trocar por leg press na próxima semana."
              multiline
              numberOfLines={5}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-text-muted text-[11px]">
                {draft.length}/{MAX}
              </Text>
              <Button
                label="Adicionar"
                onPress={handleAdd}
                loading={createMutation.isPending}
                disabled={draft.trim().length === 0}
                size="md"
                icon={<Plus size={16} color={colors.textInverse} />}
              />
            </View>
          </Card>

          {notesQ.isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator color={colors.violetSoft} />
            </View>
          ) : notesQ.data && notesQ.data.length > 0 ? (
            notesQ.data.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                onEdit={() => setEditing(n)}
                onDelete={() => setConfirmDelete(n)}
              />
            ))
          ) : (
            <Card padding="md">
              <View className="items-center gap-2 py-6">
                <View className="h-12 w-12 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
                  <NotebookPen size={20} color={colors.violetSoft} />
                </View>
                <Text className="text-text text-sm font-semibold">
                  Sem anotações ainda
                </Text>
                <Text className="text-text-muted text-xs text-center px-4 leading-relaxed">
                  Use o campo acima pra registrar evolução, peso da consulta,
                  observações de técnica, etc.
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <EditNoteModal
        key={editing?.id ?? 'closed'}
        note={editing}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          if (!id || !editing) return;
          try {
            await updateMutation.mutateAsync({
              noteId: editing.id,
              studentId: id,
              body,
            });
            setEditing(null);
          } catch (err) {
            Alert.alert(
              'Não consegui salvar',
              err instanceof Error ? err.message : 'Tenta de novo.',
            );
          }
        }}
        saving={updateMutation.isPending}
      />

      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Excluir anotação?"
        message="Essa ação não pode ser desfeita."
        icon={<Trash2 size={26} color={colors.danger} />}
        actions={[
          {
            label: 'Excluir',
            variant: 'danger',
            onPress: handleConfirmDelete,
            loading: deleteMutation.isPending,
          },
          {
            label: 'Cancelar',
            variant: 'ghost',
            onPress: () => setConfirmDelete(null),
            disabled: deleteMutation.isPending,
          },
        ]}
      />
    </Screen>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: CoachNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(note.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = new Date(note.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const wasEdited = note.updated_at !== note.created_at;

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-text-muted text-[11px]">
          {date} · {time}
          {wasEdited ? ' · editada' : ''}
        </Text>
        <View className="flex-row gap-1">
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            className="h-8 w-8 rounded-xl border border-border bg-surface-muted items-center justify-center active:opacity-70"
          >
            <Pencil size={12} color={colors.textDim} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            className="h-8 w-8 rounded-xl border border-danger/30 bg-danger/5 items-center justify-center active:opacity-70"
          >
            <Trash2 size={12} color={colors.danger} />
          </Pressable>
        </View>
      </View>
      <Text className="text-text text-sm leading-relaxed">{note.body}</Text>
    </Card>
  );
}

function EditNoteModal({
  note,
  onClose,
  onSave,
  saving,
}: {
  note: CoachNote | null;
  onClose: () => void;
  onSave: (body: string) => Promise<void>;
  saving: boolean;
}) {
  const [body, setBody] = useState(note?.body ?? '');

  if (!note) return null;

  return (
    <Modal
      visible
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
              Editar anotação
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
            <Input
              value={body}
              onChangeText={(v) => v.length <= MAX && setBody(v)}
              placeholder="Anotação..."
              multiline
              numberOfLines={6}
              style={{ minHeight: 160, textAlignVertical: 'top' }}
            />
            <Text className="text-text-muted text-[11px] text-right">
              {body.length}/{MAX}
            </Text>

            <Button
              label="Salvar alterações"
              onPress={() => onSave(body)}
              loading={saving}
              disabled={body.trim().length === 0}
              icon={<Save size={16} color={colors.textInverse} />}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
