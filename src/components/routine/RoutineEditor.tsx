import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  type TextInput,
} from 'react-native';
import {
  Plus,
  Trash2,
  Search,
  X,
  Save,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useExerciseGroups,
  useExerciseImagesMap,
  useExercisesByGroup,
} from '@/hooks/useExercises';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Button, Card, Input } from '@/components/ui';
import { colors } from '@/lib/theme';
import type {
  Exercise,
  ExerciseGroup,
  RoutineExerciseInsert,
} from '@/types/database';
import ExerciseImagesModal from './ExerciseImagesModal';
import PreviewEyeButton from './PreviewEyeButton';

type Draft = RoutineExerciseInsert & { localId: string };

type Props = {
  initialName?: string;
  initialDescription?: string;
  initialGroupId?: string | null;
  initialExercises?: RoutineExerciseInsert[];
  submitLabel: string;
  loading?: boolean;
  onSubmit: (payload: {
    name: string;
    groupId: string | null;
    description: string | null;
    exercises: RoutineExerciseInsert[];
  }) => void | Promise<void>;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toInt(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Math.round(Number(v.replace(',', '.')));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function RoutineEditor(props: Props) {
  const kbHeight = useKeyboardHeight();
  const groupsQ = useExerciseGroups();
  const imagesMap = useExerciseImagesMap();

  const [name, setName] = useState(props.initialName ?? '');
  const [description, setDescription] = useState(props.initialDescription ?? '');
  const [groupId, setGroupId] = useState<string | null>(
    props.initialGroupId ?? null,
  );
  const [drafts, setDrafts] = useState<Draft[]>(
    (props.initialExercises ?? []).map((e) => ({ ...e, localId: uid() })),
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    equipment: string | null;
    images: string[];
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const seriesRefs = useRef<Map<string, TextInput>>(new Map());

  const group =
    groupsQ.data?.find((g) => g.id === groupId) ?? null;

  const addedExerciseIds = useMemo(
    () =>
      new Set(
        drafts.map((d) => d.exercise_id).filter((v): v is string => !!v),
      ),
    [drafts],
  );

  function handleAddExercise(ex: Exercise) {
    const localId = uid();
    setDrafts((prev) => [
      ...prev,
      {
        localId,
        exercise_id: ex.id,
        exercise_name: ex.name,
        equipment: ex.equipment,
        sort_order: prev.length,
        sets: null,
        reps_min: null,
        reps_max: null,
        weight_min_kg: null,
        weight_max_kg: null,
        duration_min: null,
        notes: null,
      },
    ]);
    setPendingFocusId(localId);
    void Haptics.selectionAsync();
    setPickerOpen(false);
  }

  // Quando o exercício recém adicionado monta, rola até o fim e foca o input de Séries.
  useEffect(() => {
    if (!pendingFocusId) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      seriesRefs.current.get(pendingFocusId)?.focus();
      setPendingFocusId(null);
    }, 120);
    return () => clearTimeout(t);
  }, [pendingFocusId]);

  function handleRemoveExercise(localId: string) {
    setDrafts((prev) => prev.filter((d) => d.localId !== localId));
    seriesRefs.current.delete(localId);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function updateDraft(localId: string, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)),
    );
  }

  async function handleSubmit() {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      Alert.alert('Nome do treino', 'Informe um nome (ex: Peito A).');
      return;
    }
    if (drafts.length === 0) {
      Alert.alert(
        'Sem exercícios',
        'Adicione pelo menos um exercício ao treino.',
      );
      return;
    }
    const exercises: RoutineExerciseInsert[] = drafts.map((d, i) => ({
      exercise_id: d.exercise_id,
      exercise_name: d.exercise_name,
      equipment: d.equipment,
      sort_order: i,
      sets: d.sets,
      reps_min: d.reps_min,
      reps_max: d.reps_max,
      weight_min_kg: d.weight_min_kg,
      weight_max_kg: d.weight_max_kg,
      duration_min: d.duration_min,
      notes: d.notes,
    }));
    try {
      await props.onSubmit({
        name: cleanName,
        groupId,
        description: description.trim() || null,
        exercises,
      });
    } catch (err) {
      Alert.alert(
        'Não consegui salvar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        paddingBottom: 40 + (Platform.OS === 'android' ? kbHeight : 0),
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      <Card padding="md">
        <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
          Dados do treino
        </Text>
        <View className="gap-3">
          <Input
            label="Nome"
            value={name}
            onChangeText={setName}
            placeholder="Ex: Peito A, Costas, Cardio 30min"
          />
          <Input
            label="Descrição (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: força + hipertrofia, 60min"
            multiline
          />
          <GroupPicker
            groups={groupsQ.data ?? []}
            selectedId={groupId}
            onSelect={setGroupId}
          />
        </View>
      </Card>

      <Card padding="md">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest">
            Exercícios ({drafts.length})
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            hitSlop={8}
            className="flex-row items-center gap-1.5 rounded-full bg-accent/10 border border-accent/40 px-3 py-1 active:opacity-70"
          >
            <Plus size={12} color={colors.accent} />
            <Text className="text-accent text-[11px] font-semibold">
              Adicionar
            </Text>
          </Pressable>
        </View>

        {drafts.length === 0 ? (
          <Text className="text-text-muted text-xs text-center py-6">
            Nenhum exercício ainda. Toque em &quot;Adicionar&quot;.
          </Text>
        ) : (
          <View className="gap-3">
            {drafts.map((d, i) => {
              const imgs = d.exercise_id
                ? imagesMap.get(d.exercise_id) ?? null
                : null;
              return (
                <ExerciseDraftRow
                  key={d.localId}
                  draft={d}
                  index={i}
                  imageUrls={imgs}
                  onChange={(patch) => updateDraft(d.localId, patch)}
                  onRemove={() => handleRemoveExercise(d.localId)}
                  onPreview={() => {
                    if (!imgs) return;
                    setPreview({
                      name: d.exercise_name,
                      equipment: d.equipment,
                      images: imgs,
                    });
                  }}
                  setsRef={(el) => {
                    if (el) seriesRefs.current.set(d.localId, el);
                    else seriesRefs.current.delete(d.localId);
                  }}
                />
              );
            })}
          </View>
        )}
      </Card>

      <Button
        label={props.submitLabel}
        onPress={handleSubmit}
        loading={props.loading}
        icon={<Save size={18} color={colors.textInverse} />}
      />

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        preferredGroupId={groupId}
        addedExerciseIds={addedExerciseIds}
        onSelect={handleAddExercise}
      />

      <ExerciseImagesModal
        visible={!!preview}
        onClose={() => setPreview(null)}
        exerciseName={preview?.name ?? ''}
        equipment={preview?.equipment}
        imageUrls={preview?.images ?? []}
      />
    </ScrollView>
  );
}

// ---------- Subcomponents ----------

function GroupPicker({
  groups,
  selectedId,
  onSelect,
}: {
  groups: ExerciseGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <View>
      <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
        Grupo muscular (opcional)
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => onSelect(null)}
          className={`rounded-full border px-3 py-1.5 ${
            selectedId === null
              ? 'bg-accent/10 border-accent/40'
              : 'bg-surface-muted border-border'
          }`}
        >
          <Text
            className={`text-xs ${
              selectedId === null ? 'text-accent' : 'text-text-dim'
            }`}
          >
            Livre
          </Text>
        </Pressable>
        {groups.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => onSelect(g.id)}
            className={`rounded-full border px-3 py-1.5 ${
              selectedId === g.id
                ? 'bg-accent/10 border-accent/40'
                : 'bg-surface-muted border-border'
            }`}
          >
            <Text
              className={`text-xs ${
                selectedId === g.id ? 'text-accent' : 'text-text-dim'
              }`}
            >
              {g.icon} {g.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ExerciseDraftRow({
  draft,
  index,
  imageUrls,
  onChange,
  onRemove,
  onPreview,
  setsRef,
}: {
  draft: Draft;
  index: number;
  imageUrls: string[] | null;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
  onPreview: () => void;
  setsRef?: (el: TextInput | null) => void;
}) {
  const hasImages = !!imageUrls && imageUrls.length > 0;
  return (
    <View className="rounded-2xl border border-border bg-surface-muted p-3">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1 pr-2">
          <Text className="text-text-muted text-[10px]">#{index + 1}</Text>
          <Text className="text-text text-sm font-semibold" numberOfLines={2}>
            {draft.exercise_name}
          </Text>
          {draft.equipment && (
            <Text className="text-text-muted text-[10px]">
              {draft.equipment}
            </Text>
          )}
        </View>
        {hasImages && <PreviewEyeButton onPress={onPreview} marginRight />}
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="h-8 w-8 rounded-lg bg-surface border border-border items-center justify-center active:opacity-70"
        >
          <Trash2 size={14} color={colors.danger} />
        </Pressable>
      </View>

      <View className="gap-2">
        <View className="flex-row gap-2">
          <View style={{ flex: 1 }}>
            <SmallInput
              ref={setsRef}
              label="Séries"
              value={draft.sets?.toString() ?? ''}
              onChangeText={(v) => onChange({ sets: toInt(v) })}
              placeholder="4"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SmallInput
              label="Reps mín"
              value={draft.reps_min?.toString() ?? ''}
              onChangeText={(v) => onChange({ reps_min: toInt(v) })}
              placeholder="8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SmallInput
              label="Reps máx"
              value={draft.reps_max?.toString() ?? ''}
              onChangeText={(v) => onChange({ reps_max: toInt(v) })}
              placeholder="12"
            />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View style={{ flex: 1 }}>
            <SmallInput
              label="Peso mín (kg)"
              value={draft.weight_min_kg?.toString() ?? ''}
              onChangeText={(v) => onChange({ weight_min_kg: toNum(v) })}
              placeholder="60"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SmallInput
              label="Peso máx (kg)"
              value={draft.weight_max_kg?.toString() ?? ''}
              onChangeText={(v) => onChange({ weight_max_kg: toNum(v) })}
              placeholder="80"
            />
          </View>
          <View style={{ flex: 1 }}>
            <SmallInput
              label="Minutos"
              value={draft.duration_min?.toString() ?? ''}
              onChangeText={(v) => onChange({ duration_min: toInt(v) })}
              placeholder="—"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

type SmallInputProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
};

const SmallInput = forwardRef<TextInput, SmallInputProps>(function SmallInput(
  { label, value, onChangeText, placeholder },
  ref,
) {
  return (
    <View>
      <Text className="text-text-muted text-[9px] uppercase tracking-widest mb-1">
        {label}
      </Text>
      <Input
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
      />
    </View>
  );
});

function ExercisePickerModal({
  visible,
  onClose,
  preferredGroupId,
  addedExerciseIds,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  preferredGroupId: string | null;
  addedExerciseIds: Set<string>;
  onSelect: (ex: Exercise) => void;
}) {
  const [groupId, setGroupId] = useState<string | null>(preferredGroupId);
  const [search, setSearch] = useState('');
  const groupsQ = useExerciseGroups();
  const exercisesQ = useExercisesByGroup(groupId);

  // Sempre que o modal abre, sincroniza o grupo com o preferido do form
  // e limpa a busca anterior — evita confusão de estado antigo.
  useEffect(() => {
    if (visible) {
      setGroupId(preferredGroupId);
      setSearch('');
    }
  }, [visible, preferredGroupId]);

  const filtered = useMemo(() => {
    const list = exercisesQ.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((e) => e.name.toLowerCase().includes(term));
  }, [exercisesQ.data, search]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
    >
      <View className="flex-1 bg-bg-deep">
        <View
          className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle"
          style={{ paddingTop: Platform.OS === 'ios' ? 50 : 16 }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <X size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Escolher exercício</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <Card padding="md">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
              Grupo muscular
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(groupsQ.data ?? []).map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGroupId(g.id)}
                  className={`rounded-full border px-3 py-1.5 ${
                    groupId === g.id
                      ? 'bg-accent/10 border-accent/40'
                      : 'bg-surface-muted border-border'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      groupId === g.id ? 'text-accent' : 'text-text-dim'
                    }`}
                  >
                    {g.icon} {g.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {groupId && (
            <Card padding="md">
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar exercício..."
                leftIcon={<Search size={16} color={colors.textMuted} />}
                autoCapitalize="none"
              />
            </Card>
          )}

          {!groupId && (
            <Text className="text-text-muted text-sm text-center py-4">
              Selecione um grupo pra ver os exercícios.
            </Text>
          )}

          {groupId && exercisesQ.isLoading && (
            <View className="py-8 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          )}

          {groupId && !exercisesQ.isLoading && filtered.length === 0 && (
            <Text className="text-text-muted text-sm text-center py-4">
              Nenhum exercício encontrado.
            </Text>
          )}

          {filtered.map((ex) => {
            const added = addedExerciseIds.has(ex.id);
            return (
              <Pressable
                key={ex.id}
                onPress={() => {
                  if (!added) onSelect(ex);
                }}
                className={added ? 'opacity-60' : 'active:opacity-70'}
              >
                <Card padding="md">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text
                        className={`text-sm font-semibold ${
                          added ? 'text-text-dim' : 'text-text'
                        }`}
                      >
                        {ex.name}
                      </Text>
                      {ex.equipment && (
                        <Text className="text-text-muted text-[11px] mt-0.5">
                          {ex.equipment}
                          {ex.is_compound ? ' · composto' : ''}
                          {added ? ' · já adicionado' : ''}
                        </Text>
                      )}
                    </View>
                    {added ? (
                      <CheckCircle2 size={18} color={colors.accent} />
                    ) : (
                      <PlusCircle size={18} color={colors.textMuted} />
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

