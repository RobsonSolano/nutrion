import { useState } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '@/services/pushNotifications';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';

/**
 * Encapsula a lógica de ativar/desativar push notifications.
 * Usado nos botões do perfil (comum/aluno) e da home do professor.
 */
export function usePushToggle() {
  const { user } = useAuth();
  const profileQ = useProfile();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const enabled = !!profileQ.data?.expo_push_token;

  async function toggle() {
    setLoading(true);
    try {
      if (enabled) {
        await unregisterPushNotifications();
      } else {
        const result = await registerForPushNotifications();
        if (!result.ok) {
          const msg =
            result.reason === 'permission_denied'
              ? 'Permissão negada. Habilite notificações nas configurações do celular.'
              : result.reason === 'not_device'
                ? 'Push só funciona em device físico (não em emulador iOS).'
                : result.reason === 'no_project_id'
                  ? 'Build precisa estar configurado com EAS projectId.'
                  : (result.detail ?? 'Tenta de novo.');
          Alert.alert('Não consegui ativar', msg);
          return;
        }
      }
      if (user?.id) {
        await qc.invalidateQueries({ queryKey: queryKeys.profile(user.id) });
      }
    } finally {
      setLoading(false);
    }
  }

  return { enabled, loading, toggle };
}
