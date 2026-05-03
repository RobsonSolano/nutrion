import '../global.css';
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { useNotificationRouter } from '@/hooks/useNotificationRouter';
import { useSessionStore } from '@/stores/useSessionStore';
import { initSentry, Sentry, setSentryUser } from '@/lib/sentry';
import {
  configurePushHandler,
  ensureAndroidChannel,
} from '@/services/pushNotifications';

initSentry();
configurePushHandler();

function Providers({ children }: { children: React.ReactNode }) {
  useAuthBootstrap();
  useNotificationRouter();
  const userId = useSessionStore((s) => s.user?.id ?? null);

  useEffect(() => {
    setSentryUser(userId);
  }, [userId]);

  // Setup do canal Android — idempotente, roda uma vez no startup.
  useEffect(() => {
    void ensureAndroidChannel();
  }, []);

  return <>{children}</>;
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
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Providers>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#000000' },
              animation: 'fade',
            }}
          />
        </Providers>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

// Wrap exportado pelo Sentry: captura erros não tratados e adiciona
// instrumentação automática de navegação. No-op quando initSentry é no-op.
export default Sentry.wrap(RootLayout);
