import { View } from 'react-native';

type Props = {
  total: number;
  current: number; // 1-based
};

export default function ProgressBar({ total, current }: Props) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const done = i + 1 <= current;
        return (
          <View
            key={i}
            className={`flex-1 h-1 rounded-full ${
              done ? 'bg-accent' : 'bg-border'
            }`}
          />
        );
      })}
    </View>
  );
}
