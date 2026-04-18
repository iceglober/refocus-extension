import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingDedup } from '@/utils/dedup/pendingClaim';
import type { CanonicalUrl } from '@/utils/types';

const url = (s: string) => s as CanonicalUrl;

beforeEach(() => {
  pendingDedup._clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('pendingDedup', () => {
  it('allows the first claim', () => {
    expect(pendingDedup.claim(url('https://a/'), 1)).toBe(true);
  });

  it('rejects concurrent claim for same canonical', () => {
    pendingDedup.claim(url('https://a/'), 1);
    expect(pendingDedup.claim(url('https://a/'), 2)).toBe(false);
  });

  it('release() frees the claim immediately', () => {
    pendingDedup.claim(url('https://a/'), 1);
    pendingDedup.release(url('https://a/'));
    expect(pendingDedup.claim(url('https://a/'), 2)).toBe(true);
  });

  it('claims expire after the TTL (2s)', () => {
    pendingDedup.claim(url('https://a/'), 1);
    vi.advanceTimersByTime(2001);
    expect(pendingDedup.claim(url('https://a/'), 2)).toBe(true);
  });

  it('different canonicals do not collide', () => {
    expect(pendingDedup.claim(url('https://a/'), 1)).toBe(true);
    expect(pendingDedup.claim(url('https://b/'), 2)).toBe(true);
  });
});
