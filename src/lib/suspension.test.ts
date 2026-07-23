import { describe, expect, it } from 'vitest';
import { activeIds, suspendedCount } from './suspension';

const s = (id: string, suspended: boolean) => ({
  id,
  suspended_at: suspended ? '2026-07-23T00:00:00Z' : null,
});

describe('suspendedCount', () => {
  it('conta só os suspensos', () => {
    expect(suspendedCount([s('a', false), s('b', true), s('c', true)])).toBe(2);
  });
  it('zero quando ninguém suspenso', () => {
    expect(suspendedCount([s('a', false)])).toBe(0);
  });
  it('lista vazia = 0', () => {
    expect(suspendedCount([])).toBe(0);
  });
});

describe('activeIds', () => {
  it('retorna só os ids com suspended_at null', () => {
    expect(activeIds([s('a', false), s('b', true), s('c', false)])).toEqual(['a', 'c']);
  });
  it('lista vazia = []', () => {
    expect(activeIds([])).toEqual([]);
  });
});
