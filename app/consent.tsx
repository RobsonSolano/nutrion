import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/components/GlobalAlertProvider';
import { recordLegalAcceptance } from '@/services/legal';
import TermsAcceptance from '@/components/TermsAcceptance';
import HealthDataConsent from '@/components/HealthDataConsent';
import { Button, Logo, Screen } from '@/components/ui';

/**
 * Gate de aceite pós-login: mostrado quando o usuário autenticado ainda não
 * aceitou os documentos obrigatórios (cobre conta nova via Google que entrou
 * sem passar pelos consentimentos do cadastro). Aceitar → grava e segue; ou sair.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const alert = useAlert();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    try {
      await recordLegalAcceptance();
      await qc.invalidateQueries({
        queryKey: ['legal-acceptance', user?.id ?? 'none'],
      });
      router.replace('/(tabs)' as Href);
    } catch (err) {
      alert.showError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center mb-8">
          <Logo size="lg" />
          <Text className="text-text-dim text-[11px] tracking-[3px] uppercase mt-2">
            Antes de continuar
          </Text>
        </View>

        <Text className="text-text text-lg font-bold mb-1">Aceite dos termos</Text>
        <Text className="text-text-dim text-xs mb-6 leading-relaxed">
          Pra usar o Persona Fit, precisamos do seu aceite. Leva 10 segundos.
        </Text>

        <View className="gap-3 mb-7">
          <TermsAcceptance accepted={acceptedTerms} onChange={setAcceptedTerms} />
          <HealthDataConsent accepted={healthConsent} onChange={setHealthConsent} />
        </View>

        <View className="gap-2">
          <Button
            label="Aceitar e continuar"
            onPress={handleAccept}
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!acceptedTerms || !healthConsent}
          />
          <Button label="Sair" onPress={() => void logout()} variant="ghost" size="md" />
        </View>
      </ScrollView>
    </Screen>
  );
}
