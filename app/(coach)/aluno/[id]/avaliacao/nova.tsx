import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Card, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function NovaAvaliacaoPlaceholder() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Screen variant="hero" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Nova avaliação</Text>
          <View style={{ width: 40 }} />
        </View>
        <View className="flex-1 p-5">
          <Card padding="md">
            <Text className="text-text font-semibold mb-2">Em construção</Text>
            <Text className="text-text-muted text-xs leading-relaxed">
              Formulário de cadastro vai entrar nesta tela na próxima fase.
            </Text>
          </Card>
        </View>
      </Screen>
    </>
  );
}
