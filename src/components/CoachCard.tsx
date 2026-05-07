import { Image, Linking, Pressable, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { useCoachContact } from '@/hooks/useCoachContact';
import { formatPhoneBR, whatsappUrl } from '@/lib/phone';
import { useAlert } from '@/components/GlobalAlertProvider';
import { colors } from '@/lib/theme';

type Props = {
  coachId: string;
};

export default function CoachCard({ coachId }: Props) {
  const { data, isLoading } = useCoachContact(coachId);
  const alert = useAlert();

  if (isLoading || !data) return null;

  const phone = data.show_contact_to_students ? data.contact_phone : null;
  const initial = (data.full_name ?? '?').charAt(0).toUpperCase();

  async function openWhatsApp() {
    if (!phone) return;
    try {
      await Linking.openURL(whatsappUrl(phone));
    } catch {
      alert.showAlert({
        title: 'Não consegui abrir o WhatsApp',
        message: 'Verifique se o app está instalado.',
        type: 'error',
      });
    }
  }

  return (
    <Card padding="md">
      <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
        Seu professor
      </Text>
      <View className="flex-row items-center gap-3">
        {data.avatar_url ? (
          <Image
            source={{ uri: data.avatar_url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <View className="h-12 w-12 rounded-full bg-surface-raised border border-border-strong items-center justify-center">
            <Text className="text-violet-soft text-xl font-bold">
              {initial}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-text font-semibold" numberOfLines={1}>
            {data.full_name ?? 'Professor'}
          </Text>
          <Text className="text-text-dim text-xs">Professor responsável</Text>
        </View>
      </View>

      {phone && (
        <Pressable
          onPress={openWhatsApp}
          className="mt-3 flex-row items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 active:opacity-70"
        >
          <MessageCircle size={16} color={colors.accent} />
          <Text className="text-accent text-sm font-semibold flex-1">
            {formatPhoneBR(phone)}
          </Text>
          <Text className="text-accent/60 text-xs">WhatsApp →</Text>
        </Pressable>
      )}
    </Card>
  );
}
