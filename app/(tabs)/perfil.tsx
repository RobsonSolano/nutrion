import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  LogOut,
  Pencil,
  User as UserIcon,
  Target,
  Activity,
  Ruler,
  Droplet,
  Sparkles,
  Crown,
  Gift,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useResetOnboarding } from '@/hooks/useOnboarding';
import { useDailyOnboardingUsage } from '@/hooks/useAiUsage';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { Button, Card, Screen } from '@/components/ui';
import Disclaimer from '@/components/Disclaimer';
import { colors } from '@/lib/theme';
import { bmi, bmiCategory } from '@/lib/biometrics';

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const profileQ = useProfile();
  const profile = profileQ.data;
  const resetOnboardingM = useResetOnboarding();
  const resetOnboardingStore = useOnboardingStore((s) => s.reset);
  const onboardingUsage = useDailyOnboardingUsage();

  // Refazer só conta cota se o user já completou ao menos uma vez.
  const refazerBlocked =
    !!profile?.onboarding_completed_at && onboardingUsage.limitReached;
  const isEarlyAdopter = profile?.is_early_adopter === true;

  async function handleRedoOnboarding() {
    if (refazerBlocked) {
      Alert.alert(
        'Limite diário',
        'Você já refez seu plano hoje. Tenta de novo amanhã.',
      );
      return;
    }
    try {
      resetOnboardingStore();
      await resetOnboardingM.mutateAsync();
      router.push('/onboarding' as Href);
    } catch (err) {
      Alert.alert(
        'Ops',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  const displayName =
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    'Atleta NutriOn';

  const initial = displayName.charAt(0).toUpperCase();

  function handleLogout() {
    Alert.alert('Sair da conta', 'Tem certeza que quer sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  }

  const formatKg = (v: number | null | undefined) =>
    v == null ? '—' : `${v.toLocaleString('pt-BR')} kg`;
  const formatCm = (v: number | null | undefined) =>
    v == null ? '—' : `${v.toLocaleString('pt-BR')} cm`;

  const imcValue =
    profile?.weight_kg && profile?.height_cm
      ? bmi(profile.weight_kg, profile.height_cm)
      : null;
  const imcCat = imcValue != null ? bmiCategory(imcValue) : null;

  return (
    <Screen variant="violet">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 140 }}>
        <View className="items-center mt-4 mb-2">
          <View
            className="h-24 w-24 rounded-full bg-surface-raised border border-border-strong items-center justify-center"
            style={{
              shadowColor: colors.violet,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <Text className="text-accent text-3xl font-bold">{initial}</Text>
          </View>
          <Text className="text-text text-xl font-bold mt-4">{displayName}</Text>
          {user?.email && (
            <Text className="text-text-dim text-sm mt-1">{user.email}</Text>
          )}
          {isEarlyAdopter && (
            <View
              className="mt-3 flex-row items-center gap-1.5 rounded-full border px-3 py-1"
              style={{
                borderColor: `${colors.accent}55`,
                backgroundColor: `${colors.accent}15`,
              }}
            >
              <Crown size={12} color={colors.accent} />
              <Text className="text-accent text-[11px] font-bold tracking-wide">
                Founding User #{profile?.user_number}
              </Text>
            </View>
          )}
        </View>

        <Card glow accent="violet" padding="md">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 rounded-xl bg-violet/15 border border-violet/40 items-center justify-center">
              <Gift size={18} color={colors.violetSoft} />
            </View>
            <View className="flex-1">
              <Text className="text-text font-semibold">
                Recursos de IA gratuitos
              </Text>
              <Text className="text-text-dim text-xs mt-1 leading-relaxed">
                Chat (10/dia · 255 chars), Sanity Check (5/dia) e onboarding
                inteligente são <Text className="text-violet-soft font-semibold">temporariamente gratuitos</Text>.
                {isEarlyAdopter
                  ? ' Como early adopter, você continua com acesso quando virarem premium.'
                  : ' Aproveita enquanto está aberto.'}
              </Text>
            </View>
          </View>
        </Card>

        <Button
          label="Editar perfil"
          onPress={() => router.push('/editar-perfil' as Href)}
          variant="secondary"
          size="md"
          icon={<Pencil size={16} color={colors.text} />}
        />

        <Card>
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-4">
            Medidas
          </Text>
          <View className="gap-4">
            <MetricRow
              icon={<Ruler size={16} color={colors.textDim} />}
              label="Peso atual"
              value={formatKg(profile?.weight_kg)}
            />
            <MetricRow
              icon={<Ruler size={16} color={colors.textDim} />}
              label="Altura"
              value={formatCm(profile?.height_cm)}
            />
            <MetricRow
              icon={<Target size={16} color={colors.violetSoft} />}
              label="Meta de peso"
              value={formatKg(profile?.goal_weight_kg)}
            />
          </View>
        </Card>

        {imcValue && imcCat && (
          <Card>
            <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
              Índice de massa corporal
            </Text>
            <View className="flex-row items-end gap-3">
              <Text className="text-text text-4xl font-bold">
                {imcValue.toFixed(1)}
              </Text>
              <View
                className="rounded-full px-3 py-1 border mb-1.5"
                style={{
                  backgroundColor: `${imcCat.color}15`,
                  borderColor: `${imcCat.color}60`,
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: imcCat.color }}
                >
                  {imcCat.label}
                </Text>
              </View>
            </View>
            <Text className="text-text-muted text-xs mt-3 leading-relaxed">
              {imcCat.description}
            </Text>
          </Card>
        )}

        <Card glow accent="green">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-4">
            Metas diárias
          </Text>
          <View className="gap-4">
            <MetricRow
              icon={<Activity size={16} color={colors.accent} />}
              label="Calorias"
              value={`${(profile?.daily_calorie_goal ?? 2500).toLocaleString('pt-BR')} kcal`}
            />
            <MetricRow
              icon={<Target size={16} color={colors.violetSoft} />}
              label="Proteína"
              value={`${profile?.protein_goal_g ?? 180} g`}
            />
            <MetricRow
              icon={<Droplet size={16} color={colors.info} />}
              label="Hidratação"
              value={`${((profile?.water_goal_ml ?? 4000) / 1000).toLocaleString('pt-BR')} L`}
            />
          </View>
        </Card>

        <Card padding="md">
          <View className="flex-row items-start gap-3">
            <View className="h-9 w-9 rounded-xl bg-accent/10 border border-accent/30 items-center justify-center">
              <UserIcon size={16} color={colors.accent} />
            </View>
            <View className="flex-1">
              <Text className="text-text font-semibold">Conta conectada</Text>
              <Text className="text-text-dim text-xs mt-1">
                Sessão ativa. Dados protegidos por Row Level Security.
              </Text>
            </View>
          </View>
        </Card>

        <Button
          label={
            !profile?.onboarding_completed_at
              ? 'Completar onboarding com IA'
              : refazerBlocked
                ? 'Refazer disponível amanhã'
                : 'Gerar novo plano com IA'
          }
          onPress={handleRedoOnboarding}
          loading={resetOnboardingM.isPending}
          disabled={refazerBlocked}
          variant="secondary"
          size="md"
          icon={<Sparkles size={16} color={colors.accent} />}
        />

        <Button
          label="Sair da conta"
          onPress={handleLogout}
          variant="danger"
          size="md"
          icon={<LogOut size={16} color={colors.danger} />}
        />

        <Disclaimer />
      </ScrollView>
    </Screen>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        {icon}
        <Text className="text-text text-sm">{label}</Text>
      </View>
      <Text className="text-text-dim text-sm font-semibold">{value}</Text>
    </View>
  );
}
