import { forwardRef, ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors } from '@/lib/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
  center?: boolean;
  leftIcon?: ReactNode;
  rightAccessory?: ReactNode;
  onRightAccessoryPress?: () => void;
};

const Input = forwardRef<TextInput, Props>(function Input(
  {
    label,
    hint,
    error,
    size = 'md',
    center,
    leftIcon,
    rightAccessory,
    onRightAccessoryPress,
    style,
    ...rest
  },
  ref,
) {
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label && (
        <Text className="text-text-dim text-xs uppercase tracking-widest mb-2">
          {label}
        </Text>
      )}
      <View
        className={`flex-row items-center rounded-2xl border bg-surface ${
          error ? 'border-danger' : 'border-border'
        }`}
      >
        {leftIcon && <View className="pl-4">{leftIcon}</View>}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          style={[
            {
              flex: 1,
              color: colors.text,
              paddingHorizontal: 16,
              paddingVertical: size === 'lg' ? 16 : 14,
              fontSize: size === 'lg' ? 20 : 16,
              textAlign: center ? 'center' : 'left',
              letterSpacing: center ? 6 : 0,
            },
            style,
          ]}
          {...rest}
        />
        {rightAccessory && (
          <Pressable
            onPress={onRightAccessoryPress}
            hitSlop={10}
            className="pr-4 pl-2 py-2"
          >
            {rightAccessory}
          </Pressable>
        )}
      </View>
      {hint && !error && (
        <Text className="text-text-muted text-xs mt-2">{hint}</Text>
      )}
      {error && <Text className="text-danger text-xs mt-2">{error}</Text>}
    </View>
  );
});

export default Input;
