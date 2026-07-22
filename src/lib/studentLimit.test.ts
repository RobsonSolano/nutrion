import { describe, it, expect } from 'vitest';
import { isStudentLimitReached } from './studentLimit';

describe('isStudentLimitReached', () => {
  it('bloqueia quando atinge o limite', () => {
    expect(isStudentLimitReached(5, 5)).toBe(true);
  });

  it('libera quando abaixo do limite', () => {
    expect(isStudentLimitReached(4, 5)).toBe(false);
  });

  it('nunca bloqueia quando o limite é null (premium ilimitado)', () => {
    expect(isStudentLimitReached(99, null)).toBe(false);
  });

  it('bloqueia limite zero já no primeiro', () => {
    expect(isStudentLimitReached(0, 0)).toBe(true);
  });
});
