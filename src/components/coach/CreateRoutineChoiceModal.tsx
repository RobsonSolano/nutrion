import { Modal, Pressable, Text, View } from 'react-native';
import { Pencil, Sparkles, X } from 'lucide-react-native';
import { colors } from '@/lib/theme';

type Props = {
  visible: boolean;
  destination: 'aluno' | 'template';
  onClose: () => void;
  onCreateFromScratch: () => void;
  onImportViaAi: () => void;
};

export default function CreateRoutineChoiceModal({
  visible,
  destination,
  onClose,
  onCreateFromScratch,
  onImportViaAi,
}: Props) {
  const targetLabel =
    destination === 'aluno' ? 'pra esse aluno' : 'na biblioteca';

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
          <View className="px-6 pt-6 pb-2">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-text text-lg font-bold">
                Como criar o treino?
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                className="h-8 w-8 rounded-2xl bg-surface-muted border border-border items-center justify-center active:opacity-70"
              >
                <X size={14} color={colors.textDim} />
              </Pressable>
            </View>
            <Text className="text-text-dim text-sm leading-relaxed">
              Escolha como quer adicionar esse treino {targetLabel}.
            </Text>
          </View>

          <View className="px-5 pt-4 pb-5 gap-3">
            <ChoiceCard
              icon={<Pencil size={22} color={colors.accent} />}
              accent={colors.accent}
              title="Criar do zero"
              description="Monte o treino selecionando exercícios da base."
              onPress={() => {
                onClose();
                onCreateFromScratch();
              }}
            />
            <ChoiceCard
              icon={<Sparkles size={22} color={colors.violetSoft} />}
              accent={colors.violetSoft}
              title="Importar via IA"
              description="Envie fotos da ficha ou cole a descrição. A IA monta o treino e você revisa antes de salvar."
              onPress={() => {
                onClose();
                onImportViaAi();
              }}
              badge="Novo"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChoiceCard({
  icon,
  accent,
  title,
  description,
  onPress,
  badge,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  description: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-border bg-surface-muted px-4 py-3.5 active:opacity-70"
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-12 w-12 rounded-2xl items-center justify-center border"
          style={{
            backgroundColor: `${accent}15`,
            borderColor: `${accent}40`,
          }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-text text-base font-semibold">{title}</Text>
            {badge && (
              <View
                className="rounded-full px-2 py-0.5 border"
                style={{
                  backgroundColor: `${accent}15`,
                  borderColor: `${accent}50`,
                }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: accent }}
                >
                  {badge}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-text-dim text-[12px] mt-1 leading-relaxed">
            {description}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
