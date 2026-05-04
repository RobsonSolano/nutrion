import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Button,
  Card,
  ConfirmModal,
  Input,
  MarkdownText,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import { colors } from '@/lib/theme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import {
  useCreateStudent,
  useGenerateStudentPlan,
  useSaveStudentPlan,
  useSendStudentCredentials,
} from '@/hooks/useStudents';
import type { OnboardingPlan } from '@/services/onboarding';
import type { Profile, Sex, GoalType, WeeklyFrequency } from '@/types/database';
import { captureError } from '@/lib/sentry';

type Phase = 'form' | 'generating' | 'preview' | 'saving';

const SEX_OPTIONS = [
  { value: 'm', label: 'Masc' },
  { value: 'f', label: 'Fem' },
  { value: 'o', label: 'Outro' },
] as const;

const GOAL_OPTIONS = [
  { value: 'lose_fat', label: 'Emagrecer' },
  { value: 'maintain', label: 'Manter' },
  { value: 'gain_muscle', label: 'Ganhar' },
  { value: 'reduce_body_fat', label: 'Definir' },
] as const;

const FREQ_OPTIONS = [
  { value: '1-2', label: '1-2x' },
  { value: '2-3', label: '2-3x' },
  { value: '3-4', label: '3-4x' },
  { value: '4-5', label: '4-5x' },
  { value: '5-6', label: '5-6x' },
  { value: '6-7', label: '6-7x' },
] as const;

const SPORTS = [
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'calistenia', label: '🤸 Calistenia' },
  { value: 'crossfit', label: '🔥 CrossFit' },
  { value: 'powerlifting', label: '💪 Powerlifting' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'ciclismo', label: '🚴 Ciclismo' },
  { value: 'natacao', label: '🏊 Natação' },
  { value: 'luta', label: '🥊 Luta' },
  { value: 'danca', label: '💃 Dança' },
  { value: 'outro', label: '🎯 Outro' },
];

function generatePassword(): string {
  // Sem caracteres ambíguos (0/O, 1/l/I, etc).
  const charset =
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += charset[Math.floor(Math.random() * charset.length)];
  }
  return pwd;
}

export default function AlunoNovo() {
  const router = useRouter();
  const kbHeight = useKeyboardHeight();

  const createMutation = useCreateStudent();
  const generateMutation = useGenerateStudentPlan();
  const saveMutation = useSaveStudentPlan();
  const sendCredsMutation = useSendStudentCredentials();

  const [phase, setPhase] = useState<Phase>('form');

  // Identidade
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Ficha
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [goalWeight, setGoalWeight] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<WeeklyFrequency | null>(null);
  const [allergies, setAllergies] = useState('');
  const [limitations, setLimitations] = useState('');
  const [bio, setBio] = useState('');

  // Resultado
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentPassword, setStudentPassword] = useState<string | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);

  function toggleSport(s: string) {
    setSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  const canSubmitForm =
    email.length > 3 &&
    password.length >= 6 &&
    fullName.trim().length >= 2 &&
    sex !== null &&
    weight.length > 0 &&
    height.length > 0 &&
    goalType !== null &&
    sports.length > 0 &&
    frequency !== null;

  async function handleCreateAndGenerate() {
    if (!canSubmitForm) return;
    setPhase('generating');
    try {
      // 1. Cria a conta + ficha completa
      const { student } = await createMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        sex,
        birth_year: birthYear ? Number(birthYear) : null,
        weight_kg: weight ? Number(weight) : null,
        height_cm: height ? Number(height) : null,
        goal_type: goalType,
        goal_weight_kg: goalWeight ? Number(goalWeight) : null,
        practices_sport: true,
        sports,
        weekly_frequency: frequency,
        water_goal_ml: 2500,
        allergies: allergies.trim() || null,
        physical_limitations: limitations.trim() || null,
        bio: bio.trim() || null,
      });
      setStudentId(student.id);
      setStudentPassword(password);

      // 2. Gera o plano via IA
      const { plan: generated } = await generateMutation.mutateAsync(
        student.id,
      );
      setPlan(generated);
      setPhase('preview');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      captureError(err, { feature: 'coach_create_student' });
      setPhase('form');
      Alert.alert(
        'Não consegui cadastrar',
        err instanceof Error ? err.message : 'Verifica os dados e tenta de novo.',
      );
    }
  }

  async function handleRegenerate() {
    if (!studentId) return;
    setPhase('generating');
    try {
      const { plan: regenerated } = await generateMutation.mutateAsync(
        studentId,
      );
      setPlan(regenerated);
      setPhase('preview');
    } catch (err) {
      captureError(err, { feature: 'coach_regenerate_plan' });
      setPhase('preview');
      Alert.alert(
        'Não consegui gerar de novo',
        err instanceof Error ? err.message : 'Tenta de novo em instantes.',
      );
    }
  }

  async function handleSave() {
    if (!studentId || !plan) return;
    setPhase('saving');
    try {
      await saveMutation.mutateAsync({ studentId, plan });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Volta pra 'preview' antes de abrir o modal: o ConfirmModal só
      // está renderizado dentro do bloco `phase === 'preview'`, então
      // sem voltar a tela ficava travada em <SavingScreen /> e o modal
      // nunca aparecia.
      setPhase('preview');
      setConfirmEmailOpen(true);
    } catch (err) {
      captureError(err, { feature: 'coach_save_plan' });
      setPhase('preview');
      Alert.alert(
        'Não consegui salvar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  async function handleSendEmail() {
    if (!studentId || !studentPassword) return;
    setConfirmEmailOpen(false);
    try {
      await sendCredsMutation.mutateAsync({
        studentId,
        password: studentPassword,
      });
      Alert.alert('Email enviado', 'O aluno recebeu os dados de acesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Não consegui enviar o email',
        err instanceof Error ? err.message : 'Tenta de novo.',
        [
          { text: 'Voltar pra lista', onPress: () => router.back() },
          { text: 'OK' },
        ],
      );
    }
  }

  function skipEmail() {
    setConfirmEmailOpen(false);
    router.back();
  }

  if (phase === 'generating') {
    return <GeneratingScreen />;
  }
  if (phase === 'saving') {
    return <SavingScreen />;
  }
  if (phase === 'preview' && plan) {
    return (
      <>
        <PreviewScreen
          plan={plan}
          studentName={fullName.trim()}
          onSave={handleSave}
          onRegenerate={handleRegenerate}
          saving={saveMutation.isPending}
        />
        <ConfirmModal
          visible={confirmEmailOpen}
          onClose={skipEmail}
          title="Encaminhar dados pro email?"
          message={`Enviar email pro aluno (${email}) com email + senha de acesso?`}
          icon={<Mail size={26} color={colors.violetSoft} />}
          actions={[
            {
              label: 'Enviar email',
              variant: 'primary',
              onPress: handleSendEmail,
              loading: sendCredsMutation.isPending,
            },
            {
              label: 'Pular',
              variant: 'ghost',
              onPress: skipEmail,
            },
          ]}
        />
      </>
    );
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32 + (Platform.OS === 'android' ? kbHeight : 0),
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="self-start h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>

          <View>
            <Text className="text-text text-2xl font-bold">Novo aluno</Text>
            <Text className="text-text-dim text-sm mt-1 leading-relaxed">
              Preencha a ficha. A IA vai gerar metas e treinos baseados nesses
              dados.
            </Text>
          </View>

          <Section title="Identidade">
            <Input
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nome completo do aluno"
              autoCapitalize="words"
            />
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="email@exemplo.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <View className="gap-2">
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Senha (mín. 6 caracteres)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setPassword(generatePassword())}
                className="self-start flex-row items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-3 py-1.5 active:opacity-70"
              >
                <RefreshCcw size={11} color={colors.violetSoft} />
                <Text className="text-violet-soft text-[11px] font-semibold">
                  Gerar senha aleatória
                </Text>
              </Pressable>
            </View>
          </Section>

          <Section title="Biometria">
            <Label>Sexo</Label>
            <SegmentedControl
              options={SEX_OPTIONS}
              value={sex ?? ''}
              onChange={(v) => setSex(v as Sex)}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Input
                  value={birthYear}
                  onChangeText={setBirthYear}
                  placeholder="Ano nasc. (ex: 1990)"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
              <View className="flex-1">
                <Input
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="Peso (kg)"
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Input
                  value={height}
                  onChangeText={setHeight}
                  placeholder="Altura (cm)"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </Section>

          <Section title="Objetivo">
            <SegmentedControl
              options={GOAL_OPTIONS}
              value={goalType ?? ''}
              onChange={(v) => setGoalType(v as GoalType)}
            />
            <Input
              value={goalWeight}
              onChangeText={setGoalWeight}
              placeholder="Meta de peso (kg) — opcional"
              keyboardType="decimal-pad"
              leftIcon={<Target size={16} color={colors.textMuted} />}
            />
          </Section>

          <Section title="Treino">
            <Label>Modalidades (múltipla escolha)</Label>
            <View className="flex-row flex-wrap gap-2">
              {SPORTS.map((s) => {
                const selected = sports.includes(s.value);
                return (
                  <Pressable
                    key={s.value}
                    onPress={() => toggleSport(s.value)}
                    className={`rounded-full border px-3 py-1.5 ${
                      selected
                        ? 'border-accent/60 bg-accent/15'
                        : 'border-border bg-surface-muted'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        selected ? 'text-accent' : 'text-text-dim'
                      }`}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Label>Frequência semanal</Label>
            <SegmentedControl
              options={FREQ_OPTIONS}
              value={frequency ?? ''}
              onChange={(v) => setFrequency(v as WeeklyFrequency)}
            />
          </Section>

          <Section title="Saúde (opcional)">
            <Input
              value={allergies}
              onChangeText={setAllergies}
              placeholder="Alergias (ex: lactose, glúten...)"
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
            <Input
              value={limitations}
              onChangeText={setLimitations}
              placeholder="Limitações físicas (ex: dor no joelho)"
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
            <Input
              value={bio}
              onChangeText={setBio}
              placeholder="Bio / contexto (rotina, sono, trabalho)"
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </Section>

          <Button
            label="Cadastrar e gerar plano com IA"
            onPress={handleCreateAndGenerate}
            disabled={!canSubmitForm}
            size="lg"
            icon={<Sparkles size={18} color={colors.textInverse} />}
          />

          <Text className="text-text-muted text-[11px] text-center leading-relaxed px-2">
            A IA vai gerar metas (kcal, proteína, água) e ~3-5 treinos
            baseados na ficha. Você poderá revisar antes de salvar.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="md">
      <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
        {title}
      </Text>
      <View className="gap-2.5">{children}</View>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-text-muted text-[11px] uppercase tracking-wider mb-1">
      {children}
    </Text>
  );
}

function GeneratingScreen() {
  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8 gap-6">
        <Card glow accent="violet" padding="lg">
          <View className="items-center gap-4">
            <View className="h-14 w-14 rounded-2xl bg-violet/15 border border-violet/40 items-center justify-center">
              <Sparkles size={24} color={colors.violetSoft} />
            </View>
            <Text className="text-text text-lg font-bold text-center">
              Gerando o plano com IA
            </Text>
            <Text className="text-text-dim text-sm text-center">
              Cadastrando o aluno e montando metas + treinos sob medida.
            </Text>
            <ActivityIndicator color={colors.violetSoft} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function SavingScreen() {
  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8 gap-6">
        <Card padding="lg">
          <View className="items-center gap-4">
            <ActivityIndicator color={colors.accent} />
            <Text className="text-text text-base font-semibold">
              Salvando o plano...
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function PreviewScreen({
  plan,
  studentName,
  onSave,
  onRegenerate,
  saving,
}: {
  plan: OnboardingPlan;
  studentName: string;
  onSave: () => void;
  onRegenerate: () => void;
  saving: boolean;
}) {
  return (
    <Screen variant="hero" edges={['top']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center">
          <View className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center mb-2">
            <Sparkles size={22} color={colors.accent} />
          </View>
          <Text className="text-text text-xl font-bold text-center">
            Plano de {studentName}
          </Text>
          {plan.rationale && (
            <View className="mt-3 px-2">
              <MarkdownText
                value={plan.rationale}
                textColor={colors.textDim}
                fontSize={13}
              />
            </View>
          )}
        </View>

        <Card glow accent="green" padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Metas diárias
          </Text>
          <View className="gap-2">
            <GoalRow label="Calorias" value={`${plan.calorie_goal} kcal`} />
            <GoalRow label="Proteína" value={`${plan.protein_goal_g} g`} />
            <GoalRow label="Água" value={`${plan.water_goal_ml} ml`} />
          </View>
        </Card>

        {plan.routines.length > 0 && (
          <View className="gap-2">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest px-1">
              {plan.routines.length} treinos sugeridos
            </Text>
            {plan.routines.map((r, i) => (
              <Card key={i} padding="md">
                <Text className="text-text text-sm font-semibold">
                  {r.name}
                </Text>
                {r.description && (
                  <Text className="text-text-muted text-[11px] mt-0.5">
                    {r.description}
                  </Text>
                )}
                <View className="gap-1 mt-2">
                  {r.exercises.slice(0, 6).map((ex, j) => (
                    <Text
                      key={j}
                      className="text-text-dim text-[12px]"
                      numberOfLines={1}
                    >
                      • {ex.exercise_name} — {ex.sets}×{ex.reps_min}-
                      {ex.reps_max}
                    </Text>
                  ))}
                  {r.exercises.length > 6 && (
                    <Text className="text-text-muted text-[11px]">
                      + {r.exercises.length - 6} outros
                    </Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        <Card padding="sm">
          <Text className="text-text-muted text-[11px] leading-relaxed">
            💡 Você pode editar metas e treinos depois pelo perfil do aluno
            (em construção). Por enquanto, salve esse plano gerado.
          </Text>
        </Card>

        <Button
          label="Salvar e enviar pro aluno"
          onPress={onSave}
          loading={saving}
          size="lg"
          icon={<Send size={18} color={colors.textInverse} />}
        />
        <Button
          label="Gerar outro plano"
          onPress={onRegenerate}
          variant="ghost"
          icon={<RefreshCcw size={16} color={colors.textDim} />}
        />
      </ScrollView>
    </Screen>
  );
}

function GoalRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-text-dim text-sm">{label}</Text>
      <Text className="text-text text-base font-bold">{value}</Text>
    </View>
  );
}
