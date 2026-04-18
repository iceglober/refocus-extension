import type { Tabs } from 'wxt/browser';
import { canonicalize } from '../normalize';
import { isDisabledHost, matchRule } from '../rules';
import { settingsStore } from '../storage';
import { isInternalUrl, isNewTabPage } from '../urlGuards';
import { findExistingTab } from './findExisting';
import { focus } from './focus';
import { pendingDedup } from './pendingClaim';

export async function handleNewTab(newTab: Tabs.Tab): Promise<void> {
  if (newTab.id == null) return;

  const settings = await settingsStore.getValue();
  if (!settings.dedup.globalEnabled) return;

  const url = newTab.pendingUrl ?? newTab.url;
  if (!url || isInternalUrl(url) || isNewTabPage(url)) return;
  if (newTab.pinned) return;
  if (isDisabledHost(url, settings.dedup.disabledHosts)) return;

  const rule = matchRule(url, settings.dedup.rules);
  if (!rule) return;

  const canonical = canonicalize(url, rule.pipeline);
  if (!pendingDedup.claim(canonical, newTab.id)) return;

  try {
    const existing = await findExistingTab({
      canonical,
      pipeline: rule.pipeline,
      scope: rule.scope,
      excludeTabId: newTab.id,
      incognito: newTab.incognito,
      windowId: newTab.windowId ?? -1,
    });
    if (!existing) return;

    await focus(existing);
    await browser.tabs.remove(newTab.id);
  } finally {
    pendingDedup.release(canonical);
  }
}

export function registerDedupListeners(): void {
  browser.tabs.onCreated.addListener((tab) => {
    handleNewTab(tab).catch((err) => console.error('[refocus:dedup]', err));
  });
}
