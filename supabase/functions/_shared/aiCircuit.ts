// Circuit breaker pra chamadas Groq.
//
// Detecta surto de rate_limit (ex: estouro de quota diária ou Groq
// instável) e pausa as chamadas por alguns minutos, evitando martelar
// a API e poupando logs/alertas. Quando aberto, callers devem ir direto
// pro fallback (template fixo, plano genérico, etc.).
//
// Estado calculado on-demand via SQL — sem tabela nova. Reseta natural
// quando passa o window de detecção sem rate_limits novos.

import type { SupabaseClient } from '@supabase/supabase-js';

// Window de detecção: se rolou N rate_limits nos últimos X minutos, abre.
const DETECTION_WINDOW_MIN = 1;
const DETECTION_THRESHOLD = 3;

export type CircuitState =
  | { open: false }
  | { open: true; recentFailures: number };

/**
 * Verifica se o circuit está aberto pra chamadas Groq.
 * Aberto = N+ rate_limits na última janela → não tente chamar.
 *
 * Falha silenciosa (retorna closed) se a query falhar — não bloquear
 * o fluxo principal por erro de monitoring.
 */
export async function getAiCircuitState(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
): Promise<CircuitState> {
  try {
    const since = new Date(
      Date.now() - DETECTION_WINDOW_MIN * 60 * 1000,
    ).toISOString();
    const { count, error } = await supabase
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('error_code', 'rate_limit')
      .gte('created_at', since);
    if (error) {
      console.warn('[aiCircuit] check failed:', error.message);
      return { open: false };
    }
    const recentFailures = count ?? 0;
    if (recentFailures >= DETECTION_THRESHOLD) {
      return { open: true, recentFailures };
    }
    return { open: false };
  } catch (err) {
    console.warn('[aiCircuit] unexpected:', err);
    return { open: false };
  }
}
