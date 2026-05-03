import { useEffect, useRef } from 'react';
import { useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSessionStore } from '@/stores/useSessionStore';

type PushPayload = {
  event?: string;
  request_id?: string;
};

/**
 * Faz o roteamento quando o user toca numa push notification:
 * - Cold start (app aberto pela notificação): consome o último
 *   response uma vez via consumedRef.
 * - Foreground/background tap: listener contínuo enquanto o hook
 *   está montado.
 *
 * Só navega se o user estiver autenticado — caso contrário a push
 * só abre o app e o gate de auth cuida do fluxo normal.
 *
 * Pequeno delay antes de navegar pra dar tempo do bootstrap (auth +
 * profile + gate de role) terminar antes de empurrar a rota — senão
 * o gate pode redirecionar por cima da nossa navegação.
 */
export function useNotificationRouter() {
  const router = useRouter();
  const isAuthenticated = useSessionStore((s) => !!s.session);
  const consumedColdStart = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    function navigate(payload: PushPayload | null | undefined) {
      if (!payload?.event) return;
      let target: Href | null = null;
      if (payload.event === 'new_request') {
        target = '/(coach)/solicitacoes' as Href;
      } else if (payload.event === 'request_response') {
        target = '/solicitacoes' as Href;
      }
      if (!target) return;
      // Pequeno delay deixa o gate de role/onboarding finalizar antes.
      setTimeout(() => router.push(target!), 500);
    }

    // Cold start: app aberto a partir do tap na notificação.
    if (!consumedColdStart.current) {
      consumedColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then((res) => {
        if (res) {
          navigate(
            res.notification.request.content.data as PushPayload | null,
          );
        }
      });
    }

    // Tap enquanto app está em foreground/background.
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      navigate(res.notification.request.content.data as PushPayload | null);
    });

    return () => sub.remove();
  }, [router, isAuthenticated]);
}
