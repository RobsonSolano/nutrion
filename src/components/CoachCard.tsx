import { Linking, Pressable, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { Avatar, Card } from '@/components/ui';
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
        <Avatar
          url={data.avatar_url}
          name={data.full_name}
          size={48}
          accent="violet"
        />
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
