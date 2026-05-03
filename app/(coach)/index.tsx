import { ScrollView, Text, View } from 'react-native';
import { GraduationCap, Users, MessagesSquare, LogOut } from 'lucide-react-native';
import { Button, Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

export default function CoachHome() {
  const { logout } = useAuth();
  const profileQ = useProfile();
  const fullName = profileQ.data?.full_name ?? 'Professor';

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
          gap: 18,
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

        <Card glow accent="violet" padding="lg">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
            Área do Professor
          </Text>
          <Text className="text-text text-lg font-bold mb-2">
            Em construção
          </Text>
          <Text className="text-text-dim text-sm leading-relaxed">
            Sua conta de professor está pronta. Em breve você poderá cadastrar
            alunos, montar treinos com a IA e acompanhar o progresso de cada
            um.
          </Text>
        </Card>

        <Card padding="md">
          <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
            Próximas funcionalidades
          </Text>
          <View className="gap-3">
            <PreviewRow
              icon={<Users size={16} color={colors.violetSoft} />}
              label="Cadastro de alunos"
              hint="Crie acessos com email e senha pros seus alunos"
            />
            <PreviewRow
              icon={<MessagesSquare size={16} color={colors.violetSoft} />}
              label="Solicitações"
              hint="Atenda pedidos dos alunos sobre treinos, alergias, etc."
            />
            <PreviewRow
              icon={<GraduationCap size={16} color={colors.violetSoft} />}
              label="Acompanhamento"
              hint="Aderência semanal, últimos logs, ajustes finos"
            />
          </View>
        </Card>

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

function PreviewRow({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View className="h-8 w-8 rounded-xl bg-violet/10 border border-violet/30 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-text text-sm font-semibold">{label}</Text>
        <Text className="text-text-muted text-[11px] mt-0.5 leading-relaxed">
          {hint}
        </Text>
      </View>
    </View>
  );
}
