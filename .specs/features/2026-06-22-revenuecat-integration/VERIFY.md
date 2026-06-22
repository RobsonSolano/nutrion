# Como verificar o revenuecat-integration #5a

Lógica validada por mim (vitest 41/41: `mapEvent` 10 + `downgrade` 5). Abaixo o UAT de runtime.

## 1. Mapa de evento (rápido)
```bash
npm test supabase/functions/revenuecat-webhook/mapEvent.test.ts
npm test src/lib/downgrade.test.ts
```

## 2. Webhook por simulação (sem precisar da loja)
Servir local + simular um evento com o header secreto:
```bash
npx supabase@latest start
RC_WEBHOOK_SECRET=teste123 supabase functions serve revenuecat-webhook --no-verify-jwt
# noutro terminal — sem header → 401:
curl -i -X POST localhost:54321/functions/v1/revenuecat-webhook -d '{}'
# com header + evento de compra (use um user_id real de profiles):
curl -i -X POST localhost:54321/functions/v1/revenuecat-webhook \
  -H "Authorization: Bearer teste123" -H "Content-Type: application/json" \
  -d '{"event":{"type":"INITIAL_PURCHASE","app_user_id":"<uuid-de-profiles>","entitlement_ids":["pro"],"expiration_at_ms":1800000000000}}'
```
Conferir: `select tier,status,source,period_end from subscriptions where user_id='<uuid>'` →
`pro / active / store_play / <data>`. Depois simular `EXPIRATION` → `free / expired`.

## 3. Downgrade "escolhe quem fica" (UAT)
- Seedar/forçar: professor com **>5 alunos** e `subscriptions(source='store_play', status='expired')`
  → `resolve_entitlement.student_limit=5`, `source != grandfather` → banner aparece no coach home.
- Abrir "escolha quem continua": marcar ≤5; confirmar → os não marcados são desvinculados (viram
  comum + ganham trial do #3) e o banner some. Forçar erro num unlink → mensagem "X não saíram".
- **Grandfather** com >5 (source='grandfather') → banner **NÃO** aparece (D5 não-destrutivo).

## 4. Deploy
`npm run fn:deploy` (inclui `revenuecat-webhook --no-verify-jwt`) + `supabase secrets set
RC_WEBHOOK_SECRET=<segredo>`. Configurar a URL do webhook no RevenueCat (operacional, manual-2).

## 5. #5b (quando houver Play Console + dev build)
Instalar `react-native-purchases`, `billing.ts` (init `appUserID=profiles.id`), `useOfferings`,
ligar a CTA "Quero assinar" do paywall à compra, restore, plugin no `app.config`. Só então o
webhook recebe eventos reais. Ver `manual-3` (blueprint) + `manual-4` (config/cupom/valor mínimo).
