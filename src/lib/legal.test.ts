import { describe, it, expect } from 'vitest';
import { requiredAcceptanceDocs } from './legal';
import type { LegalDocument } from '@/types/legal';

const doc = (
  doc_type: LegalDocument['doc_type'],
  requires_acceptance: boolean,
): LegalDocument => ({
  doc_type,
  version: '2026-06-22',
  url: `https://x/${doc_type}`,
  title: doc_type,
  requires_acceptance,
});

describe('requiredAcceptanceDocs', () => {
  it('retorna só os docs que exigem aceite (uso + contrato)', () => {
    const docs = [
      doc('privacidade', false),
      doc('termos_uso', true),
      doc('termos_contrato', true),
    ];
    expect(requiredAcceptanceDocs(docs).map((d) => d.doc_type)).toEqual([
      'termos_uso',
      'termos_contrato',
    ]);
  });

  it('lista vazia → vazio', () => {
    expect(requiredAcceptanceDocs([])).toEqual([]);
  });

  it('só privacidade (sem aceite) → vazio', () => {
    expect(requiredAcceptanceDocs([doc('privacidade', false)])).toEqual([]);
  });

  it('inclui consentimento_saude (dado sensível, art. 11 LGPD) no aceite', () => {
    const docs = [
      doc('privacidade', false),
      doc('termos_uso', true),
      doc('termos_contrato', true),
      doc('consentimento_saude', true),
    ];
    expect(requiredAcceptanceDocs(docs).map((d) => d.doc_type)).toContain(
      'consentimento_saude',
    );
  });
});
