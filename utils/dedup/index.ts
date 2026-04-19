import type { Tabs } from 'wxt/browser';
import { settingsStore } from '../storage';
import { findExistingTab } from './findExisting';
import { focus } from './focus';
import { pendingDedup } from './pendingClaim';
import { prepareDedup } from './prepare';

export async function handleNewTab(newTab: Tabs.Tab): Promise<void> {
  if (newTab.id == null) return;

  const settings = await settingsStore.getValue();
  const url = newTab.pendingUrl ?? newTab.url;
  const prep = prepareDedup(url, newTab.pinned ?? false, settings);
  if (!prep) return;

  if (!pendingDedup.claim(prep.canonical, newTab.id)) return;

  try {
    const existing = await findExistingTab({
      canonical: prep.canonical,
      pipeline: prep.rule.pipeline,
      scope: prep.rule.scope,
      excludeTabId: newTab.id,
      incognito: newTab.incognito,
      windowId: newTab.windowId ?? -1,
    });
    if (!existing) return;

    await focus(existing);
    await browser.tabs.remove(newTab.id);
  } finally {
    pendingDedup.release(prep.canonical);
  }
}

export function registerDedupListeners(): void {
  browser.tabs.onCreated.addListener((tab) => {
    handleNewTab(tab).catch((err) => console.error('[refocus:dedup]', err));
  });
}
