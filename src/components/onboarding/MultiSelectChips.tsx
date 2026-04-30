import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type Option = { value: string; label: string; icon?: string };

type Props = {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  single?: boolean; // se true, onToggle funciona como radio (substitui o selecionado)
};

export default function MultiSelectChips({
  options,
  selected,
  onToggle,
  single = false,
}: Props) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              void Haptics.selectionAsync();
              if (single && on) return;
              onToggle(opt.value);
            }}
            className={`rounded-full border px-4 py-3 items-center justify-center ${
              on
                ? 'bg-accent/10 border-accent'
                : 'bg-surface-muted border-border active:opacity-70'
            }`}
            style={{ minHeight: 44 }}
            hitSlop={6}
          >
            <Text
              className={`text-[13px] font-semibold ${
                on ? 'text-accent' : 'text-text-dim'
              }`}
            >
              {opt.icon ? `${opt.icon} ` : ''}
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
