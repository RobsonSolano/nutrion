import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, Sparkles, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { useProfile } from '@/hooks/useProfile';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { Screen } from '@/components/ui';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import { colors } from '@/lib/theme';

const SUGGESTIONS = [
  'Como estou em relação à minha meta de hoje?',
  'Sugira um pós-treino de 40g de proteína',
  'O que posso melhorar na semana?',
  'Analise meu dia',
];

export default function ChatScreen() {
  const {
    messages,
    isSending,
    isLoading,
    sendMessage,
    dailyCount,
    dailyLimit,
    remaining,
    limitReached,
    maxChars,
  } = useChat();
  const profileQ = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const kbHeight = useKeyboardHeight();
  const isKeyboardOpen = kbHeight > 0;

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const firstName = profileQ.data?.full_name?.split(' ')[0] ?? '';

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isSending || limitReached) return;
    setText('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(trimmed);
  }, [text, isSending, limitReached, sendMessage]);

  const handleSuggestion = useCallback(
    (s: string) => {
      if (limitReached) return;
      void Haptics.selectionAsync();
      sendMessage(s.slice(0, maxChars));
    },
    [sendMessage, limitReached, maxChars],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatBubble message={item} />,
    [],
  );

  const isEmpty = !isLoading && messages.length === 0;

  const charsLeft = maxChars - text.length;
  const charsWarn = charsLeft <= 30;
  const charsCrit = charsLeft <= 10;

  const cotaColor = limitReached
    ? colors.danger
    : remaining <= 3
      ? colors.warn
      : colors.violetSoft;

  return (
    <Screen variant="violet" edges={['top']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-border-subtle">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="h-10 w-10 rounded-2xl bg-violet/20 border border-violet/40 items-center justify-center">
              <Sparkles size={18} color={colors.violetSoft} />
            </View>
            <View className="flex-1">
              <Text className="text-text text-base font-bold">Nutri IA</Text>
              <Text className="text-text-dim text-[11px]" numberOfLines={1}>
                consciente do seu perfil e metas
              </Text>
            </View>
          </View>
          <View
            className="rounded-full border px-2.5 py-1"
            style={{
              borderColor: `${cotaColor}55`,
              backgroundColor: `${cotaColor}15`,
            }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: cotaColor }}
            >
              {dailyCount}/{dailyLimit} hoje
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.violetSoft} />
          </View>
        ) : isEmpty ? (
          <View className="flex-1 px-5 justify-center">
            <View className="items-center mb-6">
              <View className="h-16 w-16 rounded-full bg-violet/15 border border-violet/40 items-center justify-center mb-4">
                <MessageCircle size={26} color={colors.violetSoft} />
              </View>
              <Text className="text-text text-2xl font-bold text-center">
                Oi{firstName ? `, ${firstName}` : ''} 👋
              </Text>
              <Text className="text-text-dim text-sm text-center mt-2 leading-relaxed">
                Sou seu nutricionista virtual. Eu leio seu perfil, metas e o que
                você registrou hoje antes de responder.
              </Text>
              <Text className="text-text-muted text-[11px] text-center mt-3 px-4 leading-relaxed">
                Você tem {dailyLimit} mensagens por dia · até {maxChars}{' '}
                caracteres cada · histórico fica salvo
              </Text>
            </View>
            <Text className="text-text-muted text-[10px] uppercase tracking-widest mb-2 px-1">
              Sugestões
            </Text>
            <View className="gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSuggestion(s)}
                  disabled={limitReached}
                  className={`rounded-2xl border border-border bg-surface px-4 py-3 ${
                    limitReached ? 'opacity-50' : 'active:opacity-70'
                  }`}
                >
                  <Text className="text-text-dim text-sm">{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
            }}
            ListHeaderComponent={isSending ? <TypingIndicator /> : null}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          />
        )}

        <View
          className="px-4 pt-2 border-t border-border-subtle bg-bg-deep"
          style={{ paddingBottom: isKeyboardOpen ? 8 : tabBarHeight + 8 }}
        >
          {limitReached ? (
            <View className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 mb-2">
              <Text className="text-warn text-[13px] font-semibold mb-1">
                Limite diário atingido
              </Text>
              <Text className="text-text-dim text-[12px] leading-relaxed">
                Você usou as {dailyLimit} mensagens de hoje. O contador zera
                amanhã. Seu histórico continua salvo.
              </Text>
            </View>
          ) : (
            <View className="flex-row items-end gap-2">
              <View className="flex-1 rounded-3xl border border-border bg-surface">
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Pergunta alguma coisa..."
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.accent}
                  multiline
                  maxLength={maxChars}
                  editable={!isSending}
                  style={{
                    color: colors.text,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 12,
                    fontSize: 15,
                    maxHeight: 120,
                    minHeight: 48,
                  }}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || isSending}
                className={`h-12 w-12 rounded-full items-center justify-center ${
                  !text.trim() || isSending
                    ? 'bg-surface-raised'
                    : 'bg-accent active:opacity-80'
                }`}
                style={
                  text.trim() && !isSending
                    ? {
                        shadowColor: colors.accent,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.4,
                        shadowRadius: 10,
                        elevation: 4,
                      }
                    : undefined
                }
              >
                <Send
                  size={18}
                  color={
                    !text.trim() || isSending
                      ? colors.textMuted
                      : colors.textInverse
                  }
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
          )}
          <View className="flex-row items-center justify-between mt-2 px-1">
            <Text className="text-text-muted text-[10px] flex-1">
              Respostas da IA são informativas. Não substituem profissional.
            </Text>
            {!limitReached && (
              <Text
                className="text-[10px] font-semibold ml-2"
                style={{
                  color: charsCrit
                    ? colors.danger
                    : charsWarn
                      ? colors.warn
                      : colors.textMuted,
                }}
              >
                {text.length}/{maxChars}
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
