import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { useNotificationRouter } from '@/hooks/useNotificationRouter';
import { useOtaUpdate } from '@/hooks/useOtaUpdate';
import { useSessionStore } from '@/stores/useSessionStore';
import { initSentry, Sentry, setSentryUser } from '@/lib/sentry';
import {
  configurePushHandler,
  ensureAndroidChannel,
} from '@/services/pushNotifications';
import { GlobalAlertProvider } from '@/components/GlobalAlertProvider';
import { ConfirmModal } from '@/components/ui';
import { Sparkles } from 'lucide-react-native';
import { colors } from '@/lib/theme';

initSentry();
configurePushHandler();

function Providers({ children }: { children: React.ReactNode }) {
  useAuthBootstrap();
  useNotificationRouter();
  const userId = useSessionStore((s) => s.user?.id ?? null);
  const ota = useOtaUpdate();

  useEffect(() => {
    setSentryUser(userId);
  }, [userId]);

  // Setup do canal Android — idempotente, roda uma vez no startup.
  useEffect(() => {
    void ensureAndroidChannel();
  }, []);

  return (
    <>
      {children}
      <ConfirmModal
        visible={ota.isReady}
        onClose={ota.dismiss}
        title="Atualização disponível"
        message="Uma nova versão do app foi baixada. Aplicar agora reinicia o NutriOn em alguns segundos."
        icon={<Sparkles size={26} color={colors.accent} />}
        dismissable={!ota.isApplying}
        actions={[
          {
            label: 'Atualizar agora',
            variant: 'primary',
            onPress: ota.apply,
            loading: ota.isApplying,
          },
          {
            label: 'Mais tarde',
            variant: 'ghost',
            onPress: ota.dismiss,
            disabled: ota.isApplying,
          },
        ]}
      />
    </>
  );
}

function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <GlobalAlertProvider>
            <Providers>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#000000' },
                  animation: 'fade',
                }}
              />
            </Providers>
          </GlobalAlertProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Wrap exportado pelo Sentry: captura erros não tratados e adiciona
// instrumentação automática de navegação. No-op quando initSentry é no-op.
export default Sentry.wrap(RootLayout);
