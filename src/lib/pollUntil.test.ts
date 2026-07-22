import { describe, it, expect, vi } from 'vitest';
import { pollUntil } from './pollUntil';

const noSleep = () => Promise.resolve();

describe('pollUntil', () => {
  it('satisfaz de primeira → 1 tentativa, sem sleep', async () => {
    const fn = vi.fn().mockResolvedValue('pro');
    const sleep = vi.fn(noSleep);
    const r = await pollUntil({
      fn,
      done: (v) => v === 'pro',
      retries: 4,
      sleep,
    });
    expect(r).toEqual({ value: 'pro', satisfied: true, attempts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('satisfaz após algumas tentativas (webhook atrasa)', async () => {
    const seq = ['free', 'free', 'pro'];
    const fn = vi.fn(() => Promise.resolve(seq.shift()));
    const sleep = vi.fn(noSleep);
    const r = await pollUntil({
      fn,
      done: (v) => v === 'pro',
      retries: 5,
      sleep,
    });
    expect(r.satisfied).toBe(true);
    expect(r.value).toBe('pro');
    expect(r.attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2); // dorme entre as tentativas, não após a última
  });

  it('desiste após `retries` se nunca satisfaz', async () => {
    const fn = vi.fn().mockResolvedValue('free');
    const sleep = vi.fn(noSleep);
    const r = await pollUntil({
      fn,
      done: (v) => v === 'pro',
      retries: 3,
      sleep,
    });
    expect(r).toEqual({ value: 'free', satisfied: false, attempts: 3 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2); // 2 esperas entre 3 tentativas
  });

  it('backoff linear: delayMs * número da tentativa', async () => {
    const fn = vi.fn().mockResolvedValue('free');
    const delays: number[] = [];
    const sleep = vi.fn((ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    });
    await pollUntil({ fn, done: () => false, retries: 3, delayMs: 100, sleep });
    expect(delays).toEqual([100, 200]);
  });
});
