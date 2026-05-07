import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BookOpen,
  Plus,
} from 'lucide-react-native';
import { Button, Card, Screen, SegmentedControl } from '@/components/ui';
import { colors } from '@/lib/theme';
import { useTemplates } from '@/hooks/useTemplates';
import {
  MODALITY_LABELS,
  type TemplateListItem,
} from '@/types/database';

export default function TemplatesListScreen() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const templatesQ = useTemplates({ archived: showArchived });

  const list = templatesQ.data ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Screen variant="hero" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-subtle">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-surface-raised border border-border items-center justify-center active:opacity-70"
          >
            <ArrowLeft size={18} color={colors.textDim} />
          </Pressable>
          <Text className="text-text font-semibold">Biblioteca de treinos</Text>
          <Pressable
            onPress={() => router.push('/(coach)/templates/novo' as Href)}
            hitSlop={12}
            className="h-10 w-10 rounded-2xl bg-accent/10 border border-accent/40 items-center justify-center active:opacity-70"
          >
            <Plus size={18} color={colors.accent} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 40,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Card padding="md">
            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 rounded-xl bg-violet/15 border border-violet/40 items-center justify-center">
                <BookOpen size={18} color={colors.violetSoft} />
              </View>
              <View className="flex-1">
                <Text className="text-text font-semibold">
                  Treinos pré-cadastrados
                </Text>
                <Text className="text-text-dim text-xs mt-1 leading-relaxed">
                  Monte os treinos que você usa com vários alunos uma vez só.
                  Aplique no aluno via cadastro ou na tela do aluno — copia
                  exercícios, séries e cargas em snapshot.
                </Text>
              </View>
            </View>
          </Card>

          <SegmentedControl
            options={[
              { value: 'active', label: 'Ativos' },
              { value: 'archived', label: 'Arquivados' },
            ]}
            value={showArchived ? 'archived' : 'active'}
            onChange={(v) => setShowArchived(v === 'archived')}
          />

          {templatesQ.isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : templatesQ.error ? (
            <Text className="text-danger text-sm text-center py-6">
              Não consegui carregar a biblioteca. Puxa para baixo pra atualizar.
            </Text>
          ) : list.length === 0 ? (
            <Card padding="md">
              <Text className="text-text-muted text-sm text-center py-4 leading-relaxed">
                {showArchived
                  ? 'Sem templates arquivados.'
                  : 'Você ainda não tem templates. Crie o primeiro tocando em + acima.'}
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {list.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onPress={() =>
                    router.push(`/(coach)/templates/${t.id}` as Href)
                  }
                />
              ))}
            </View>
          )}

          {!showArchived && list.length > 0 && (
            <Button
              label="Novo template"
              onPress={() => router.push('/(coach)/templates/novo' as Href)}
              variant="secondary"
              icon={<Plus size={16} color={colors.text} />}
            />
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

function TemplateRow({
  template,
  onPress,
}: {
  template: TemplateListItem;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <Card padding="md">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 rounded-2xl bg-violet/10 border border-violet/30 items-center justify-center">
            {template.is_archived ? (
              <Archive size={18} color={colors.textMuted} />
            ) : (
              <ArchiveRestore size={18} color={colors.violetSoft} />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-text font-semibold" numberOfLines={1}>
              {template.name}
            </Text>
            <Text className="text-text-muted text-[11px] mt-0.5">
              {MODALITY_LABELS[template.modality]} ·{' '}
              {template.exercises_count} exercício
              {template.exercises_count === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
