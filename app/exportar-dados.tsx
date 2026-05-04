import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Download,
  FileJson,
  Send,
  ShieldCheck,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Button, Card, Screen } from '@/components/ui';
import { useAlert } from '@/components/GlobalAlertProvider';
import { colors } from '@/lib/theme';
import { exportMyData, type DataExport } from '@/services/dataExport';
import { captureError } from '@/lib/sentry';

type Phase = 'idle' | 'exporting' | 'ready';

export default function ExportarDadosScreen() {
  const router = useRouter();
  const alert = useAlert();
  const [phase, setPhase] = useState<Phase>('idle');
  const [data, setData] = useState<DataExport | null>(null);

  async function handleGenerate() {
    setPhase('exporting');
    try {
      const exported = await exportMyData();
      setData(exported);
      setPhase('ready');
    } catch (err) {
      captureError(err, { feature: 'data_export' });
      setPhase('idle');
      alert.showError(err);
    }
  }

  async function handleShare() {
    if (!data) return;
    try {
      const json = JSON.stringify(data, null, 2);
      const fileUri = `${FileSystem.documentDirectory}nutrion-meus-dados-${data.exported_at.slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      // Tenta compartilhar arquivo (iOS) ou texto inline (fallback Android).
      await Share.share(
        {
          title: 'Meus dados NutriOn',
          message: json,
          url: fileUri,
        },
        { dialogTitle: 'Compartilhar JSON' },
      );
    } catch (err) {
      captureError(err, { feature: 'data_export_share' });
      alert.showError(err);
    }
  }

  return (
    <Screen variant="hero" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-border-subtle">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
        >
          <ArrowLeft size={18} color={colors.textDim} />
        </Pressable>
        <Text className="text-text font-semibold text-base flex-1">
          Exportar meus dados
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card glow accent="violet" padding="md">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
              <ShieldCheck size={18} color={colors.violetSoft} />
            </View>
            <View className="flex-1">
              <Text className="text-text font-semibold">
                Direito de portabilidade
              </Text>
              <Text className="text-text-muted text-xs mt-1 leading-relaxed">
                A LGPD garante que você pode obter uma cópia dos seus dados em
                formato estruturado. Aqui geramos um JSON completo com tudo
                que conseguimos ler do seu perfil — refeições, água, treinos,
                sessões, chat com a IA, solicitações etc.
              </Text>
            </View>
          </View>
        </Card>

        {phase === 'idle' && (
          <Button
            label="Gerar export agora"
            onPress={handleGenerate}
            size="lg"
            icon={<Download size={18} color={colors.textInverse} />}
          />
        )}

        {phase === 'exporting' && (
          <Card padding="md">
            <Text className="text-text-dim text-sm text-center">
              Coletando seus dados... isso pode levar alguns segundos.
            </Text>
          </Card>
        )}

        {phase === 'ready' && data && (
          <>
            <Card padding="md">
              <View className="flex-row items-center gap-3 mb-3">
                <FileJson size={16} color={colors.accent} />
                <Text className="text-text-dim text-[11px] uppercase tracking-widest">
                  Export gerado
                </Text>
              </View>
              <View className="gap-1.5">
                <CountRow label="Refeições" value={data.food_logs.length} />
                <CountRow label="Água (dias)" value={data.water_logs.length} />
                <CountRow
                  label="Sessões de treino"
                  value={data.workout_sessions.length}
                />
                <CountRow
                  label="Rotinas"
                  value={data.workout_routines.length}
                />
                <CountRow
                  label="Mensagens com IA"
                  value={data.chat_messages.length}
                />
                <CountRow
                  label="Solicitações"
                  value={data.student_requests.length}
                />
                <CountRow
                  label="Anotações (professor)"
                  value={data.coach_notes.length}
                />
                <CountRow
                  label="Revisões de plano"
                  value={data.student_plan_revisions.length}
                />
              </View>
            </Card>

            <Button
              label="Compartilhar JSON"
              onPress={handleShare}
              size="lg"
              icon={<Send size={18} color={colors.textInverse} />}
            />
            <Button
              label="Gerar de novo"
              onPress={handleGenerate}
              variant="ghost"
            />
          </>
        )}

        <Text className="text-text-muted text-[11px] text-center mt-2 leading-relaxed">
          Ao compartilhar, você pode salvar o JSON em apps como Drive, Email
          ou Notas. O arquivo fica também salvo localmente no app
          ({`nutrion-meus-dados-AAAA-MM-DD.json`}).
        </Text>
      </ScrollView>
    </Screen>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-text-dim text-sm">{label}</Text>
      <Text className="text-text text-sm font-bold">
        {value.toLocaleString('pt-BR')}
      </Text>
    </View>
  );
}
