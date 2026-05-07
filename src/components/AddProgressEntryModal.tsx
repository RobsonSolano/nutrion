import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Button, Input } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { useCreateProgressEntry } from '@/hooks/useProgressEntries';
import { colors } from '@/lib/theme';

const PLACEHOLDERS = [
  'Emagreci 2 kg essa semana sem cortar treino',
  'Bati meu recorde no supino: 80 kg',
  'Voltei a dormir 7h+ por noite',
  'Ganhei 1 kg de massa esse mês',
  'Consegui correr 5km sem parar',
  'Reduzi o açúcar e parei de sentir aquela queda às 15h',
  'Bateu meta de água 5 dias seguidos',
  'Subi mais um furo no cinto',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function AddProgressEntryModal({
  visible,
  onClose,
  onSaved,
}: Props) {
  const create = useCreateProgressEntry();
  const alert = useAlert();
  const [content, setContent] = useState('');

  const placeholder = useMemo(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
    // re-sortear quando o modal abre
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible],
  );

  useEffect(() => {
    if (visible) setContent('');
  }, [visible]);

  const trimmed = content.trim();
  const canSave = trimmed.length >= 1 && trimmed.length <= 1000;

  async function handleSave() {
    if (!canSave) return;
    try {
      await create.mutateAsync(trimmed);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      setContent('');
      onSaved?.();
    } catch (err) {
      alert.showError(err);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          className="rounded-3xl border border-border bg-surface overflow-hidden"
        >
          <View className="px-6 pt-6 pb-2 items-center">
            <View className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/30 items-center justify-center mb-3">
              <Sparkles size={22} color={colors.accent} />
            </View>
            <Text className="text-text text-lg font-bold text-center">
              Novo registro de evolução
            </Text>
            <Text className="text-text-dim text-sm text-center mt-1 leading-relaxed">
              Anote uma conquista, mudança de hábito ou marco. Vai pra sua
              linha do tempo.
            </Text>
          </View>

          <View className="px-6 pb-4 pt-3">
            <Input
              value={content}
              onChangeText={setContent}
              placeholder={placeholder}
              autoFocus
              multiline
              numberOfLines={4}
              maxLength={1000}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
            <Text className="text-text-muted text-[11px] mt-2 text-right">
              {trimmed.length}/1000
            </Text>
          </View>

          <View className="px-6 pb-6 gap-2">
            <Button
              label="Salvar registro"
              onPress={handleSave}
              disabled={!canSave || create.isPending}
              loading={create.isPending}
            />
            <Button
              label="Cancelar"
              onPress={onClose}
              variant="ghost"
              disabled={create.isPending}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
