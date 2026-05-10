import { ReactNode, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import { Button, Input } from '@/components/ui';
import { colors } from '@/lib/theme';
import type {
  ChronicConditionTag,
  DietaryRestrictionTag,
  InjuryTag,
  StudentAnamnese,
  StudentAnamnesePatch,
  Surgery,
} from '@/types/database';

type Props = {
  initial: StudentAnamnese | null;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (patch: StudentAnamnesePatch) => void | Promise<void>;
  onCancel?: () => void;
};

type FormState = {
  injuries: InjuryTag[];
  injuries_notes: string;
  surgeries: Surgery[];
  chronic_conditions: ChronicConditionTag[];
  chronic_conditions_notes: string;
  medications: string;
  allergy_food: string;
  allergy_medication: string;
  allergy_environmental: string;
  dietary_restrictions: DietaryRestrictionTag[];
  dietary_notes: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  sport_history: string;
  goal_notes: string;
  has_medical_clearance: boolean | null;
  medical_clearance_notes: string;
};

const INJURY_TAGS: { value: InjuryTag; label: string }[] = [
  { value: 'ombro_d', label: 'Ombro D' },
  { value: 'ombro_e', label: 'Ombro E' },
  { value: 'cotovelo_d', label: 'Cotovelo D' },
  { value: 'cotovelo_e', label: 'Cotovelo E' },
  { value: 'punho_d', label: 'Punho D' },
  { value: 'punho_e', label: 'Punho E' },
  { value: 'lombar', label: 'Lombar' },
  { value: 'cervical', label: 'Cervical' },
  { value: 'quadril_d', label: 'Quadril D' },
  { value: 'quadril_e', label: 'Quadril E' },
  { value: 'joelho_d', label: 'Joelho D' },
  { value: 'joelho_e', label: 'Joelho E' },
  { value: 'tornozelo_d', label: 'Tornozelo D' },
  { value: 'tornozelo_e', label: 'Tornozelo E' },
  { value: 'outros', label: 'Outros' },
];

const CHRONIC_TAGS: { value: ChronicConditionTag; label: string }[] = [
  { value: 'hipertensao', label: 'Hipertensão' },
  { value: 'diabetes_t1', label: 'Diabetes T1' },
  { value: 'diabetes_t2', label: 'Diabetes T2' },
  { value: 'hipotireoidismo', label: 'Hipotireoidismo' },
  { value: 'hipertireoidismo', label: 'Hipertireoidismo' },
  { value: 'asma', label: 'Asma' },
  { value: 'cardiopatia', label: 'Cardiopatia' },
  { value: 'dislipidemia', label: 'Dislipidemia' },
  { value: 'artrose', label: 'Artrose' },
  { value: 'artrite', label: 'Artrite' },
  { value: 'fibromialgia', label: 'Fibromialgia' },
  { value: 'epilepsia', label: 'Epilepsia' },
  { value: 'depressao', label: 'Depressão' },
  { value: 'ansiedade', label: 'Ansiedade' },
  { value: 'outros', label: 'Outros' },
];

const DIET_TAGS: { value: DietaryRestrictionTag; label: string }[] = [
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'ovolactovegetariano', label: 'Ovolactovegetariano' },
  { value: 'pescetariano', label: 'Pescetariano' },
  { value: 'sem_gluten', label: 'Sem glúten' },
  { value: 'sem_lactose', label: 'Sem lactose' },
  { value: 'low_carb', label: 'Low carb' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'halal', label: 'Halal' },
  { value: 'jejum_intermitente', label: 'Jejum intermitente' },
  { value: 'outros', label: 'Outros' },
];

export default function AnamneseForm({
  initial,
  submitting,
  submitLabel = 'Salvar anamnese',
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initial));
  const [open, setOpen] = useState<Record<string, boolean>>({
    lesoes: true,
    saude: false,
    alergias: false,
    historico: false,
    emergencia: false,
  });

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function toggleSection(key: string) {
    setOpen((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleSubmit() {
    await onSubmit(toPatch(form));
  }

  return (
    <View className="gap-3">
      <Section
        title="Lesões e cirurgias"
        count={countSection([
          form.injuries.length,
          form.injuries_notes,
          form.surgeries.length,
        ])}
        open={open.lesoes}
        onToggle={() => toggleSection('lesoes')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Lesões ortopédicas
        </Text>
        <TagPicker
          options={INJURY_TAGS}
          selected={form.injuries}
          onToggle={(v) =>
            patch({ injuries: toggleArr(form.injuries, v) })
          }
        />
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Observações
          </Text>
          <MultilineField
            value={form.injuries_notes}
            onChange={(v) => patch({ injuries_notes: v })}
            placeholder="Detalhes sobre as lesões, restrições de movimento..."
          />
        </View>
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Cirurgias prévias
          </Text>
          <SurgeryList
            surgeries={form.surgeries}
            onChange={(surgeries) => patch({ surgeries })}
          />
        </View>
      </Section>

      <Section
        title="Saúde geral"
        count={countSection([
          form.chronic_conditions.length,
          form.chronic_conditions_notes,
          form.medications,
          form.has_medical_clearance != null ? 1 : 0,
        ])}
        open={open.saude}
        onToggle={() => toggleSection('saude')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Doenças crônicas
        </Text>
        <TagPicker
          options={CHRONIC_TAGS}
          selected={form.chronic_conditions}
          onToggle={(v) =>
            patch({ chronic_conditions: toggleArr(form.chronic_conditions, v) })
          }
        />
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Observações
          </Text>
          <MultilineField
            value={form.chronic_conditions_notes}
            onChange={(v) => patch({ chronic_conditions_notes: v })}
            placeholder="Detalhes sobre as condições..."
          />
        </View>
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Medicamentos em uso
          </Text>
          <MultilineField
            value={form.medications}
            onChange={(v) => patch({ medications: v })}
            placeholder="Ex: Losartana 50mg 2x/dia, AAS 100mg 1x/dia..."
          />
          <Text className="text-text-muted text-[11px] mt-2">
            Só o coach lê. A IA não usa esse campo pra decisões.
          </Text>
        </View>
        <View className="mt-4 flex-row items-center justify-between">
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text className="text-text font-semibold">Tem liberação médica</Text>
            <Text className="text-text-muted text-xs mt-1 leading-relaxed">
              Laudo do médico autorizando atividade física.
            </Text>
          </View>
          <Switch
            value={form.has_medical_clearance ?? false}
            onValueChange={(v) => patch({ has_medical_clearance: v })}
            trackColor={{ false: colors.borderStrong, true: colors.accentDeep }}
            thumbColor={
              form.has_medical_clearance ? colors.accent : colors.textMuted
            }
          />
        </View>
        {form.has_medical_clearance && (
          <View className="mt-3">
            <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
              Detalhes do laudo
            </Text>
            <MultilineField
              value={form.medical_clearance_notes}
              onChange={(v) => patch({ medical_clearance_notes: v })}
              placeholder="Data do laudo, restrições específicas..."
            />
          </View>
        )}
      </Section>

      <Section
        title="Alergias e alimentação"
        count={countSection([
          form.allergy_food,
          form.allergy_medication,
          form.allergy_environmental,
          form.dietary_restrictions.length,
          form.dietary_notes,
        ])}
        open={open.alergias}
        onToggle={() => toggleSection('alergias')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Alergia alimentar
        </Text>
        <MultilineField
          value={form.allergy_food}
          onChange={(v) => patch({ allergy_food: v })}
          placeholder="Ex: amendoim, frutos do mar..."
        />
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Alergia medicamentosa
          </Text>
          <MultilineField
            value={form.allergy_medication}
            onChange={(v) => patch({ allergy_medication: v })}
            placeholder="Ex: penicilina, dipirona..."
          />
        </View>
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Alergia ambiental
          </Text>
          <MultilineField
            value={form.allergy_environmental}
            onChange={(v) => patch({ allergy_environmental: v })}
            placeholder="Ex: ácaro, pólen, picada de inseto..."
          />
        </View>
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Restrições alimentares
          </Text>
          <TagPicker
            options={DIET_TAGS}
            selected={form.dietary_restrictions}
            onToggle={(v) =>
              patch({
                dietary_restrictions: toggleArr(form.dietary_restrictions, v),
              })
            }
          />
        </View>
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Observações alimentares
          </Text>
          <MultilineField
            value={form.dietary_notes}
            onChange={(v) => patch({ dietary_notes: v })}
            placeholder="Detalhes ou outras restrições..."
          />
        </View>
      </Section>

      <Section
        title="Histórico esportivo e objetivo"
        count={countSection([form.sport_history, form.goal_notes])}
        open={open.historico}
        onToggle={() => toggleSection('historico')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Histórico esportivo
        </Text>
        <MultilineField
          value={form.sport_history}
          onChange={(v) => patch({ sport_history: v })}
          placeholder="Ex: joguei futebol amador 10 anos, parei em 2018, voltei a treinar academia em 2023..."
        />
        <View className="mt-4">
          <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
            Objetivo específico
          </Text>
          <MultilineField
            value={form.goal_notes}
            onChange={(v) => patch({ goal_notes: v })}
            placeholder="Ex: perder 8kg até dezembro, foco em abdome e braços..."
          />
        </View>
      </Section>

      <Section
        title="Contato de emergência"
        count={countSection([
          form.emergency_contact_name,
          form.emergency_contact_phone,
          form.emergency_contact_relation,
        ])}
        open={open.emergencia}
        onToggle={() => toggleSection('emergencia')}
      >
        <Input
          label="Nome"
          value={form.emergency_contact_name}
          onChangeText={(v) => patch({ emergency_contact_name: v })}
          placeholder="Nome completo"
        />
        <View className="mt-3" />
        <Input
          label="Telefone"
          value={form.emergency_contact_phone}
          onChangeText={(v) => patch({ emergency_contact_phone: v })}
          placeholder="(11) 9 9999-9999"
          keyboardType="phone-pad"
        />
        <View className="mt-3" />
        <Input
          label="Relação"
          value={form.emergency_contact_relation}
          onChangeText={(v) => patch({ emergency_contact_relation: v })}
          placeholder="Esposa, pai, amigo..."
        />
      </Section>

      <View className="gap-2 mt-2">
        <Button
          label={submitLabel}
          onPress={handleSubmit}
          loading={submitting}
        />
        {onCancel && (
          <Button label="Cancelar" onPress={onCancel} variant="ghost" />
        )}
      </View>
    </View>
  );
}

// =====================================================================
// Sub-components
// =====================================================================
function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View className="rounded-3xl border border-border bg-surface overflow-hidden">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-3.5 active:opacity-80"
      >
        <View>
          <Text className="text-text font-semibold">{title}</Text>
          {count && (
            <Text className="text-text-muted text-[11px] mt-0.5">{count}</Text>
          )}
        </View>
        {open ? (
          <ChevronUp size={18} color={colors.textDim} />
        ) : (
          <ChevronDown size={18} color={colors.textDim} />
        )}
      </Pressable>
      {open && (
        <View className="px-4 pb-4 pt-1 border-t border-border-subtle">
          {children}
        </View>
      )}
    </View>
  );
}

function TagPicker<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => onToggle(opt.value)}
            className={`rounded-full border px-3 py-1.5 active:opacity-70 ${
              active
                ? 'bg-accent border-accent'
                : 'bg-surface-muted border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-text-inverse' : 'text-text-dim'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MultilineField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View className="rounded-2xl border border-border bg-surface">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: 80,
          color: colors.text,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 14,
        }}
      />
    </View>
  );
}

function SurgeryList({
  surgeries,
  onChange,
}: {
  surgeries: Surgery[];
  onChange: (s: Surgery[]) => void;
}) {
  function update(idx: number, patch: Partial<Surgery>) {
    onChange(surgeries.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    onChange(surgeries.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...surgeries, { date: '', type: '' }]);
  }
  return (
    <View className="gap-2">
      {surgeries.map((s, i) => (
        <View
          key={i}
          className="rounded-xl border border-border bg-surface-muted p-3 gap-2"
        >
          <View className="flex-row gap-2">
            <View style={{ flex: 1 }}>
              <Input
                label="Data (AAAA-MM)"
                value={s.date}
                onChangeText={(v) => update(i, { date: v })}
                placeholder="2022-06"
                maxLength={7}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <Pressable
              onPress={() => remove(i)}
              hitSlop={8}
              className="self-end h-12 w-12 rounded-2xl bg-surface border border-border items-center justify-center active:opacity-70"
            >
              <Trash2 size={14} color={colors.danger} />
            </Pressable>
          </View>
          <Input
            label="Tipo"
            value={s.type}
            onChangeText={(v) => update(i, { type: v })}
            placeholder="Ex: meniscectomia, hérnia de disco..."
          />
          <Input
            label="Observações"
            value={s.notes ?? ''}
            onChangeText={(v) => update(i, { notes: v || undefined })}
            placeholder="(opcional)"
          />
        </View>
      ))}
      <Pressable
        onPress={add}
        className="rounded-xl border border-dashed border-border-strong px-3 py-3 flex-row items-center justify-center gap-2 active:opacity-70"
      >
        <Plus size={14} color={colors.accent} />
        <Text className="text-text font-semibold text-sm">
          Adicionar cirurgia
        </Text>
      </Pressable>
    </View>
  );
}

// =====================================================================
// Helpers
// =====================================================================
function buildInitialState(initial: StudentAnamnese | null): FormState {
  if (!initial) {
    return {
      injuries: [],
      injuries_notes: '',
      surgeries: [],
      chronic_conditions: [],
      chronic_conditions_notes: '',
      medications: '',
      allergy_food: '',
      allergy_medication: '',
      allergy_environmental: '',
      dietary_restrictions: [],
      dietary_notes: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      sport_history: '',
      goal_notes: '',
      has_medical_clearance: null,
      medical_clearance_notes: '',
    };
  }
  return {
    injuries: initial.injuries ?? [],
    injuries_notes: initial.injuries_notes ?? '',
    surgeries: initial.surgeries ?? [],
    chronic_conditions: initial.chronic_conditions ?? [],
    chronic_conditions_notes: initial.chronic_conditions_notes ?? '',
    medications: initial.medications ?? '',
    allergy_food: initial.allergy_food ?? '',
    allergy_medication: initial.allergy_medication ?? '',
    allergy_environmental: initial.allergy_environmental ?? '',
    dietary_restrictions: initial.dietary_restrictions ?? [],
    dietary_notes: initial.dietary_notes ?? '',
    emergency_contact_name: initial.emergency_contact_name ?? '',
    emergency_contact_phone: initial.emergency_contact_phone ?? '',
    emergency_contact_relation: initial.emergency_contact_relation ?? '',
    sport_history: initial.sport_history ?? '',
    goal_notes: initial.goal_notes ?? '',
    has_medical_clearance: initial.has_medical_clearance,
    medical_clearance_notes: initial.medical_clearance_notes ?? '',
  };
}

function toPatch(form: FormState): StudentAnamnesePatch {
  // Filtra cirurgias incompletas (sem data ou tipo)
  const validSurgeries = form.surgeries.filter(
    (s) => s.date.trim() && s.type.trim(),
  );
  return {
    injuries: form.injuries,
    injuries_notes: form.injuries_notes.trim() || null,
    surgeries: validSurgeries,
    chronic_conditions: form.chronic_conditions,
    chronic_conditions_notes: form.chronic_conditions_notes.trim() || null,
    medications: form.medications.trim() || null,
    allergy_food: form.allergy_food.trim() || null,
    allergy_medication: form.allergy_medication.trim() || null,
    allergy_environmental: form.allergy_environmental.trim() || null,
    dietary_restrictions: form.dietary_restrictions,
    dietary_notes: form.dietary_notes.trim() || null,
    emergency_contact_name: form.emergency_contact_name.trim() || null,
    emergency_contact_phone: form.emergency_contact_phone.trim() || null,
    emergency_contact_relation: form.emergency_contact_relation.trim() || null,
    sport_history: form.sport_history.trim() || null,
    goal_notes: form.goal_notes.trim() || null,
    has_medical_clearance: form.has_medical_clearance,
    medical_clearance_notes: form.medical_clearance_notes.trim() || null,
  };
}

function toggleArr<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function countSection(values: (string | number)[]): string {
  const total = values.length;
  const filled = values.filter((v) =>
    typeof v === 'number' ? v > 0 : !!v && v.toString().trim(),
  ).length;
  return `${filled} de ${total} preenchidos`;
}
