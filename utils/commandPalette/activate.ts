import { focus } from '../dedup/focus';
import type { PaletteCandidate } from './types';

const DOMAIN_LIKE =
  /^[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})(\/\S*)?$/i;

export async function activateCandidate(
  candidate: PaletteCandidate,
): Promise<void> {
  if (candidate.source === 'tab' && candidate.tabId != null) {
    try {
      const tab = await browser.tabs.get(candidate.tabId);
      await focus(tab);
      return;
    } catch {
      // Tab closed since snapshot — fall through to open-by-URL.
    }
  }
  await browser.tabs.create({ url: candidate.url, active: true });
}

/**
 * If `query` looks like a domain, open it as https://<query> in a new tab
 * and return true. Otherwise return false and do nothing.
 */
export async function activateQueryAsUrl(query: string): Promise<boolean> {
  const q = query.trim();
  if (!q) return false;
  if (!DOMAIN_LIKE.test(q)) return false;
  const url = q.startsWith('http://') || q.startsWith('https://')
    ? q
    : `https://${q}`;
  await browser.tabs.create({ url, active: true });
  return true;
}

export function queryLooksLikeDomain(query: string): boolean {
  return DOMAIN_LIKE.test(query.trim());
}
