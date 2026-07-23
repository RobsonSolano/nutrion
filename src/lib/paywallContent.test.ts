import { describe, it, expect } from 'vitest';
import { paywallContent } from './paywallContent';
import { planContent } from './paywallContent';

describe('paywallContent', () => {
  it('chat e sanity_check apontam pro plano pessoal', () => {
    for (const f of ['chat', 'sanity_check'] as const) {
      const c = paywallContent(f);
      expect(c.planLabel.toLowerCase()).toContain('pessoal');
      expect(c.bullets.length).toBeGreaterThan(0);
      expect(c.priceHint).toBeTruthy();
    }
  });

  it('features de coach apontam pro plano de professor', () => {
    for (const f of ['coach_generate_plan', 'coach_import_workout'] as const) {
      const c = paywallContent(f);
      expect(c.planLabel.toLowerCase()).toContain('professor');
    }
  });

  it('student_limit fala de mais alunos, não de IA', () => {
    const c = paywallContent('student_limit');
    expect(c.title.toLowerCase()).toContain('aluno');
    expect(c.bullets.join(' ').toLowerCase()).not.toContain('chat ia');
  });

  it('feature desconhecida/undefined cai num default seguro (não lança)', () => {
    expect(() => paywallContent(undefined)).not.toThrow();
    const c = paywallContent('xpto');
    expect(c.title).toBeTruthy();
    expect(c.bullets.length).toBeGreaterThan(0);
  });
});

describe('planContent', () => {
  it('professor pro: nome Pro, sem highlight, fala em 5 alunos', () => {
    const c = planContent('pro', 'professor');
    expect(c.name).toBe('Pro');
    expect(c.highlight).toBeFalsy();
    expect(c.bullets.some((b) => b.includes('5 alunos'))).toBe(true);
  });
  it('professor premium: nome Premium, highlight, fala em ilimitado', () => {
    const c = planContent('premium', 'professor');
    expect(c.name).toBe('Premium');
    expect(c.highlight).toBe(true);
    expect(c.bullets.some((b) => b.toLowerCase().includes('ilimitado'))).toBe(true);
  });
  it('comum pro: bullets pessoais (chat IA)', () => {
    const c = planContent('pro', 'comum');
    expect(c.name).toBe('Pro');
    expect(c.bullets.some((b) => b.toLowerCase().includes('chat ia'))).toBe(true);
  });
});
