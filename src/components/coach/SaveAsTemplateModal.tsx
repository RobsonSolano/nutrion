import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { BookmarkPlus } from 'lucide-react-native';
import { Button, Input } from '@/components/ui';
import { colors } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void | Promise<void>;
  loading?: boolean;
  defaultName?: string;
};

export default function SaveAsTemplateModal({
  visible,
  onClose,
  onConfirm,
  loading,
  defaultName = '',
}: Props) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (visible) setName(defaultName);
  }, [visible, defaultName]);

  const trimmed = name.trim();
  const canSave = trimmed.length >= 1 && trimmed.length <= 80;

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
            <View className="h-12 w-12 rounded-2xl bg-violet/15 border border-violet/40 items-center justify-center mb-3">
              <BookmarkPlus size={22} color={colors.violetSoft} />
            </View>
            <Text className="text-text text-lg font-bold text-center">
              Salvar como template
            </Text>
            <Text className="text-text-dim text-sm text-center mt-1 leading-relaxed">
              Esse treino vai pra sua biblioteca, pronto pra reaplicar em
              outros alunos.
            </Text>
          </View>

          <View className="px-6 pb-4 pt-3">
            <Input
              label="Nome do template"
              value={name}
              onChangeText={setName}
              placeholder="Ex: Hipertrofia A, Cardio iniciante..."
              autoFocus
              maxLength={80}
            />
          </View>

          <View className="px-6 pb-6 gap-2">
            <Button
              label="Salvar template"
              onPress={() => onConfirm(trimmed)}
              disabled={!canSave || loading}
              loading={loading}
            />
            <Button
              label="Cancelar"
              onPress={onClose}
              variant="ghost"
              disabled={loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
