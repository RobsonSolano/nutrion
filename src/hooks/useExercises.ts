import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listAllExercises,
  listExerciseGroups,
  listExercisesByGroup,
} from '@/services/exercises';
import { queryKeys } from '@/lib/queryKeys';

export function useExerciseGroups() {
  return useQuery({
    queryKey: queryKeys.exerciseGroups(),
    queryFn: listExerciseGroups,
    staleTime: 5 * 60 * 1000, // 5min — catálogo raramente muda
  });
}

export function useExercisesByGroup(groupId: string | null | undefined) {
  return useQuery({
    queryKey: groupId
      ? queryKeys.exercisesByGroup(groupId)
      : ['exercises-by-group', 'none'],
    queryFn: () => listExercisesByGroup(groupId!),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Retorna um Map<exerciseId, image_urls> pra consulta rápida de imagens de
 * demonstração a partir do exercise_id guardado no draft/rotina.
 */
export function useExerciseImagesMap() {
  const q = useQuery({
    queryKey: queryKeys.allExercises(),
    queryFn: listAllExercises,
    staleTime: 60 * 60 * 1000,
  });

  const map = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const e of q.data ?? []) {
      if (e.image_urls && e.image_urls.length > 0) {
        out.set(e.id, e.image_urls);
      }
    }
    return out;
  }, [q.data]);

  return map;
}
