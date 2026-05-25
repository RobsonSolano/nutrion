import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ChevronRight, GripVertical, Pencil } from 'lucide-react-native';
import { colors } from '@/lib/theme';
import { useReorderRoutines } from '@/hooks/useRoutines';

export type ReorderableRoutine = {
  id: string;
  name: string;
  description: string | null;
  exercises_count: number;
};

const ITEM_HEIGHT = 64;

export function RoutinesReorderList({
  studentId,
  routines,
  onItemPress,
}: {
  studentId: string;
  routines: ReorderableRoutine[];
  onItemPress: (routineId: string) => void;
}) {
  // Cópia local pra evitar flicker durante o drag — o cache só é
  // atualizado no onMutate, então mantemos a ordem visual aqui.
  const [items, setItems] = useState(routines);
  const reorderM = useReorderRoutines(studentId);

  useEffect(() => {
    setItems(routines);
  }, [routines]);

  function renderItem({
    item,
    drag,
    isActive,
  }: RenderItemParams<ReorderableRoutine>) {
    return (
      <ScaleDecorator>
        <Pressable
          onPress={() => onItemPress(item.id)}
          onLongPress={drag}
          delayLongPress={180}
          disabled={isActive}
          className={`flex-row items-center gap-2 rounded-2xl border px-3 py-2.5 ${
            isActive
              ? 'border-accent bg-surface'
              : 'border-border bg-surface-muted active:opacity-70'
          }`}
          style={{ height: ITEM_HEIGHT - 8, marginBottom: 8 }}
        >
          <Pressable
            onLongPress={drag}
            delayLongPress={120}
            hitSlop={8}
            className="px-1"
          >
            <GripVertical size={16} color={colors.textDim} />
          </Pressable>
          <View className="flex-1">
            <Text
              className="text-text text-sm font-semibold"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text className="text-text-muted text-[11px] mt-0.5">
              {item.exercises_count} exercícios
              {item.description ? ` · ${item.description}` : ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full border border-violet/40 bg-violet/10 px-2 py-1">
            <Pencil size={10} color={colors.violetSoft} />
            <Text className="text-violet-soft text-[10px] font-semibold">
              Editar
            </Text>
          </View>
          <ChevronRight size={14} color={colors.textDim} />
        </Pressable>
      </ScaleDecorator>
    );
  }

  return (
    <View style={{ height: items.length * ITEM_HEIGHT }}>
      <DraggableFlatList
        data={items}
        keyExtractor={(it) => it.id}
        onDragEnd={({ data }) => {
          setItems(data);
          reorderM.mutate(data.map((r) => r.id));
        }}
        renderItem={renderItem}
        activationDistance={8}
        containerStyle={{ flex: 1 }}
      />
    </View>
  );
}
