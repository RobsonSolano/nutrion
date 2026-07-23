# Como verificar o billing-core

Guia de validação. O que já foi validado por mim (RPC GREEN + migration aplica + typecheck)
está em `../../project/STATE.md`. Abaixo, como **você** valida o que falta (RLS na prática +
runtime das edge functions), usando um **BD/projeto de teste** — nunca a prod.

## 1. Teste do RPC `resolve_entitlement` (lógica)

O teste é **transacional + ROLLBACK** — seguro mesmo num projeto real (não persiste nada).

### Opção A — Supabase local (Docker)
```bash
supabase start            # sobe Postgres local (porta 54322) — NÃO toca o remoto
supabase db reset         # aplica TODAS as migrations no banco LOCAL (sem --linked!)
# rodar o teste (psql do container, já que pode não haver psql no host):
docker exec -i supabase_db_nutrion \
  psql -U postgres -d postgres < supabase/tests/resolve_entitlement.test.sql
```
Esperado: `NOTICE: RESOLVE_ENTITLEMENT: ALL PASS`. (O nome do container vem de `supabase status`.)

### Opção B — Projeto de teste no Supabase Cloud
1. Crie um **novo projeto** no dashboard (ex: `personafit-test`) — separado da prod.
2. `supabase link --project-ref <ref-do-teste>`
3. `supabase db push` (aplica as migrations no projeto de teste).
4. Rode `supabase/tests/resolve_entitlement.test.sql` no **SQL Editor** do projeto de teste
   (ou via `psql` com a connection string do projeto). Procure o `ALL PASS`.
> ⚠️ Depois, **re-aponte o link pra prod** (`supabase link --project-ref <ref-da-prod>`) pra não
> dar `db:push` no projeto errado.

## 2. RLS de `subscriptions`
No banco de teste, autenticado como um usuário comum:
```sql
select * from public.subscriptions;          -- deve ver só a PRÓPRIA linha
insert into public.subscriptions(user_id,tier) values (auth.uid(),'pro'); -- deve FALHAR (RLS)
```

## 3. Runtime das edge functions (gating 402)
Precisa de Deno (vem com o Supabase CLI). Local:
```bash
supabase functions serve chat-ai            # idem p/ coach-generate-plan, coach-import-workout-ai, coach-create-student
```
Chame a função com o JWT de:
- um usuário **sem** direito → espere `402 { "error":"needs_upgrade", "feature":"chat" }` e **nada** gasto.
- um usuário **com** direito (ex: grandfather, ou linha `subscriptions` tier=pro) → fluxo normal.

Casos a cobrir: `chat-ai` (chat e sanity → `ai_personal`), `coach-generate-plan` /
`coach-import-workout-ai` (`ai_coach`), `coach-create-student` (`student_limit`: free=2/pro=5/premium=∞ — ajustado na migration 20260722000000).

## 4. Caminho para a PROD (quando a #2 estiver pronta)
Seguindo o CONCERN de ordem de deploy (STATE.md), **junto** do build com paywall-ui:
```bash
npm run db:push     # cria subscriptions + RPC + backfill grandfather na prod (aditivo, sem wipe)
npm run fn:deploy   # publica as edge functions com o gating
```
Nunca `supabase db reset --linked` (apaga o remoto).
