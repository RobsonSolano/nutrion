// NutriOn — auditoria do uso de IA (Groq) por feature e dia.
//
// Uso:
//   node --env-file=.env.local scripts/audit-ai-usage.mjs
//   npm run audit:ai-usage
//
// Lê ai_usage_log e mostra:
//   - Total de chamadas por feature (últimos 7 dias)
//   - Erros (rate_limit, groq_api_error) por feature
//   - Top features que mais consumiram tokens
//
// Requer SUPABASE_SERVICE_ROLE_KEY pra bypassar RLS.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌ Faltam EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no env.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

const { data: rows, error } = await supabase
  .from('ai_usage_log')
  .select('feature, status, error_code, tokens, day, created_at')
  .gte('created_at', sevenDaysAgo)
  .order('created_at', { ascending: false })
  .limit(10000);

if (error) {
  console.error('❌ Erro lendo ai_usage_log:', error.message);
  process.exit(1);
}

console.log('# Auditoria de uso de IA — últimos 7 dias\n');

// Agregação por feature
const byFeature = new Map();
for (const r of rows) {
  const f = r.feature;
  if (!byFeature.has(f)) {
    byFeature.set(f, {
      total: 0,
      success: 0,
      rate_limit: 0,
      groq_api_error: 0,
      other_errors: 0,
      tokens: 0,
      last24h: 0,
      lastHour: 0,
      rate_limit_lastHour: 0,
    });
  }
  const agg = byFeature.get(f);
  agg.total++;
  if (r.status === 'success') agg.success++;
  if (r.error_code === 'rate_limit') agg.rate_limit++;
  else if (r.error_code === 'groq_api_error') agg.groq_api_error++;
  else if (r.status === 'error') agg.other_errors++;
  agg.tokens += r.tokens ?? 0;

  if (r.created_at >= oneDayAgo) agg.last24h++;
  if (r.created_at >= oneHourAgo) {
    agg.lastHour++;
    if (r.error_code === 'rate_limit') agg.rate_limit_lastHour++;
  }
}

const sorted = [...byFeature.entries()].sort((a, b) => b[1].total - a[1].total);

console.log('## Por feature\n');
console.log('| Feature | Total 7d | Sucesso | Rate limit | Groq err | Outros err | Tokens | 24h | 1h | RL 1h |');
console.log('|---------|----------|---------|------------|----------|------------|--------|-----|----|------|');
for (const [feature, agg] of sorted) {
  console.log(
    `| ${feature} | ${agg.total} | ${agg.success} | ${agg.rate_limit} | ${agg.groq_api_error} | ${agg.other_errors} | ${agg.tokens.toLocaleString('pt-BR')} | ${agg.last24h} | ${agg.lastHour} | ${agg.rate_limit_lastHour} |`,
  );
}

// Totais globais
const totals = sorted.reduce(
  (acc, [, a]) => ({
    total: acc.total + a.total,
    rate_limit: acc.rate_limit + a.rate_limit,
    tokens: acc.tokens + a.tokens,
    last24h: acc.last24h + a.last24h,
    lastHour: acc.lastHour + a.lastHour,
    rate_limit_lastHour: acc.rate_limit_lastHour + a.rate_limit_lastHour,
  }),
  { total: 0, rate_limit: 0, tokens: 0, last24h: 0, lastHour: 0, rate_limit_lastHour: 0 },
);

console.log('\n## Resumo\n');
console.log(`- **Total de chamadas 7d:** ${totals.total.toLocaleString('pt-BR')}`);
console.log(`- **Rate limits 7d:** ${totals.rate_limit} (${pct(totals.rate_limit, totals.total)}%)`);
console.log(`- **Tokens consumidos 7d:** ${totals.tokens.toLocaleString('pt-BR')}`);
console.log(`- **Chamadas últimas 24h:** ${totals.last24h}`);
console.log(`- **Chamadas última hora:** ${totals.lastHour}`);
console.log(`- **Rate limits última hora:** ${totals.rate_limit_lastHour} ${flag(totals.rate_limit_lastHour)}`);

// Alerta crítico
if (totals.rate_limit_lastHour >= 10) {
  console.log('\n⚠️  ALERTA: muitos rate_limits na última hora — Groq pode estar bloqueando. Considere aumentar plano ou ativar circuit breaker.');
}

function pct(part, whole) {
  return whole === 0 ? 0 : ((part * 100) / whole).toFixed(1);
}
function flag(n) {
  if (n === 0) return '✓';
  if (n < 5) return '⚠';
  return '🚨';
}
