-- =====================================================================
-- Persona Fit — consentimento de dados de saúde (LGPD art. 11, I)
-- Adiciona o doc_type 'consentimento_saude' ao catálogo legal, para captar
-- consentimento ESPECÍFICO E DESTACADO do tratamento de dado sensível de saúde
-- no cadastro (comum + professor). requires_acceptance=true → o fluxo existente
-- (recordLegalAcceptance) passa a gravar o aceite automaticamente.
--   Grandfather por ausência: existentes não recadastram (mesma regra do legal-docs).
-- Ver .specs/features/2026-07-21-consentimento-dados-saude/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Expandir o CHECK de doc_type (o inline vira 'legal_documents_doc_type_check')
-- ---------------------------------------------------------------------
alter table public.legal_documents
  drop constraint if exists legal_documents_doc_type_check;

alter table public.legal_documents
  add constraint legal_documents_doc_type_check
  check (doc_type in ('privacidade','termos_uso','termos_contrato','consentimento_saude'));

-- ---------------------------------------------------------------------
-- 2. Seed do consentimento (aponta pra Política de Privacidade, que descreve
--    as finalidades do tratamento do dado de saúde). Idempotente.
-- ---------------------------------------------------------------------
insert into public.legal_documents (doc_type, version, url, title, requires_acceptance) values
  ('consentimento_saude','2026-07-21','https://apppersonafit.vercel.app/legal/privacidade','Consentimento para tratamento de dados de saúde', true)
on conflict (doc_type) do nothing;
