import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/theme';

type Props = {
  label: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
};

export default function OptionCard({
  label,
  description,
  icon,
  selected = false,
  onPress,
  compact = false,
}: Props) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      className={`rounded-2xl border ${
        selected
          ? 'bg-accent/10 border-accent'
          : 'bg-surface border-border active:opacity-70'
      } ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}
    >
      <View className="flex-row items-center gap-3">
        {icon && (
          <View
            className={`h-10 w-10 rounded-xl items-center justify-center border ${
              selected
                ? 'bg-accent/15 border-accent/40'
                : 'bg-surface-muted border-border'
            }`}
          >
            {icon}
          </View>
        )}
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              selected ? 'text-accent' : 'text-text'
            }`}
          >
            {label}
          </Text>
          {description && (
            <Text className="text-text-muted text-xs mt-0.5">
              {description}
            </Text>
          )}
        </View>
        {selected && <Check size={18} color={colors.accent} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
