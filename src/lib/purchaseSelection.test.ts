import { describe, it, expect } from 'vitest';
import { selectProductId, findPackage } from './purchaseSelection';

const pkg = (identifier: string) => ({ product: { identifier } });
const offerings = {
  all: {
    comum: { availablePackages: [pkg('nutrion_comum_pro:mensal')] },
    professor: {
      availablePackages: [
        pkg('nutrion_prof_pro:mensal'),
        pkg('nutrion_prof_premium:mensal'),
      ],
    },
  },
};

describe('selectProductId', () => {
  it('aluno nunca compra → null (IA herdada do professor, C4)', () => {
    expect(
      selectProductId({ role: 'aluno', feature: 'chat', currentTier: 'free' }),
    ).toBeNull();
  });

  it('comum free + IA pessoal → nutrion_comum_pro', () => {
    expect(
      selectProductId({ role: 'comum', feature: 'chat', currentTier: 'free' }),
    ).toBe('nutrion_comum_pro');
    expect(
      selectProductId({
        role: 'comum',
        feature: 'sanity_check',
        currentTier: 'free',
      }),
    ).toBe('nutrion_comum_pro');
  });

  it('comum já pro → null (comum só tem o tier pro)', () => {
    expect(
      selectProductId({ role: 'comum', feature: 'chat', currentTier: 'pro' }),
    ).toBeNull();
  });

  it('professor free → nutrion_prof_pro (libera IA de coach + 20 alunos)', () => {
    expect(
      selectProductId({
        role: 'professor',
        feature: 'coach_generate_plan',
        currentTier: 'free',
      }),
    ).toBe('nutrion_prof_pro');
    expect(
      selectProductId({
        role: 'professor',
        feature: 'student_limit',
        currentTier: 'free',
      }),
    ).toBe('nutrion_prof_pro');
  });

  it('professor pro + limite de alunos → nutrion_prof_premium (ilimitado)', () => {
    expect(
      selectProductId({
        role: 'professor',
        feature: 'student_limit',
        currentTier: 'pro',
      }),
    ).toBe('nutrion_prof_premium');
  });

  it('professor pro + feature de IA (já coberta pelo pro) → null', () => {
    expect(
      selectProductId({
        role: 'professor',
        feature: 'coach_generate_plan',
        currentTier: 'pro',
      }),
    ).toBeNull();
  });

  it('professor premium → null (já é o topo)', () => {
    expect(
      selectProductId({
        role: 'professor',
        feature: 'student_limit',
        currentTier: 'premium',
      }),
    ).toBeNull();
  });

  it('role ausente → null (defensivo)', () => {
    expect(
      selectProductId({ role: null, feature: 'chat', currentTier: 'free' }),
    ).toBeNull();
  });
});

describe('findPackage', () => {
  it('acha por prefixo productId:basePlan (formato Google)', () => {
    expect(findPackage(offerings, 'nutrion_comum_pro')?.product.identifier).toBe(
      'nutrion_comum_pro:mensal',
    );
    expect(findPackage(offerings, 'nutrion_prof_premium')?.product.identifier).toBe(
      'nutrion_prof_premium:mensal',
    );
  });

  it('acha por igualdade exata', () => {
    const exact = { all: { o: { availablePackages: [pkg('nutrion_comum_pro')] } } };
    expect(findPackage(exact, 'nutrion_comum_pro')?.product.identifier).toBe(
      'nutrion_comum_pro',
    );
  });

  it('não achou → null', () => {
    expect(findPackage(offerings, 'inexistente')).toBeNull();
  });

  it('offerings null/undefined → null (defensivo)', () => {
    expect(findPackage(null, 'nutrion_comum_pro')).toBeNull();
    expect(findPackage(undefined, 'nutrion_comum_pro')).toBeNull();
  });
});
