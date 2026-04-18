import { settingsStore } from '../storage';
import { findExistingTab } from './findExisting';
import { focus } from './focus';
import { prepareDedup } from './prepare';

async function handleAddressBarNav(details: {
  tabId: number;
  frameId: number;
  url: string;
}): Promise<void> {
  if (details.frameId !== 0) return;

  const settings = await settingsStore.getValue();
  if (!settings.dedup.addressBarDedup) return;

  let tab;
  try {
    tab = await browser.tabs.get(details.tabId);
  } catch {
    return;
  }

  const prep = prepareDedup(details.url, tab.pinned ?? false, settings);
  if (!prep) return;

  const existing = await findExistingTab({
    canonical: prep.canonical,
    pipeline: prep.rule.pipeline,
    scope: prep.rule.scope,
    excludeTabId: details.tabId,
    incognito: tab.incognito,
    windowId: tab.windowId ?? -1,
  });
  if (!existing) return;

  await focus(existing);
  try {
    await browser.tabs.remove(details.tabId);
  } catch {
    /* tab may have already been removed */
  }
}

export function registerAddressBarDedup(): void {
  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    handleAddressBarNav(details).catch((err) =>
      console.error('[refocus:addressBar]', err),
    );
  });
}
