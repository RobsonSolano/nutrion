import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/lib/theme';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Conteúdo à direita do box (texto/links). */
  children?: ReactNode;
};

/** Checkbox simples do design system. Toque no box ou no conteúdo alterna. */
export default function Checkbox({ checked, onChange, children }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      hitSlop={6}
      className="flex-row items-start gap-3 active:opacity-80"
    >
      <View
        className={`h-5 w-5 mt-0.5 rounded-md border items-center justify-center ${
          checked ? 'bg-accent border-accent' : 'bg-surface border-border-strong'
        }`}
      >
        {checked && <Check size={14} color={colors.textInverse} strokeWidth={3} />}
      </View>
      {children ? <View className="flex-1">{children}</View> : null}
    </Pressable>
  );
}
