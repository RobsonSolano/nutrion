import { describe, it, expect, vi, beforeEach } from 'vitest';

// expo-router não roda fora do app — mockamos o router imperativo.
const push = vi.fn();
vi.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => push(...a) } }));

import { openPaywall, handleNeedsUpgrade } from './paywall';
import { NeedsUpgradeError } from './needsUpgrade';

beforeEach(() => push.mockClear());

describe('openPaywall', () => {
  it('navega pro paywall com a feature como param', () => {
    openPaywall('chat');
    expect(push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'chat' },
    });
  });
});

describe('handleNeedsUpgrade', () => {
  it('trata NeedsUpgradeError: abre paywall e retorna true', () => {
    expect(handleNeedsUpgrade(new NeedsUpgradeError('coach_generate_plan'))).toBe(true);
    expect(push).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'coach_generate_plan' },
    });
  });

  it('ignora erro comum: retorna false e não navega', () => {
    expect(handleNeedsUpgrade(new Error('rede'))).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
