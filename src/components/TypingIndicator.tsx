import { useEffect } from 'react';
import { View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/lib/theme';

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 }),
        ),
        -1,
        false,
      ),
    );
  }, [opacity, delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.violetSoft,
        },
        style,
      ]}
    />
  );
}

export default function TypingIndicator() {
  return (
    <View className="flex-row my-1.5 pr-12 items-end gap-2">
      <View className="h-8 w-8 rounded-full items-center justify-center bg-violet/15 border border-violet/40">
        <Sparkles size={14} color={colors.violetSoft} />
      </View>
      <View className="rounded-3xl rounded-bl-md px-4 py-4 bg-surface border border-border flex-row gap-1.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}
