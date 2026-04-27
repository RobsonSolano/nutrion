# NutriOn — Supabase (schema + edge function)

## Estrutura

```
supabase/
├── config.toml                 # Config local (dev stack, storage buckets, auth providers)
├── migrations/
│   └── 20260419220000_init.sql # Schema completo (tabelas, RLS, trigger, bucket)
└── functions/
    └── chat-ai/
        ├── deno.json           # Import map (std, supabase-js)
        └── index.ts            # Edge Function (Gemini 1.5 Flash + memória)
```

## Aplicar no projeto remoto (CLI)

O Supabase CLI está instalado como **devDependency** (`supabase` no `package.json`).
Use `npx supabase ...` ou os scripts `npm` (`npm run db:push`, `npm run fn:deploy`).

> ℹ️ O Supabase CLI não aceita `npm i -g supabase` por design — devDep é o caminho oficial.

```bash
# 1. Login (interativo, abre navegador)
npx supabase login

# 2. Linkar este diretório ao projeto
npx supabase link --project-ref lqmxspapqkwmvwsxkkeh
#   vai pedir a DB password do projeto — copiar do Supabase Dashboard → Settings → Database

# 3. Aplicar migration
npm run db:push
# OU: npx supabase db push

# 4. Setar segredo do Groq (nunca vai para o app)
#    Crie a key em https://console.groq.com/keys
npx supabase secrets set GROQ_API_KEY=gsk_xxx

# 5. Deploy da edge function
npm run fn:deploy
# OU: npx supabase functions deploy chat-ai
```

## Modelos (configuráveis via secrets, sem redeploy)

- `GROQ_MODEL` — modelo para chat texto. Padrão: `llama-3.3-70b-versatile`
  - Alternativa rápida: `llama-3.1-8b-instant`
- `GROQ_VISION_MODEL` — modelo para Sanity Check com foto. Padrão: `meta-llama/llama-4-scout-17b-16e-instruct`

Trocar modelo:
```bash
npx supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
```

## Provider Google no dashboard (único passo que a CLI não cobre)

1. Abra **Dashboard → Authentication → Providers → Google**
2. Enable
3. **Client ID:** o do tipo "Web" criado no Google Cloud Console (mesmo do `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`)
4. **Client Secret:** o secret correspondente (Google Cloud Console → Credentials → seu OAuth Web Client)
5. ⚠️ **Skip nonce check: ON** (obrigatório para o fluxo nativo `signInWithIdToken`)
6. Save

> 🔒 **Nunca commite Client ID/Secret em texto puro neste repositório.**
> Mantenha-os apenas no `.env.local` (ignorado pelo git) e/ou em um cofre
> de senhas. Se algum secret for exposto acidentalmente, rotacione no
> Google Cloud Console (botão "Reset Secret") e atualize o Supabase Dashboard.

## Alternativa: aplicar SQL manualmente

Se preferir não usar CLI, copie o conteúdo de
`migrations/20260419220000_init.sql` e cole no SQL Editor do Dashboard.
Execute. Todo o schema (tabelas, RLS, trigger, bucket, policies) é idempotente
(`create ... if not exists`, `drop policy if exists`), pode rodar múltiplas vezes sem quebrar.

## Testar a edge function depois do deploy

```bash
# Pegar um access token (faça login no app primeiro, copie do AsyncStorage ou gere via SQL)
ACCESS_TOKEN="..."

curl -X POST \
  "https://lqmxspapqkwmvwsxkkeh.supabase.co/functions/v1/chat-ai" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"oi, me resume o que comi hoje"}'
```

Resposta esperada:
```json
{ "text": "Olá! ...", "usage": { "totalTokenCount": 120 } }
```
