-- =====================================================================
-- Persona Fit — legal-docs (spec #4)
-- Infra de aceite de documentos legais. O TEXTO vive no hotsite (fonte única);
-- aqui ficam metadados (URL/versão por tipo) + registro de aceite por usuário.
--   L2/L7: sem backfill — usuários existentes não passam por cadastro de novo,
--          logo nunca são re-perguntados (grandfather por ausência).
-- Ver .specs/features/2026-06-22-legal-docs/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. legal_documents — catálogo versionado (URLs do hotsite) ([LEGAL]-01)
-- ---------------------------------------------------------------------
create table if not exists public.legal_documents (
  doc_type text primary key
    check (doc_type in ('privacidade','termos_uso','termos_contrato')),
  version text not null,
  url text not null,
  title text not null,
  requires_acceptance boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.legal_documents is
  'Catálogo de documentos legais (metadados + URL pública do hotsite). Texto não fica aqui.';

-- Seed — URLs reais do hotsite (páginas publicadas em hotsite/public/legal/).
-- version = data da última atualização dos documentos publicados.
insert into public.legal_documents (doc_type, version, url, title, requires_acceptance) values
  ('privacidade',    '2026-07-21','https://personafit.app/legal/privacidade',  'Política de Privacidade', false),
  ('termos_uso',     '2026-07-21','https://personafit.app/legal/termos-de-uso','Termos de Uso',           true),
  ('termos_contrato','2026-07-21','https://personafit.app/legal/contrato',     'Termos de Contrato',      true)
on conflict (doc_type) do nothing;

-- ---------------------------------------------------------------------
-- 2. legal_acceptances — aceite por usuário/versão ([LEGAL]-02)
-- ---------------------------------------------------------------------
create table if not exists public.legal_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, doc_type, version)
);

comment on table public.legal_acceptances is
  'Registro de aceite (auditoria). PK composta torna o registro idempotente por versão.';

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.legal_documents enable row level security;
alter table public.legal_acceptances enable row level security;

-- Catálogo: legível por qualquer autenticado (monta os links do cadastro). Escrita só service_role.
drop policy if exists "legal_documents_read" on public.legal_documents;
create policy "legal_documents_read" on public.legal_documents
  for select to authenticated using (true);

-- Aceite: dono lê e insere o próprio; sem update/delete pelo client.
drop policy if exists "legal_acceptances_select_own" on public.legal_acceptances;
create policy "legal_acceptances_select_own" on public.legal_acceptances
  for select using (auth.uid() = user_id);
drop policy if exists "legal_acceptances_insert_own" on public.legal_acceptances;
create policy "legal_acceptances_insert_own" on public.legal_acceptances
  for insert with check (auth.uid() = user_id);
