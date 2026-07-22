import type { LegalDocument } from '@/types/legal';

/** Documentos que exigem aceite explícito no cadastro (Termos de Uso + Contrato). */
export function requiredAcceptanceDocs(docs: LegalDocument[]): LegalDocument[] {
  return docs.filter((d) => d.requires_acceptance);
}
