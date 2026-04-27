import { Pressable, Text, View } from 'react-native';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { MarkdownText } from '@/components/ui';
import type { ChatMessage } from '@/hooks/useChat';

type Props = {
  message: ChatMessage;
  onRetry?: () => void;
};

export default function ChatBubble({ message, onRetry }: Props) {
  const isUser = message.role === 'user';
  const showRetry = !!message.error && !!onRetry;

  if (isUser) {
    return (
      <View className="flex-row justify-end my-1.5 pl-12">
        <View
          className="rounded-3xl rounded-br-md bg-accent px-4 py-2.5"
          style={{
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <Text className="text-text-inverse text-[15px] leading-relaxed">
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row my-1.5 pr-12 items-end gap-2">
      <View
        className={`h-8 w-8 rounded-full items-center justify-center ${
          message.error
            ? 'bg-danger/10 border border-danger/40'
            : 'bg-violet/15 border border-violet/40'
        }`}
      >
        <Sparkles
          size={14}
          color={message.error ? colors.danger : colors.violetSoft}
        />
      </View>
      <View
        className={`flex-1 rounded-3xl rounded-bl-md px-4 py-3 ${
          message.error
            ? 'bg-danger/10 border border-danger/30'
            : 'bg-surface border border-border'
        }`}
      >
        {message.error ? (
          <>
            <Text className="text-danger text-[15px] leading-relaxed">
              {message.text}
            </Text>
            {showRetry && (
              <Pressable
                onPress={onRetry}
                hitSlop={8}
                className="mt-2 self-start flex-row items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 active:opacity-70"
              >
                <RefreshCw size={12} color={colors.danger} />
                <Text className="text-danger text-[12px] font-semibold">
                  Tentar novamente
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <MarkdownText
            value={message.text}
            textColor={colors.text}
            fontSize={15}
          />
        )}
      </View>
    </View>
  );
}
