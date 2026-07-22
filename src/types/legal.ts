// Documentos legais (legal-docs, spec #4). O texto vive no hotsite (fonte única);
// o app linka URLs e registra o aceite por versão.

export type LegalDocType =
  | 'privacidade'
  | 'termos_uso'
  | 'termos_contrato'
  | 'consentimento_saude';

export type LegalDocument = {
  doc_type: LegalDocType;
  version: string;
  url: string;
  title: string;
  requires_acceptance: boolean;
};
