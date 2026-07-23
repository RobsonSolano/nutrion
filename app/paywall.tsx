import { useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Crown, X } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import Screen from '@/components/ui/Screen';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { colors } from '@/lib/theme';
import { paywallContent } from '@/lib/paywallContent';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useOfferings } from '@/hooks/useOfferings';
import { useAlert } from '@/components/GlobalAlertProvider';
import {
  selectProductId,
  findPackage,
  type Role,
} from '@/lib/purchaseSelection';
import {
  purchasePackage,
  restore,
  isUserCancelledError,
  isBillingAvailable,
} from '@/services/billing';
import { pollUntil } from '@/lib/pollUntil';
import { fetchEntitlement } from '@/services/entitlement';
import { syncMyCoachAccess } from '@/services/suspension';
import { queryKeys } from '@/lib/queryKeys';
import type { FeatureKey } from '@/types/billing';

/**
 * Paywall contextual (spec #2). Recebe ?feature= do 402 needs_upgrade e apresenta o upsell.
 * Compra real (#5b): CTA → seleciona o produto por role/feature/tier, compra via RevenueCat, e
 * re-busca o entitlement (resolve_entitlement é a verdade; o webhook #5a é async → poll). Aluno
 * não compra: IA herdada do professor (C4).
 */
export default function PaywallScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const { data: entitlement } = useEntitlement();
  const { data: offerings } = useOfferings();
  const alert = useAlert();

  const [busy, setBusy] = useState(false);

  const content = paywallContent(feature);
  const isAluno = profile?.role === 'aluno';

  /** Re-busca o entitlement até refletir a compra (webhook async) e atualiza o cache. */
  async function refreshEntitlement(): Promise<boolean> {
    const { satisfied } = await pollUntil({
      fn: fetchEntitlement,
      done: (e) => e.tier !== 'free',
    });
    if (user?.id) {
      // Professor: reconcilia acesso dos alunos (reativa suspensos ao subir de
      // plano). No-op p/ não-professor; idempotente com o sync do webhook. Sem
      // isso, a lista de alunos fica com `suspended_at` velho no cache e o
      // banner "N suspensos" persiste mesmo já tendo virado Pro.
      try {
        await syncMyCoachAccess(user.id);
      } catch {
        // best-effort: o webhook também reconcilia server-side
      }
      await qc.invalidateQueries({ queryKey: queryKeys.entitlement(user.id) });
      await qc.invalidateQueries({ queryKey: ['students', user.id] });
    }
    return satisfied;
  }

  async function handleSubscribe() {
    if (!isBillingAvailable) {
      alert.showAlert({
        type: 'info',
        title: 'Indisponível agora',
        message:
          'A assinatura fica disponível no app instalado da loja. Em breve por aqui.',
      });
      return;
    }
    const productId = selectProductId({
      role: profile?.role as Role | undefined,
      feature: feature as FeatureKey | undefined,
      currentTier: entitlement?.tier ?? 'free',
    });
    if (!productId) {
      alert.showAlert({
        type: 'info',
        title: 'Tudo certo',
        message: 'Seu plano atual já cobre esse recurso.',
      });
      return;
    }
    const pkg = findPackage(offerings, productId);
    if (!pkg) {
      alert.showAlert({
        type: 'warning',
        title: 'Planos indisponíveis',
        message: 'Não consegui carregar os planos agora. Tente de novo em instantes.',
      });
      return;
    }

    setBusy(true);
    try {
      await purchasePackage(pkg);
      const liberado = await refreshEntitlement();
      if (liberado) {
        alert.showAlert({
          type: 'success',
          title: 'Assinatura ativa!',
          message: 'Seus recursos foram liberados. Aproveite 💪',
        });
      } else {
        alert.showAlert({
          type: 'info',
          title: 'Compra recebida',
          message:
            'Estamos liberando seu acesso — pode levar alguns instantes. Se demorar, toque em "Restaurar compras".',
        });
      }
      router.back();
    } catch (err) {
      if (isUserCancelledError(err)) return; // usuário cancelou — sem erro técnico
      alert.showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!isBillingAvailable) return;
    setBusy(true);
    try {
      await restore();
      const liberado = await refreshEntitlement();
      if (liberado) {
        alert.showAlert({
          type: 'success',
          title: 'Assinatura restaurada!',
          message: 'Seus recursos foram liberados novamente.',
        });
        router.back();
      } else {
        alert.showAlert({
          type: 'info',
          title: 'Nada pra restaurar',
          message: 'Não encontramos uma assinatura ativa nesta conta.',
        });
      }
    } catch (err) {
      if (isUserCancelledError(err)) return;
      alert.showError(err);
    } finally {
      setBusy(false);
    }
  }

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
                loading={busy}
                disabled={busy}
                onPress={handleSubscribe}
              />
              <Button
                label="Já assinei · Restaurar compras"
                variant="ghost"
                size="md"
                fullWidth
                disabled={busy}
                onPress={handleRestore}
              />
              <Button
                label="Agora não"
                variant="ghost"
                size="md"
                fullWidth
                disabled={busy}
                onPress={() => router.back()}
              />
            </View>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}
