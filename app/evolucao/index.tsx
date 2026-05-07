import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Card, Screen } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import ProgressTimeline from '@/components/ProgressTimeline';
import { colors } from '@/lib/theme';

export default function MinhaEvolucaoScreen() {
  const router = useRouter();
  const { user } = useAuth();

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
          <Text className="text-text font-semibold">Minha evolução</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            gap: 14,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card padding="md">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-2">
              Linha do tempo
            </Text>
            <Text className="text-text-muted text-xs leading-relaxed">
              Registre suas conquistas, mudanças de hábito e marcos. Você vê
              tudo aqui em ordem (mais recente no topo). Se tem professor
              vinculado, ele também enxerga.
            </Text>
          </Card>

          {user?.id && <ProgressTimeline userId={user.id} canEdit />}
        </ScrollView>
      </Screen>
    </>
  );
}
