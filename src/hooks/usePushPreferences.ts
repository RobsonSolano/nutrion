import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listPushPreferences,
  setPushEnabled,
} from '@/services/pushPreferences';
import { queryKeys } from '@/lib/queryKeys';
import type { PushPreference, PushType } from '@/types/database';

export function usePushPreferences(userId: string | null) {
  const q = useQuery({
    queryKey: queryKeys.pushPreferences(userId ?? 'none'),
    queryFn: listPushPreferences,
    enabled: !!userId,
    staleTime: 30_000,
  });

  // Map<type, PushPreference> pra consulta O(1) na tela
  const map = new Map<PushType, PushPreference>();
  for (const p of q.data ?? []) map.set(p.type, p);

  function isEnabled(type: PushType): boolean {
    // Default = true (ausência de row significa habilitado)
    return map.get(type)?.enabled ?? true;
  }

  return { ...q, map, isEnabled };
}

export function useSetPushEnabled(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, enabled }: { type: PushType; enabled: boolean }) =>
      setPushEnabled(type, enabled),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.pushPreferences(userId ?? 'none'),
      });
    },
  });
}
