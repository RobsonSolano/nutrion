import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Send, Sparkles, Trash2, MessageCircle } from 'lucide-react-native';
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
  'O que posso melhorar na minha semana?',
  'Analise meu dia e me dê um resumo',
];

export default function ChatScreen() {
  const { messages, isSending, sendMessage, clear } = useChat();
  const profileQ = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const kbHeight = useKeyboardHeight();
  const isKeyboardOpen = kbHeight > 0;

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const firstName = profileQ.data?.full_name?.split(' ')[0] ?? '';

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void sendMessage(trimmed);
  }, [text, isSending, sendMessage]);

  const handleSuggestion = useCallback(
    (s: string) => {
      void Haptics.selectionAsync();
      void sendMessage(s);
    },
    [sendMessage],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatBubble message={item} />,
    [],
  );

  const isEmpty = messages.length === 0;

  return (
    <Screen variant="violet" edges={['top']}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3 border-b border-border-subtle">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-violet/20 border border-violet/40 items-center justify-center">
              <Sparkles size={18} color={colors.violetSoft} />
            </View>
            <View>
              <Text className="text-text text-base font-bold">Nutri IA</Text>
              <Text className="text-text-dim text-[11px]">
                consciente do seu perfil e metas
              </Text>
            </View>
          </View>
          {messages.length > 0 && (
            <Pressable
              onPress={clear}
              hitSlop={12}
              className="h-9 w-9 rounded-xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <Trash2 size={14} color={colors.textDim} />
            </Pressable>
          )}
        </View>

        {isEmpty ? (
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
            </View>
            <Text className="text-text-muted text-[10px] uppercase tracking-widest mb-2 px-1">
              Sugestões
            </Text>
            <View className="gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSuggestion(s)}
                  className="rounded-2xl border border-border bg-surface px-4 py-3 active:opacity-70"
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
                  !text.trim() || isSending ? colors.textMuted : colors.textInverse
                }
                strokeWidth={2.5}
              />
            </Pressable>
          </View>
          <Text className="text-text-muted text-[10px] text-center mt-2">
            Respostas da IA são informativas. Não substituem profissional.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
