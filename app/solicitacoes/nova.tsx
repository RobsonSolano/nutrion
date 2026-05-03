import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Button, Card, Input, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useCreateRequest } from '@/hooks/useRequests';

const MAX = 500;

export default function NovaSolicitacaoScreen() {
  const router = useRouter();
  const kbHeight = useKeyboardHeight();
  const [message, setMessage] = useState('');
  const createMutation = useCreateRequest();

  async function handleSubmit() {
    if (message.trim().length === 0) {
      Alert.alert('Mensagem vazia', 'Escreve sua solicitação antes de enviar.');
      return;
    }
    try {
      await createMutation.mutateAsync(message.trim());
      router.back();
    } catch (err) {
      Alert.alert(
        'Não consegui enviar',
        err instanceof Error ? err.message : 'Tenta de novo.',
      );
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold text-base flex-1">
            Nova solicitação
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32 + (Platform.OS === 'android' ? kbHeight : 0),
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Card padding="md">
            <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
              Pra seu professor
            </Text>
            <Text className="text-text-muted text-xs leading-relaxed mb-3">
              Escreva o que precisa: trocar exercício, ajustar reps, relatar
              dor, alergia, dúvida sobre alimentação. Texto livre.
            </Text>
            <Input
              value={message}
              onChangeText={(v) => v.length <= MAX && setMessage(v)}
              placeholder="Ex: Senti dor no joelho no agachamento. Posso trocar por leg press?"
              multiline
              numberOfLines={6}
              style={{ minHeight: 160, textAlignVertical: 'top' }}
            />
            <Text className="text-text-muted text-[11px] text-right mt-2">
              {message.length}/{MAX}
            </Text>
          </Card>

          <Button
            label="Enviar solicitação"
            onPress={handleSubmit}
            loading={createMutation.isPending}
            disabled={message.trim().length === 0}
            icon={<Send size={18} color={colors.textInverse} />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
