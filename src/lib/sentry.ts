import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

/**
 * Inicializa o Sentry exatamente uma vez. Chame no topo do `_layout.tsx`
 * (antes de qualquer renderização). Se DSN não estiver configurado, vira
 * no-op silencioso — o app continua funcionando sem observabilidade.
 */
export function initSentry() {
  if (initialized) return;
  if (!dsn) {
    if (__DEV__) {
      console.warn('[sentry] EXPO_PUBLIC_SENTRY_DSN não configurado — desabilitado.');
    }
    return;
  }

  Sentry.init({
    dsn,
    // Em dev mostra eventos no console; em produção envia pro servidor.
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Performance: amostragem de transações (10% em prod, 100% em dev).
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Sessions ajudam a calcular crash-free users.
    enableAutoSessionTracking: true,
    // Versão do app (vem do app.config.ts via expo-constants).
    release: Constants.expoConfig?.version ?? 'unknown',
    // Não capturar PII por padrão — passamos só o user.id.
    sendDefaultPii: false,
    // Filtra antes de enviar: erros de cota não são "errors" verdadeiros.
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? event.message ?? '';
      if (/limite/i.test(msg) || /daily_limit/i.test(msg)) return null;
      return event;
    },
  });

  initialized = true;
}

/**
 * Tagueia o user atual nos eventos. Chamar quando login/logout. Não
 * mandamos email/nome — só id, que basta pra correlacionar.
 */
export function setSentryUser(userId: string | null) {
  if (!initialized) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/** Captura exception com contexto opcional. Wrapper amigável. */
export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Adiciona breadcrumb (rastro) — útil pra debug de fluxos. */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
) {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Dispara um evento de teste no Sentry. Use só em dev (botão escondido)
 * pra confirmar que a integração está funcionando ponta a ponta.
 */
export function testSentry() {
  if (!initialized) {
    console.warn('[sentry] não inicializado — verifique EXPO_PUBLIC_SENTRY_DSN');
    return;
  }
  addBreadcrumb('Botão Testar Sentry pressionado', 'test', {
    timestamp: Date.now(),
  });
  Sentry.captureMessage('Persona Fit — teste de integração Sentry', 'info');
  // Também dispara uma exception pra cobrir ambos os caminhos.
  captureError(new Error('Persona Fit test exception'), {
    feature: 'sentry_test',
    intentional: true,
  });
}

export { Sentry };
