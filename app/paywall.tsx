import { ScrollView, Text, View, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown, X } from 'lucide-react-native';

import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { colors } from '@/lib/theme';
import { paywallContent } from '@/lib/paywallContent';
import { useProfile } from '@/hooks/useProfile';
import { useAlert } from '@/components/GlobalAlertProvider';

/**
 * Paywall contextual (spec #2 paywall-ui). Recebe ?feature= do 402 needs_upgrade e
 * apresenta o upsell. Compra real é a spec #5 → CTA "em breve". Aluno não compra:
 * IA é herdada do plano do professor (C4).
 */
export default function PaywallScreen() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { data: profile } = useProfile();
  const alert = useAlert();

  const content = paywallContent(feature);
  const isAluno = profile?.role === 'aluno';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Screen variant="violet" edges={['top']}>
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <X size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Persona Fit Pro</Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center gap-3 pt-2">
            <View className="h-16 w-16 rounded-3xl bg-violet/20 border border-violet items-center justify-center">
              <Crown size={30} color={colors.violetSoft} />
            </View>
            <Text className="text-text text-2xl font-bold text-center">
              {content.title}
            </Text>
            <Text className="text-text-dim text-base text-center">
              {content.subtitle}
            </Text>
          </View>

          <Card accent="violet" glow padding="lg">
            <View className="gap-3.5">
              {content.bullets.map((b) => (
                <View key={b} className="flex-row items-start gap-3">
                  <View className="mt-0.5 h-5 w-5 rounded-full bg-violet/20 items-center justify-center">
                    <Check size={13} color={colors.violetSoft} />
                  </View>
                  <Text className="text-text flex-1 text-[15px] leading-5">{b}</Text>
                </View>
              ))}
            </View>
          </Card>

          {isAluno ? (
            <Card padding="lg">
              <Text className="text-text text-base font-semibold mb-1">
                Acesso pelo seu professor
              </Text>
              <Text className="text-text-dim text-[15px] leading-5">
                Seu acesso à IA depende do plano do seu professor. Fale com ele(a)
                pra liberar esses recursos no seu acompanhamento.
              </Text>
            </Card>
          ) : (
            <View className="gap-3">
              <View className="items-center">
                <Text className="text-text-dim text-sm">{content.planLabel}</Text>
                <Text className="text-text text-lg font-bold">
                  {content.priceHint}
                </Text>
              </View>
              <Button
                label="Quero assinar"
                variant="primary"
                size="lg"
                fullWidth
                onPress={() =>
                  alert.showAlert({
                    type: 'info',
                    title: 'Em breve',
                    message:
                      'A assinatura está a caminho. Avisaremos assim que abrir pra você desbloquear esses recursos.',
                  })
                }
              />
              <Button
                label="Agora não"
                variant="ghost"
                size="md"
                fullWidth
                onPress={() => router.back()}
              />
            </View>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}
