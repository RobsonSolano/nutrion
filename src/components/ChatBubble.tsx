import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import type { ChatMessage } from '@/hooks/useChat';

type Props = { message: ChatMessage };

export default function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

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
        <Text
          className={`text-[15px] leading-relaxed ${
            message.error ? 'text-danger' : 'text-text'
          }`}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}
