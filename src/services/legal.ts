import { supabase } from './supabase';
import { requiredAcceptanceDocs } from '@/lib/legal';
import type { LegalDocument } from '@/types/legal';

/** Catálogo de documentos legais (metadados + URLs do hotsite). */
export async function fetchLegalDocuments(): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('doc_type, version, url, title, requires_acceptance');
  if (error) throw error;
  return (data ?? []) as LegalDocument[];
}

/**
 * Registra o aceite dos documentos que exigem aceite (Uso + Contrato) na versão atual,
 * para o usuário autenticado. Idempotente: a PK (user_id, doc_type, version) + ignoreDuplicates
 * tornam seguro chamar após cada cadastro / sign-in com Google.
 */
export async function recordLegalAcceptance(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const docs = await fetchLegalDocuments();
  const rows = requiredAcceptanceDocs(docs).map((d) => ({
    user_id: user.id,
    doc_type: d.doc_type,
    version: d.version,
  }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('legal_acceptances')
    .upsert(rows, { onConflict: 'user_id,doc_type,version', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Versão best-effort pros call sites de cadastro: o consentimento já foi dado na UI;
 * o registro é auditoria e não deve derrubar a entrada do usuário recém-criado.
 */
export async function recordLegalAcceptanceSafe(): Promise<void> {
  try {
    await recordLegalAcceptance();
  } catch (e) {
    console.warn('[legal] recordLegalAcceptance:', e);
  }
}
