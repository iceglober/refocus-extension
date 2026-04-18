import type { CanonicalUrl } from '../types';

const TTL_MS = 2000;

const claims = new Map<
  CanonicalUrl,
  { tabId: number; expiresAt: number }
>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of claims) if (v.expiresAt <= now) claims.delete(k);
}

export const pendingDedup = {
  claim(canonical: CanonicalUrl, tabId: number): boolean {
    sweep();
    if (claims.has(canonical)) return false;
    claims.set(canonical, { tabId, expiresAt: Date.now() + TTL_MS });
    return true;
  },
  release(canonical: CanonicalUrl) {
    claims.delete(canonical);
  },
  // test-only
  _size() {
    return claims.size;
  },
  _clear() {
    claims.clear();
  },
};
