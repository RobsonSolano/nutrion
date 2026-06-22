import { describe, it, expect } from 'vitest';
import { trialDaysLeft } from './trial';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000; // base fixa (sem Date.now real no teste)

describe('trialDaysLeft', () => {
  it('retorna 0 quando trial_end é null', () => {
    expect(trialDaysLeft(null, NOW)).toBe(0);
  });

  it('retorna 7 no início de um trial de 7 dias', () => {
    expect(trialDaysLeft(new Date(NOW + 7 * DAY).toISOString(), NOW)).toBe(7);
  });

  it('arredonda pra cima no último dia (1 dia restante)', () => {
    expect(trialDaysLeft(new Date(NOW + 3600_000).toISOString(), NOW)).toBe(1);
  });

  it('retorna 0 quando já expirou', () => {
    expect(trialDaysLeft(new Date(NOW - 3600_000).toISOString(), NOW)).toBe(0);
  });
});
