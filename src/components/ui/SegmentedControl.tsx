import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View className="flex-row rounded-2xl border border-border bg-surface-muted p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1"
          >
            <View
              className={`items-center justify-center py-2.5 rounded-xl ${
                active ? 'bg-surface-raised' : ''
              }`}
              style={
                active
                  ? {
                      shadowColor: colors.accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.18,
                      shadowRadius: 10,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text
                className={`text-sm font-semibold ${
                  active ? 'text-accent' : 'text-text-dim'
                }`}
              >
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
