import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import type {
  ImportResult,
  SavedWorkout,
  SavedExerciseRef,
} from '@/services/workoutImport';
import type { Modality } from '@/types/database';

const GROUP_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'chest', label: 'Peito' },
  { slug: 'back', label: 'Costas' },
  { slug: 'legs', label: 'Pernas' },
  { slug: 'shoulders', label: 'Ombros' },
  { slug: 'biceps', label: 'Bíceps' },
  { slug: 'triceps', label: 'Tríceps' },
  { slug: 'core', label: 'Core' },
  { slug: 'full_body', label: 'Full Body' },
  { slug: 'cardio', label: 'Cardio' },
];

const MODALITY_OPTIONS: { value: Modality; label: string }[] = [
  { value: 'musculacao', label: 'Musculação' },
  { value: 'calistenia', label: 'Calistenia' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'corrida', label: 'Corrida' },
  { value: 'generico', label: 'Genérico' },
];

type LocalExercise = {
  id: string; // local key
  name: string;
  equipment: string | null;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  duration_min: number | null;
  notes: string | null;
  group_slug: string;
  matched_exercise_id: string | null;
  confidence: 'high' | 'medium' | 'low';
};

type LocalWorkout = {
  id: string;
  name: string;
  modality: Modality;
  group_slug: string | null;
  exercises: LocalExercise[];
};

type Props = {
  result: ImportResult;
  destination: 'aluno' | 'template';
  onCancel: () => void;
  onConfirm: (workouts: SavedWorkout[]) => void;
  saving: boolean;
};

export default function ImportWorkoutPreview({
  result,
  destination,
  onCancel,
  onConfirm,
  saving,
}: Props) {
  const [workouts, setWorkouts] = useState<LocalWorkout[]>(() =>
    result.workouts.map((w, wi) => ({
      id: `w-${wi}`,
      name: w.name || `Treino ${String.fromCharCode(65 + wi)}`,
      modality: w.modality ?? 'musculacao',
      group_slug: w.group_slug ?? null,
      exercises: (w.exercises ?? []).map((ex, ei) => ({
        id: `w-${wi}-e-${ei}`,
        name: ex.name,
        equipment: ex.equipment,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        duration_min: ex.duration_min,
        notes: ex.notes,
        group_slug: ex.suggested_group_slug ?? 'full_body',
        matched_exercise_id: ex.matched_exercise_id,
        confidence: ex.match_confidence,
      })),
    })),
  );

  const totalNew = useMemo(
    () =>
      workouts
        .flatMap((w) => w.exercises)
        .filter((e) => !e.matched_exercise_id).length,
    [workouts],
  );

  function updateWorkout(id: string, patch: Partial<LocalWorkout>) {
    setWorkouts((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    );
  }

  function updateExercise(
    workoutId: string,
    exId: string,
    patch: Partial<LocalExercise>,
  ) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id !== workoutId
          ? w
          : {
              ...w,
              exercises: w.exercises.map((e) =>
                e.id === exId ? { ...e, ...patch } : e,
              ),
            },
      ),
    );
  }

  function removeWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }

  function removeExercise(workoutId: string, exId: string) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id !== workoutId
          ? w
          : { ...w, exercises: w.exercises.filter((e) => e.id !== exId) },
      ),
    );
  }

  function addExercise(workoutId: string) {
    const newId = `e-${Date.now()}`;
    const w = workouts.find((x) => x.id === workoutId);
    setWorkouts((prev) =>
      prev.map((wk) =>
        wk.id !== workoutId
          ? wk
          : {
              ...wk,
              exercises: [
                ...wk.exercises,
                {
                  id: newId,
                  name: '',
                  equipment: null,
                  sets: 3,
                  reps_min: 8,
                  reps_max: 12,
                  duration_min: null,
                  notes: null,
                  group_slug: w?.group_slug ?? 'full_body',
                  matched_exercise_id: null,
                  confidence: 'low',
                },
              ],
            },
      ),
    );
  }

  function addWorkout() {
    const letter = String.fromCharCode(65 + workouts.length);
    setWorkouts((prev) => [
      ...prev,
      {
        id: `w-${Date.now()}`,
        name: `Treino ${letter}`,
        modality: 'musculacao',
        group_slug: null,
        exercises: [],
      },
    ]);
  }

  function handleConfirm() {
    const payload: SavedWorkout[] = workouts
      .filter((w) => w.exercises.length > 0)
      .map((w) => ({
        name: w.name.trim() || 'Treino',
        modality: w.modality,
        group_slug: w.group_slug,
        exercises: w.exercises
          .filter((e) => e.name.trim().length > 0)
          .map((e) => {
            const ref: SavedExerciseRef = e.matched_exercise_id
              ? { kind: 'existing', exercise_id: e.matched_exercise_id }
              : {
                  kind: 'new',
                  name: e.name.trim(),
                  group_slug: e.group_slug,
                  modality: w.modality,
                  equipment: e.equipment,
                };
            return {
              ref,
              exercise_name: e.name.trim(),
              equipment: e.equipment,
              sets: e.sets,
              reps_min: e.reps_min,
              reps_max: e.reps_max,
              duration_min: e.duration_min,
              notes: e.notes,
            };
          }),
      }))
      .filter((w) => w.exercises.length > 0);

    onConfirm(payload);
  }

  const canConfirm =
    workouts.length > 0 &&
    workouts.some((w) =>
      w.exercises.some((e) => e.name.trim().length > 0),
    );

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
        <Pressable
          onPress={onCancel}
          hitSlop={12}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          disabled={saving}
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-text font-semibold text-base">
            Revisar treino
          </Text>
          {totalNew > 0 && (
            <Text className="text-violet-soft text-[11px] mt-0.5">
              {totalNew} exercício{totalNew === 1 ? '' : 's'} novo
              {totalNew === 1 ? '' : 's'} {totalNew === 1 ? 'será' : 'serão'}{' '}
              adicionado{totalNew === 1 ? '' : 's'} à base
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 60,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-start gap-2 rounded-2xl border border-violet/30 bg-violet/5 px-3 py-2.5">
          <Sparkles size={14} color={colors.violetSoft} />
          <Text className="text-text-dim text-[12px] flex-1 leading-relaxed">
            Edite o que precisar. Exercícios novos serão criados na base com o
            grupo muscular que a IA inferiu.
          </Text>
        </View>

        {workouts.map((w, wi) => (
          <WorkoutBlock
            key={w.id}
            workout={w}
            index={wi}
            onUpdate={(patch) => updateWorkout(w.id, patch)}
            onRemove={() => removeWorkout(w.id)}
            onUpdateExercise={(exId, patch) =>
              updateExercise(w.id, exId, patch)
            }
            onRemoveExercise={(exId) => removeExercise(w.id, exId)}
            onAddExercise={() => addExercise(w.id)}
            disabled={saving}
          />
        ))}

        <Button
          label="+ Adicionar outro treino"
          onPress={addWorkout}
          variant="ghost"
          disabled={saving}
        />

        <Button
          label={
            destination === 'aluno'
              ? 'Finalizar e criar treino do aluno'
              : 'Finalizar e salvar na biblioteca'
          }
          onPress={handleConfirm}
          variant="primary"
          loading={saving}
          disabled={!canConfirm || saving}
          icon={<Check size={18} color={colors.textInverse} />}
        />
      </ScrollView>
    </Screen>
  );
}

function WorkoutBlock({
  workout,
  index,
  onUpdate,
  onRemove,
  onUpdateExercise,
  onRemoveExercise,
  onAddExercise,
  disabled,
}: {
  workout: LocalWorkout;
  index: number;
  onUpdate: (patch: Partial<LocalWorkout>) => void;
  onRemove: () => void;
  onUpdateExercise: (exId: string, patch: Partial<LocalExercise>) => void;
  onRemoveExercise: (exId: string) => void;
  onAddExercise: () => void;
  disabled: boolean;
}) {
  return (
    <Card padding="md" glow accent="violet">
      <View className="flex-row items-center gap-2 mb-3">
        <View className="h-7 w-7 rounded-xl bg-violet/15 border border-violet/40 items-center justify-center">
          <Text className="text-violet-soft text-xs font-bold">
            {index + 1}
          </Text>
        </View>
        <TextInput
          value={workout.name}
          onChangeText={(v) => onUpdate({ name: v })}
          placeholder="Nome do treino"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
            paddingVertical: 4,
          }}
          editable={!disabled}
        />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="h-9 w-9 rounded-2xl bg-surface-muted border border-border items-center justify-center active:opacity-70"
          disabled={disabled}
        >
          <Trash2 size={14} color={colors.danger} />
        </Pressable>
      </View>

      <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
        Modalidade
      </Text>
      <PillPicker
        options={MODALITY_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        }))}
        value={workout.modality}
        onChange={(v) => onUpdate({ modality: v as Modality })}
        disabled={disabled}
      />

      <View className="h-px bg-border-subtle my-3" />

      {workout.exercises.length === 0 && (
        <Text className="text-text-muted text-xs py-2 text-center">
          Sem exercícios. Toque em [+ Adicionar exercício] abaixo.
        </Text>
      )}

      <View className="gap-2">
        {workout.exercises.map((ex, ei) => (
          <ExerciseBlock
            key={ex.id}
            exercise={ex}
            number={ei + 1}
            onUpdate={(patch) => onUpdateExercise(ex.id, patch)}
            onRemove={() => onRemoveExercise(ex.id)}
            disabled={disabled}
          />
        ))}
      </View>

      <Pressable
        onPress={onAddExercise}
        className="mt-3 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-3 py-2.5 flex-row items-center justify-center gap-2 active:opacity-70"
        disabled={disabled}
      >
        <Plus size={14} color={colors.accent} />
        <Text className="text-accent text-sm font-semibold">
          Adicionar exercício
        </Text>
      </Pressable>
    </Card>
  );
}

function ExerciseBlock({
  exercise,
  number,
  onUpdate,
  onRemove,
  disabled,
}: {
  exercise: LocalExercise;
  number: number;
  onUpdate: (patch: Partial<LocalExercise>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const isNew = !exercise.matched_exercise_id;
  const groupLabel =
    GROUP_OPTIONS.find((g) => g.slug === exercise.group_slug)?.label ??
    'Grupo';

  return (
    <View className="rounded-2xl border border-border bg-surface-muted px-3 py-2.5">
      <View className="flex-row items-start gap-2">
        <Text className="text-text-muted text-xs font-semibold mt-2">
          {number}.
        </Text>
        <View className="flex-1">
          <TextInput
            value={exercise.name}
            onChangeText={(v) => onUpdate({ name: v })}
            placeholder="Nome do exercício"
            placeholderTextColor={colors.textMuted}
            style={{
              color: colors.text,
              fontSize: 14,
              fontWeight: '600',
              paddingVertical: 2,
            }}
            editable={!disabled}
          />
          <View className="flex-row items-center flex-wrap gap-1.5 mt-1">
            {isNew ? (
              <Pressable
                onPress={() => setShowGroupPicker((v) => !v)}
                hitSlop={6}
                className="flex-row items-center gap-1 rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 active:opacity-70"
                disabled={disabled}
              >
                <Text className="text-violet-soft text-[10px] font-bold uppercase tracking-widest">
                  novo · {groupLabel}
                </Text>
                <ChevronDown size={10} color={colors.violetSoft} />
              </Pressable>
            ) : (
              <View className="flex-row items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
                <Check size={10} color={colors.accent} />
                <Text className="text-accent text-[10px] font-bold uppercase tracking-widest">
                  na base
                </Text>
              </View>
            )}
          </View>

          {showGroupPicker && (
            <View className="mt-2">
              <PillPicker
                options={GROUP_OPTIONS.map((g) => ({
                  value: g.slug,
                  label: g.label,
                }))}
                value={exercise.group_slug}
                onChange={(v) => {
                  onUpdate({ group_slug: v });
                  setShowGroupPicker(false);
                }}
                disabled={disabled}
              />
            </View>
          )}

          <View className="flex-row gap-2 mt-2">
            <NumField
              label="Séries"
              value={exercise.sets}
              onChange={(n) => onUpdate({ sets: n })}
              disabled={disabled}
            />
            <NumField
              label="Reps mín"
              value={exercise.reps_min}
              onChange={(n) => onUpdate({ reps_min: n })}
              disabled={disabled}
            />
            <NumField
              label="Reps máx"
              value={exercise.reps_max}
              onChange={(n) => onUpdate({ reps_max: n })}
              disabled={disabled}
            />
          </View>

          {(exercise.notes != null || exercise.notes === '') && (
            <View className="mt-2 rounded-xl border border-border bg-surface">
              <TextInput
                value={exercise.notes ?? ''}
                onChangeText={(v) => onUpdate({ notes: v || null })}
                placeholder="Notas (variação, pausa, etc)"
                placeholderTextColor={colors.textMuted}
                multiline
                style={{
                  color: colors.text,
                  fontSize: 13,
                  padding: 10,
                  minHeight: 36,
                }}
                editable={!disabled}
              />
            </View>
          )}
          {exercise.notes == null && (
            <Pressable
              onPress={() => onUpdate({ notes: '' })}
              hitSlop={6}
              disabled={disabled}
              className="mt-2 active:opacity-70"
            >
              <Text className="text-text-muted text-[11px]">
                + adicionar notas
              </Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={onRemove}
          hitSlop={8}
          className="h-8 w-8 rounded-xl bg-surface border border-border items-center justify-center active:opacity-70"
          disabled={disabled}
        >
          <Trash2 size={13} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function PillPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              disabled={disabled}
              className={`rounded-full px-3 py-1.5 border ${
                active
                  ? 'bg-accent/15 border-accent/60'
                  : 'bg-surface border-border'
              } active:opacity-70`}
            >
              <Text
                className={`text-[11px] font-semibold ${
                  active ? 'text-accent' : 'text-text-dim'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function NumField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-1">
      <Text className="text-text-muted text-[10px] uppercase tracking-widest mb-1">
        {label}
      </Text>
      <View className="rounded-xl border border-border bg-surface">
        <TextInput
          value={value != null ? String(value) : ''}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 3);
            onChange(digits.length > 0 ? Number(digits) : null);
          }}
          placeholder="-"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          style={{
            color: colors.text,
            fontSize: 14,
            paddingVertical: 8,
            paddingHorizontal: 10,
            textAlign: 'center',
          }}
          editable={!disabled}
        />
      </View>
    </View>
  );
}
