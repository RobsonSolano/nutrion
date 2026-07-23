import { ScrollView, Text, View } from 'react-native';
import { Ban } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { Button, Logo, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

/**
 * Bloqueio total do aluno suspenso. Exibido pelo (tabs)/_layout quando
 * check_and_sync_my_suspension retorna true. Sem acesso a treino/histórico:
 * o professor precisa reativar (ou fazer upgrade). Única saída é sair.
 */
export default function SuspendedScreen() {
  const { logout } = useAuth();

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-8">
          <Logo size="lg" />
        </View>

        <View className="items-center mb-6">
          <View className="h-16 w-16 rounded-3xl bg-warn/10 border border-warn/40 items-center justify-center mb-5">
            <Ban size={30} color={colors.warn} />
          </View>
          <Text className="text-text text-xl font-bold text-center mb-2">
            Acesso suspenso
          </Text>
          <Text className="text-text-dim text-sm text-center leading-relaxed">
            Seu professor atingiu o limite de alunos do plano dele. Seu treino e
            seus dados estão guardados — nada foi perdido.
          </Text>
          <Text className="text-text-dim text-sm text-center leading-relaxed mt-3">
            Entre em contato com seu personal/professor pra liberar seu acesso.
          </Text>
        </View>

        <Button label="Sair" onPress={() => void logout()} variant="secondary" size="lg" />
      </ScrollView>
    </Screen>
  );
}
