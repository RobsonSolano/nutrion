# Como verificar o legal-docs

Lógica e migration validadas por mim (vitest 26/26 + migration aplica/seed/RLS). Abaixo o UAT de
runtime (precisa auth real). Use BD/projeto de teste.

## 1. Migration (rápido)
```bash
npx supabase@latest start
docker exec supabase_db_nutrion psql -U postgres -d postgres \
  -c "select doc_type, requires_acceptance from public.legal_documents order by doc_type;"
```
Esperado: 3 linhas — `privacidade` (f), `termos_contrato` (t), `termos_uso` (t). RLS habilitada
nas duas tabelas.

## 2. UAT do aceite (precisa usuário real)
- **Cadastro email (normal):** sem marcar o aceite, "Criar conta" fica desabilitado. Marcar →
  criar → conferir `select * from legal_acceptances where user_id=<novo>` tem 2 linhas
  (`termos_uso`, `termos_contrato`, versão atual).
- **Cadastro professor:** idem (botão "Criar conta de professor" travado sem aceite).
- **Google:** "Continuar com Google" não dispara sem o aceite marcado (mostra aviso). Com aceite,
  entra e grava as 2 linhas. Entrar 2x com Google **não** duplica (idempotente).
- **Login por email (existente):** NÃO exige aceite (grandfather).
- **Links:** tocar em "Termos de Uso"/"Termos de Contrato"/"Política de Privacidade" abre as URLs
  do hotsite (hoje placeholders).

## 3. RLS
Autenticado como usuário comum:
```sql
select * from public.legal_acceptances;        -- só as próprias linhas
insert into public.legal_acceptances(user_id,doc_type,version)
  values ('<outro_uuid>','termos_uso','x');     -- deve FALHAR (RLS with check)
select * from public.legal_documents;           -- catálogo legível (3 docs)
```

## 4. Caminho para a PROD
`npm run db:push` (tabelas + seed) + build com o aceite. **Antes de publicar:** trocar as URLs
placeholder pelas reais do hotsite — em `legal_documents` (update direto, sem release) e a de
privacidade em `app.config.ts` (release). Conteúdo jurídico + hotsite = deliverables externos.
