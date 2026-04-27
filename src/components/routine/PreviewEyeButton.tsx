import { Pressable } from 'react-native';
import { Eye } from 'lucide-react-native';
import { colors } from '@/lib/theme';

type Props = {
  onPress: () => void;
  marginRight?: boolean;
};

export default function PreviewEyeButton({ onPress, marginRight }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel="Ver como executar"
      className={`h-8 w-8 rounded-lg bg-accent/10 border border-accent/30 items-center justify-center active:opacity-70 ${
        marginRight ? 'mr-2' : ''
      }`}
    >
      <Eye size={14} color={colors.accent} />
    </Pressable>
  );
}
