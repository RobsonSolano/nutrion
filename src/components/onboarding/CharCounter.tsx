import { Text } from 'react-native';

type Props = { value: string; max: number };

export default function CharCounter({ value, max }: Props) {
  const over = value.length > max;
  return (
    <Text
      className={`text-[11px] mt-1 self-end ${
        over ? 'text-danger' : 'text-text-muted'
      }`}
    >
      {value.length}/{max}
    </Text>
  );
}
