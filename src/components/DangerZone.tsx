import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { Button, Card, ConfirmModal } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { useDeleteMyAccount } from '@/hooks/useAuth';
import { colors } from '@/lib/theme';

const REASON_MAX = 500;

type Props = {
  /**
   * Quando preenchido, o botão "Excluir minha conta" abre um modal
   * de bloqueio em vez do modal padrão. Usado pra professor com
   * alunos vinculados (precisa desvincular antes).
   */
  blockedReason?: {
    studentCount: number;
    /** Onde mandar o coach pra resolver o bloqueio (lista de alunos). */
    seeStudentsHref: Href;
  } | null;
};

export default function DangerZone({ blockedReason = null }: Props) {
  const router = useRouter();
  const alert = useAlert();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState('');
  const deleteM = useDeleteMyAccount();

  function open() {
    if (blockedReason && blockedReason.studentCount > 0) {
      setBlockOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    try {
      await deleteM.mutateAsync(reason.trim() || null);
      // Após sucesso, redireciona pro login. O hook já fez clear+signOut.
      router.replace('/(auth)/login' as Href);
    } catch (err) {
      setConfirmOpen(false);
      alert.showError(err);
    }
  }

  return (
    <>
      <Card padding="md">
        <View className="flex-row items-center gap-2 mb-2">
          <Trash2 size={14} color={colors.danger} />
          <Text className="text-danger text-[11px] uppercase tracking-widest font-semibold">
            Zona de risco
          </Text>
        </View>
        <Text className="text-text-muted text-xs leading-relaxed mb-3">
          Ao excluir sua conta, você perde acesso ao app e todos os seus
          dados são apagados. Essa ação não pode ser desfeita.
        </Text>
        <Button
          label="Excluir minha conta"
          onPress={open}
          variant="danger"
          icon={<Trash2 size={16} color={colors.danger} />}
        />
      </Card>

      {/* Modal de bloqueio: professor com alunos */}
      <ConfirmModal
        visible={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Desvincule seus alunos antes"
        message={`Você tem ${blockedReason?.studentCount ?? 0} aluno(s) vinculado(s). Antes de excluir sua conta, vá em cada aluno e clique em "Desvincular aluno".`}
        icon={<Trash2 size={26} color={colors.danger} />}
        actions={[
          {
            label: 'Ver alunos',
            variant: 'primary',
            onPress: () => {
              setBlockOpen(false);
              if (blockedReason) {
                router.push(blockedReason.seeStudentsHref);
              }
            },
          },
          {
            label: 'Fechar',
            variant: 'ghost',
            onPress: () => setBlockOpen(false),
          },
        ]}
      />

      {/* Modal de exclusão com textarea de motivo */}
      <DeleteAccountModal
        visible={confirmOpen}
        loading={deleteM.isPending}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => {
          if (deleteM.isPending) return;
          setConfirmOpen(false);
          setReason('');
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function DeleteAccountModal({
  visible,
  loading,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  loading: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View className="rounded-3xl bg-surface border border-border">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border-subtle">
            <View className="flex-row items-center gap-2 flex-1">
              <Trash2 size={20} color={colors.danger} />
              <Text className="text-text font-semibold text-base">
                Excluir sua conta?
              </Text>
            </View>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              hitSlop={12}
              className="h-9 w-9 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
            >
              <X size={16} color={colors.textDim} />
            </Pressable>
          </View>

          <View className="px-5 py-4 gap-3">
            <Text className="text-text-muted text-sm leading-relaxed">
              Ao confirmar, você perderá totalmente o acesso ao Persona Fit e
              seus dados serão apagados. Essa ação NÃO pode ser desfeita.
            </Text>

            <View>
              <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-1">
                Por que está saindo? (opcional)
              </Text>
              <TextInput
                value={reason}
                onChangeText={(v) =>
                  v.length <= REASON_MAX && onReasonChange(v)
                }
                placeholder="Ajuda a gente a melhorar o app"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                editable={!loading}
                className="rounded-2xl border border-border bg-surface-muted px-3 py-2.5 text-text text-sm"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <Text className="text-text-muted text-[11px] text-right mt-1">
                {reason.length}/{REASON_MAX}
              </Text>
            </View>

            <View className="gap-2 mt-1">
              <Button
                label="Excluir conta"
                onPress={onConfirm}
                loading={loading}
                variant="danger"
                icon={<Trash2 size={16} color={colors.danger} />}
              />
              <Button
                label="Cancelar"
                onPress={onCancel}
                variant="ghost"
                disabled={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
