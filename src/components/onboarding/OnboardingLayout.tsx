import { ReactNode, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Button, Screen } from '@/components/ui';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { colors } from '@/lib/theme';
import ProgressBar from './ProgressBar';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue?: () => void;
  onSkip?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  children: ReactNode;
};

export default function OnboardingLayout({
  step,
  total,
  title,
  subtitle,
  onBack,
  onContinue,
  onSkip,
  continueLabel = 'Continuar',
  continueDisabled = false,
  loading = false,
  children,
}: Props) {
  const kbHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);

  // Quando o teclado abre (Android não faz scroll automático), rolar pro fim
  // pra garantir que o input focado fique acima do teclado. Forms do onboarding
  // são curtos (3-5 campos) e o fluxo de preenchimento é top-down, então
  // scrollToEnd é a heurística certa.
  useEffect(() => {
    if (kbHeight > 0) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [kbHeight]);

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <View className="flex-row items-center gap-3 px-5 py-3">
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <ChevronLeft size={18} color={colors.textDim} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <View className="flex-1">
            <ProgressBar total={total} current={step} />
          </View>
          {onSkip ? (
            <Pressable onPress={onSkip} hitSlop={12}>
              <Text className="text-text-muted text-xs font-semibold">
                Pular
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom:
              32 + (Platform.OS === 'android' && kbHeight > 0 ? kbHeight : 0),
            gap: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text className="text-text text-[11px] uppercase tracking-[3px]">
              Passo {step} de {total}
            </Text>
            <Text className="text-text text-2xl font-bold mt-2">{title}</Text>
            {subtitle && (
              <Text className="text-text-dim text-sm mt-2 leading-relaxed">
                {subtitle}
              </Text>
            )}
          </View>

          <View className="gap-4">{children}</View>
        </ScrollView>

        {onContinue && (
          <View className="px-5 pb-5 pt-2">
            <Button
              label={continueLabel}
              onPress={onContinue}
              disabled={continueDisabled}
              loading={loading}
              size="lg"
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
