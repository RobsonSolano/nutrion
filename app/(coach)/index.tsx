import { ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  GraduationCap,
  Plus,
  Users,
  LogOut,
  ChevronRight,
  Target,
  MessagesSquare,
} from 'lucide-react-native';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStudents } from '@/hooks/useStudents';
import { useCoachRequests } from '@/hooks/useRequests';
import type { StudentLite } from '@/services/students';

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Emagrecer',
  maintain: 'Manter',
  gain_muscle: 'Ganhar massa',
  reduce_body_fat: 'Reduzir gordura',
};

export default function CoachHome() {
  const router = useRouter();
  const { logout } = useAuth();
  const profileQ = useProfile();
  const studentsQ = useStudents();
  const openRequestsQ = useCoachRequests('open');
  const fullName = profileQ.data?.full_name ?? 'Professor';
  const openRequestsCount = openRequestsQ.data?.length ?? 0;

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
            <GraduationCap size={22} color={colors.violetSoft} />
          </View>
          <View className="flex-1">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest">
              Olá, professor
            </Text>
            <Text className="text-text text-xl font-bold">{fullName}</Text>
          </View>
        </View>

        <Card padding="md">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Users size={14} color={colors.violetSoft} />
              <Text className="text-text-dim text-[11px] uppercase tracking-widest">
                Meus alunos ({studentsQ.data?.length ?? 0})
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(coach)/aluno-novo' as Href)}
              hitSlop={8}
              className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 active:opacity-70"
            >
              <View className="flex-row items-center gap-1.5">
                <Plus size={12} color={colors.accent} />
                <Text className="text-accent text-[11px] font-semibold">
                  Cadastrar
                </Text>
              </View>
            </Pressable>
          </View>

          {studentsQ.isLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator color={colors.violetSoft} />
            </View>
          ) : studentsQ.error ? (
            <Text className="text-danger text-xs py-3">
              Não consegui carregar a lista. Tenta de novo.
            </Text>
          ) : studentsQ.data && studentsQ.data.length > 0 ? (
            <View className="gap-2 mt-2">
              {studentsQ.data.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onPress={() =>
                    router.push(`/(coach)/aluno/${s.id}` as Href)
                  }
                />
              ))}
            </View>
          ) : (
            <View className="py-6 items-center gap-2">
              <Text className="text-text-muted text-xs text-center px-4 leading-relaxed">
                Você ainda não cadastrou nenhum aluno. Toque em "Cadastrar"
                pra criar o primeiro.
              </Text>
            </View>
          )}
        </Card>

        <Pressable
          onPress={() => router.push('/(coach)/solicitacoes' as Href)}
          className="active:opacity-80"
        >
          <Card padding="md">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
                <MessagesSquare size={20} color={colors.violetSoft} />
              </View>
              <View className="flex-1">
                <Text className="text-text text-sm font-semibold">
                  Solicitações
                </Text>
                <Text className="text-text-muted text-[11px] mt-0.5">
                  {openRequestsCount > 0
                    ? `${openRequestsCount} aberta${openRequestsCount > 1 ? 's' : ''} aguardando você`
                    : 'Nenhuma solicitação aberta'}
                </Text>
              </View>
              {openRequestsCount > 0 && (
                <View className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5">
                  <Text className="text-warn text-[11px] font-bold">
                    {openRequestsCount}
                  </Text>
                </View>
              )}
              <ChevronRight size={16} color={colors.textDim} />
            </View>
          </Card>
        </Pressable>

        <Button
          label="Sair"
          onPress={() => void logout()}
          variant="ghost"
          icon={<LogOut size={16} color={colors.textDim} />}
        />
      </ScrollView>
    </Screen>
  );
}

function StudentRow({
  student,
  onPress,
}: {
  student: StudentLite;
  onPress: () => void;
}) {
  const initial = (student.full_name ?? '?').slice(0, 1).toUpperCase();
  const goalLabel = student.goal_type ? GOAL_LABEL[student.goal_type] : null;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface-muted px-3 py-3 active:opacity-70"
    >
      <View className="h-10 w-10 rounded-xl bg-violet/15 border border-violet/40 items-center justify-center">
        <Text className="text-violet-soft text-base font-bold">{initial}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-text text-sm font-semibold" numberOfLines={1}>
          {student.full_name ?? 'Sem nome'}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          {goalLabel && (
            <View className="flex-row items-center gap-1">
              <Target size={10} color={colors.textMuted} />
              <Text className="text-text-muted text-[11px]">{goalLabel}</Text>
            </View>
          )}
          {student.weight_kg != null && (
            <Text className="text-text-muted text-[11px]">
              {student.weight_kg}kg
            </Text>
          )}
        </View>
      </View>
      <ChevronRight size={16} color={colors.textDim} />
    </Pressable>
  );
}
