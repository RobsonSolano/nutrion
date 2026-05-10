import { ReactNode, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Button, Card, Input, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import type {
  AssessmentProtocol,
  PhysicalAssessment,
  PhysicalAssessmentInput,
  Sex,
} from '@/types/database';

type Props = {
  studentId: string;
  studentSex: Sex | null;
  initial?: PhysicalAssessment | null;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: PhysicalAssessmentInput) => void | Promise<void>;
  onCancel?: () => void;
};

type FormState = {
  assessed_at: string; // YYYY-MM-DD
  protocol: AssessmentProtocol;
  weight_kg: string;
  height_cm: string;
  perim_arm_r_cm: string;
  perim_arm_l_cm: string;
  perim_forearm_r_cm: string;
  perim_forearm_l_cm: string;
  perim_chest_cm: string;
  perim_waist_cm: string;
  perim_hip_cm: string;
  perim_thigh_r_cm: string;
  perim_thigh_l_cm: string;
  perim_calf_r_cm: string;
  perim_calf_l_cm: string;
  skin_chest_mm: string;
  skin_midaxillary_mm: string;
  skin_triceps_mm: string;
  skin_subscapular_mm: string;
  skin_abdominal_mm: string;
  skin_suprailiac_mm: string;
  skin_thigh_mm: string;
  posture_notes: string;
  notes: string;
};

const PROTOCOL_OPTIONS = [
  { value: 'pollock_3' as const, label: '3 dobras' },
  { value: 'pollock_7' as const, label: '7 dobras' },
  { value: 'none' as const, label: 'Nenhum' },
];

export default function AssessmentForm({
  studentId,
  studentSex,
  initial,
  submitting,
  submitLabel = 'Salvar avaliação',
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    antropometria: true,
    perimetria: true,
    dobras: false,
    postural: false,
    notas: false,
  });

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function toggle(key: string) {
    setOpenSection((s) => ({ ...s, [key]: !s[key] }));
  }

  const skinFolds = useMemo(
    () => relevantSkinFolds(form.protocol, studentSex),
    [form.protocol, studentSex],
  );

  async function handleSubmit() {
    const result = validate(form);
    if (!result.ok) {
      setErrors(result.errors);
      // Abre os accordions dos blocos com erro
      const open: Record<string, boolean> = { ...openSection };
      for (const k of Object.keys(result.errors)) {
        if (k === 'weight_kg' || k === 'height_cm' || k === 'assessed_at')
          open.antropometria = true;
        else if (k.startsWith('perim_')) open.perimetria = true;
        else if (k.startsWith('skin_')) open.dobras = true;
      }
      setOpenSection(open);
      return;
    }
    setErrors({});
    await onSubmit(toInput(studentId, form));
  }

  return (
    <View className="gap-3">
      <Card padding="md">
        <View className="gap-4">
          <View>
            <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
              Data
            </Text>
            <DateField
              value={form.assessed_at}
              onChange={(v) => patch({ assessed_at: v })}
              error={errors.assessed_at}
            />
          </View>

          <View>
            <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
              Protocolo de dobras
            </Text>
            <SegmentedControl
              options={PROTOCOL_OPTIONS}
              value={form.protocol}
              onChange={(v) => patch({ protocol: v })}
            />
            <Text className="text-text-muted text-[11px] mt-2 leading-relaxed">
              {form.protocol === 'pollock_3'
                ? 'Pollock 3 dobras: cobre 95% dos casos. Os campos exibidos são os relevantes ao sexo do aluno.'
                : form.protocol === 'pollock_7'
                  ? 'Pollock 7 dobras: maior precisão. Preencha as 7 medidas pra calcular % de gordura.'
                  : 'Sem dobras: avaliação fica só com peso/perimetria. % de gordura não será calculado.'}
            </Text>
          </View>
        </View>
      </Card>

      <Section
        title="Antropometria"
        open={openSection.antropometria}
        onToggle={() => toggle('antropometria')}
      >
        <View className="flex-row gap-3">
          <View style={{ flex: 1 }}>
            <Input
              label="Peso (kg)"
              keyboardType="decimal-pad"
              value={form.weight_kg}
              onChangeText={(v) => patch({ weight_kg: v })}
              placeholder="78,4"
              error={errors.weight_kg}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Altura (cm)"
              keyboardType="decimal-pad"
              value={form.height_cm}
              onChangeText={(v) => patch({ height_cm: v })}
              placeholder="174"
              error={errors.height_cm}
            />
          </View>
        </View>
      </Section>

      <Section
        title="Perimetria (cm)"
        open={openSection.perimetria}
        onToggle={() => toggle('perimetria')}
      >
        <PerimetryRow
          labelL="Braço esquerdo"
          labelR="Braço direito"
          left={form.perim_arm_l_cm}
          right={form.perim_arm_r_cm}
          onLeft={(v) => patch({ perim_arm_l_cm: v })}
          onRight={(v) => patch({ perim_arm_r_cm: v })}
        />
        <PerimetryRow
          labelL="Antebraço esq."
          labelR="Antebraço dir."
          left={form.perim_forearm_l_cm}
          right={form.perim_forearm_r_cm}
          onLeft={(v) => patch({ perim_forearm_l_cm: v })}
          onRight={(v) => patch({ perim_forearm_r_cm: v })}
        />
        <View className="flex-row gap-3 mt-3">
          <View style={{ flex: 1 }}>
            <Input
              label="Peito"
              keyboardType="decimal-pad"
              value={form.perim_chest_cm}
              onChangeText={(v) => patch({ perim_chest_cm: v })}
              placeholder="—"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Cintura"
              keyboardType="decimal-pad"
              value={form.perim_waist_cm}
              onChangeText={(v) => patch({ perim_waist_cm: v })}
              placeholder="—"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Quadril"
              keyboardType="decimal-pad"
              value={form.perim_hip_cm}
              onChangeText={(v) => patch({ perim_hip_cm: v })}
              placeholder="—"
            />
          </View>
        </View>
        <View className="mt-3" />
        <PerimetryRow
          labelL="Coxa esquerda"
          labelR="Coxa direita"
          left={form.perim_thigh_l_cm}
          right={form.perim_thigh_r_cm}
          onLeft={(v) => patch({ perim_thigh_l_cm: v })}
          onRight={(v) => patch({ perim_thigh_r_cm: v })}
        />
        <PerimetryRow
          labelL="Panturrilha esq."
          labelR="Panturrilha dir."
          left={form.perim_calf_l_cm}
          right={form.perim_calf_r_cm}
          onLeft={(v) => patch({ perim_calf_l_cm: v })}
          onRight={(v) => patch({ perim_calf_r_cm: v })}
        />
      </Section>

      {form.protocol !== 'none' && (
        <Section
          title={`Dobras cutâneas (mm) — ${form.protocol === 'pollock_3' ? '3' : '7'} dobras`}
          open={openSection.dobras}
          onToggle={() => toggle('dobras')}
        >
          <SkinFoldsBlock
            keys={skinFolds}
            form={form}
            errors={errors}
            patch={patch}
          />
        </Section>
      )}

      <Section
        title="Postural"
        open={openSection.postural}
        onToggle={() => toggle('postural')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Observações posturais
        </Text>
        <MultilineField
          value={form.posture_notes}
          onChange={(v) => patch({ posture_notes: v })}
          placeholder="Cifose acentuada, ombro D elevado, hiperlordose lombar..."
        />
        <Text className="text-text-muted text-[11px] mt-2">
          Fotos posturais entram numa próxima fase.
        </Text>
      </Section>

      <Section
        title="Observações gerais"
        open={openSection.notas}
        onToggle={() => toggle('notas')}
      >
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          Anotações livres
        </Text>
        <MultilineField
          value={form.notes}
          onChange={(v) => patch({ notes: v })}
          placeholder="Histórico recente, queixas, observações específicas..."
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
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View className="rounded-2xl border border-border bg-surface overflow-hidden">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between px-4 py-3.5 active:opacity-80"
      >
        <Text className="text-text font-semibold">{title}</Text>
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

function PerimetryRow({
  labelL,
  labelR,
  left,
  right,
  onLeft,
  onRight,
}: {
  labelL: string;
  labelR: string;
  left: string;
  right: string;
  onLeft: (v: string) => void;
  onRight: (v: string) => void;
}) {
  return (
    <View className="flex-row gap-3 mt-3">
      <View style={{ flex: 1 }}>
        <Input
          label={labelL}
          keyboardType="decimal-pad"
          value={left}
          onChangeText={onLeft}
          placeholder="—"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Input
          label={labelR}
          keyboardType="decimal-pad"
          value={right}
          onChangeText={onRight}
          placeholder="—"
        />
      </View>
    </View>
  );
}

function SkinFoldsBlock({
  keys,
  form,
  errors,
  patch,
}: {
  keys: { key: keyof FormState; label: string }[];
  form: FormState;
  errors: Partial<Record<keyof FormState, string>>;
  patch: (p: Partial<FormState>) => void;
}) {
  return (
    <View className="gap-3">
      {keys.map(({ key, label }) => (
        <Input
          key={key}
          label={label}
          keyboardType="decimal-pad"
          value={form[key]}
          onChangeText={(v) => patch({ [key]: v } as Partial<FormState>)}
          placeholder="mm"
          error={errors[key]}
        />
      ))}
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
          minHeight: 96,
          color: colors.text,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 15,
        }}
      />
    </View>
  );
}

function DateField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  // value: ISO YYYY-MM-DD; UI mostra DD/MM/AAAA
  const display = isoToBr(value);
  return (
    <Input
      keyboardType="number-pad"
      value={display}
      onChangeText={(v) => onChange(brToIso(v))}
      placeholder="DD/MM/AAAA"
      error={error}
      maxLength={10}
    />
  );
}

// =====================================================================
// Helpers
// =====================================================================
function buildInitialState(initial?: PhysicalAssessment | null): FormState {
  const today = new Date();
  const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!initial) {
    return {
      assessed_at: isoToday,
      protocol: 'pollock_3',
      weight_kg: '',
      height_cm: '',
      perim_arm_r_cm: '',
      perim_arm_l_cm: '',
      perim_forearm_r_cm: '',
      perim_forearm_l_cm: '',
      perim_chest_cm: '',
      perim_waist_cm: '',
      perim_hip_cm: '',
      perim_thigh_r_cm: '',
      perim_thigh_l_cm: '',
      perim_calf_r_cm: '',
      perim_calf_l_cm: '',
      skin_chest_mm: '',
      skin_midaxillary_mm: '',
      skin_triceps_mm: '',
      skin_subscapular_mm: '',
      skin_abdominal_mm: '',
      skin_suprailiac_mm: '',
      skin_thigh_mm: '',
      posture_notes: '',
      notes: '',
    };
  }
  return {
    assessed_at: initial.assessed_at,
    protocol: initial.protocol,
    weight_kg: numToStr(initial.weight_kg),
    height_cm: numToStr(initial.height_cm),
    perim_arm_r_cm: numToStr(initial.perim_arm_r_cm),
    perim_arm_l_cm: numToStr(initial.perim_arm_l_cm),
    perim_forearm_r_cm: numToStr(initial.perim_forearm_r_cm),
    perim_forearm_l_cm: numToStr(initial.perim_forearm_l_cm),
    perim_chest_cm: numToStr(initial.perim_chest_cm),
    perim_waist_cm: numToStr(initial.perim_waist_cm),
    perim_hip_cm: numToStr(initial.perim_hip_cm),
    perim_thigh_r_cm: numToStr(initial.perim_thigh_r_cm),
    perim_thigh_l_cm: numToStr(initial.perim_thigh_l_cm),
    perim_calf_r_cm: numToStr(initial.perim_calf_r_cm),
    perim_calf_l_cm: numToStr(initial.perim_calf_l_cm),
    skin_chest_mm: numToStr(initial.skin_chest_mm),
    skin_midaxillary_mm: numToStr(initial.skin_midaxillary_mm),
    skin_triceps_mm: numToStr(initial.skin_triceps_mm),
    skin_subscapular_mm: numToStr(initial.skin_subscapular_mm),
    skin_abdominal_mm: numToStr(initial.skin_abdominal_mm),
    skin_suprailiac_mm: numToStr(initial.skin_suprailiac_mm),
    skin_thigh_mm: numToStr(initial.skin_thigh_mm),
    posture_notes: initial.posture_notes ?? '',
    notes: initial.notes ?? '',
  };
}

const PERIM_KEYS = [
  'perim_arm_r_cm',
  'perim_arm_l_cm',
  'perim_forearm_r_cm',
  'perim_forearm_l_cm',
  'perim_chest_cm',
  'perim_waist_cm',
  'perim_hip_cm',
  'perim_thigh_r_cm',
  'perim_thigh_l_cm',
  'perim_calf_r_cm',
  'perim_calf_l_cm',
] as const;

const SKIN_KEYS = [
  'skin_chest_mm',
  'skin_midaxillary_mm',
  'skin_triceps_mm',
  'skin_subscapular_mm',
  'skin_abdominal_mm',
  'skin_suprailiac_mm',
  'skin_thigh_mm',
] as const;

function relevantSkinFolds(
  protocol: AssessmentProtocol,
  sex: Sex | null,
): { key: (typeof SKIN_KEYS)[number]; label: string }[] {
  if (protocol === 'none') return [];
  if (protocol === 'pollock_7') {
    return [
      { key: 'skin_chest_mm', label: 'Peitoral' },
      { key: 'skin_midaxillary_mm', label: 'Axilar média' },
      { key: 'skin_triceps_mm', label: 'Tríceps' },
      { key: 'skin_subscapular_mm', label: 'Subescapular' },
      { key: 'skin_abdominal_mm', label: 'Abdominal' },
      { key: 'skin_suprailiac_mm', label: 'Suprailíaca' },
      { key: 'skin_thigh_mm', label: 'Coxa' },
    ];
  }
  // pollock_3
  if (sex === 'f') {
    return [
      { key: 'skin_triceps_mm', label: 'Tríceps' },
      { key: 'skin_suprailiac_mm', label: 'Suprailíaca' },
      { key: 'skin_thigh_mm', label: 'Coxa' },
    ];
  }
  // m ou outro/null → assume protocolo masculino
  return [
    { key: 'skin_chest_mm', label: 'Peitoral' },
    { key: 'skin_abdominal_mm', label: 'Abdominal' },
    { key: 'skin_thigh_mm', label: 'Coxa' },
  ];
}

function validate(form: FormState): {
  ok: boolean;
  errors: Partial<Record<keyof FormState, string>>;
} {
  const errors: Partial<Record<keyof FormState, string>> = {};

  if (!form.assessed_at || !/^\d{4}-\d{2}-\d{2}$/.test(form.assessed_at)) {
    errors.assessed_at = 'Use o formato DD/MM/AAAA';
  } else {
    const d = new Date(`${form.assessed_at}T00:00:00`);
    if (isNaN(d.getTime())) errors.assessed_at = 'Data inválida';
  }

  if (form.weight_kg) {
    const n = parseNum(form.weight_kg);
    if (n == null || n < 20 || n > 400) errors.weight_kg = 'Entre 20 e 400 kg';
  }
  if (form.height_cm) {
    const n = parseNum(form.height_cm);
    if (n == null || n < 80 || n > 250) errors.height_cm = 'Entre 80 e 250 cm';
  }

  for (const k of PERIM_KEYS) {
    const raw = form[k];
    if (!raw) continue;
    const n = parseNum(raw);
    if (n == null || n <= 0 || n > 300) errors[k] = '0 a 300 cm';
  }
  for (const k of SKIN_KEYS) {
    const raw = form[k];
    if (!raw) continue;
    const n = parseNum(raw);
    if (n == null || n <= 0 || n > 100) errors[k] = '0 a 100 mm';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

function toInput(
  studentId: string,
  form: FormState,
): PhysicalAssessmentInput {
  return {
    student_id: studentId,
    assessed_at: form.assessed_at,
    protocol: form.protocol,
    weight_kg: parseNum(form.weight_kg),
    height_cm: parseNum(form.height_cm),
    perim_arm_r_cm: parseNum(form.perim_arm_r_cm),
    perim_arm_l_cm: parseNum(form.perim_arm_l_cm),
    perim_forearm_r_cm: parseNum(form.perim_forearm_r_cm),
    perim_forearm_l_cm: parseNum(form.perim_forearm_l_cm),
    perim_chest_cm: parseNum(form.perim_chest_cm),
    perim_waist_cm: parseNum(form.perim_waist_cm),
    perim_hip_cm: parseNum(form.perim_hip_cm),
    perim_thigh_r_cm: parseNum(form.perim_thigh_r_cm),
    perim_thigh_l_cm: parseNum(form.perim_thigh_l_cm),
    perim_calf_r_cm: parseNum(form.perim_calf_r_cm),
    perim_calf_l_cm: parseNum(form.perim_calf_l_cm),
    skin_chest_mm: parseNum(form.skin_chest_mm),
    skin_midaxillary_mm: parseNum(form.skin_midaxillary_mm),
    skin_triceps_mm: parseNum(form.skin_triceps_mm),
    skin_subscapular_mm: parseNum(form.skin_subscapular_mm),
    skin_abdominal_mm: parseNum(form.skin_abdominal_mm),
    skin_suprailiac_mm: parseNum(form.skin_suprailiac_mm),
    skin_thigh_mm: parseNum(form.skin_thigh_mm),
    posture_notes: form.posture_notes.trim() || null,
    posture_photos: [],
    notes: form.notes.trim() || null,
  };
}

function parseNum(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function numToStr(n: number | null): string {
  if (n == null) return '';
  return String(n).replace('.', ',');
}

function isoToBr(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function brToIso(br: string): string {
  // Aceita digitação progressiva (DD, DD/MM, DD/MM/AA, DD/MM/AAAA)
  const digits = br.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 8) {
    // mantém vazio até completar
    if (digits.length === 0) return '';
    return digits; // fica como número parcial — serve só pra mostrar
  }
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return `${y}-${m}-${d}`;
}
