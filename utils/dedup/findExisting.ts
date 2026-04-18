import type { Tabs } from 'wxt/browser';
import { canonicalize } from '../normalize';
import type { CanonicalUrl, NormalizerSpec } from '../types';

export interface FindArgs {
  canonical: CanonicalUrl;
  pipeline: readonly NormalizerSpec[];
  scope: 'profile' | 'window';
  excludeTabId: number;
  incognito: boolean;
  windowId: number;
}

export async function findExistingTab(
  args: FindArgs,
): Promise<Tabs.Tab | null> {
  const query = args.scope === 'window' ? { windowId: args.windowId } : {};
  const tabs = await browser.tabs.query(query);

  for (const t of tabs) {
    if (t.id === args.excludeTabId) continue;
    if (t.incognito !== args.incognito) continue;
    if (!t.url) continue;
    if (canonicalize(t.url, args.pipeline) === args.canonical) return t;
  }
  return null;
}
