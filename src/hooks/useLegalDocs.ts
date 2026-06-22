import { useQuery } from '@tanstack/react-query';
import { fetchLegalDocuments } from '@/services/legal';
import { queryKeys } from '@/lib/queryKeys';
import type { LegalDocType, LegalDocument } from '@/types/legal';

/**
 * Catálogo de documentos legais (URLs do hotsite + versões). Muda raramente → staleTime alto.
 * `byType` facilita montar os links no cadastro.
 */
export function useLegalDocs() {
  const query = useQuery({
    queryKey: queryKeys.legalDocuments(),
    queryFn: fetchLegalDocuments,
    staleTime: 5 * 60_000,
  });

  const byType = (doc_type: LegalDocType): LegalDocument | undefined =>
    query.data?.find((d) => d.doc_type === doc_type);

  return { ...query, byType };
}
