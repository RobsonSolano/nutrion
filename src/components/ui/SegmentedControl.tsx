import { Pressable, Text, View } from 'react-native';
import { colors } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Variant = 'segmented' | 'tabs';

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 'segmented' (padrão) — pílula com fundo arredondado por opção, estilo iOS.
   * 'tabs' — sem fundo, sublinhado embaixo da opção ativa, fonte maior.
   */
  variant?: Variant;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'segmented',
}: Props<T>) {
  if (variant === 'tabs') {
    return <TabsVariant options={options} value={value} onChange={onChange} />;
  }
  return <SegmentedVariant options={options} value={value} onChange={onChange} />;
}

function SegmentedVariant<T extends string>({
  options,
  value,
  onChange,
}: Omit<Props<T>, 'variant'>) {
  return (
    <View className="flex-row rounded-2xl border border-border bg-surface-muted p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1"
            hitSlop={4}
          >
            <View
              className={`items-center justify-center py-3.5 rounded-xl ${
                active ? 'bg-surface-raised' : ''
              }`}
              style={{
                minHeight: 44,
                ...(active
                  ? {
                      shadowColor: colors.accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.18,
                      shadowRadius: 10,
                      elevation: 2,
                    }
                  : null),
              }}
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

function TabsVariant<T extends string>({
  options,
  value,
  onChange,
}: Omit<Props<T>, 'variant'>) {
  return (
    <View className="flex-row border-b border-border-subtle">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1"
            hitSlop={4}
          >
            <View
              className="items-center justify-center pt-3 pb-3"
              style={{ minHeight: 52 }}
            >
              <Text
                className={`text-base font-semibold ${
                  active ? 'text-accent' : 'text-text-dim'
                }`}
              >
                {opt.label}
              </Text>
              <View
                style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 16,
                  right: 16,
                  height: 3,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: active ? colors.accent : 'transparent',
                  shadowColor: active ? colors.accent : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: active ? 0.5 : 0,
                  shadowRadius: 6,
                  elevation: active ? 2 : 0,
                }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
