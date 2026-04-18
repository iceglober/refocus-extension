import { canonicalize } from '../normalize';
import { isDisabledHost, matchRule } from '../rules';
import { settingsStore } from '../storage';
import { isInternalUrl, isNewTabPage } from '../urlGuards';
import { findExistingTab } from './findExisting';
import { focus } from './focus';

async function handleAddressBarNav(details: {
  tabId: number;
  frameId: number;
  url: string;
}): Promise<void> {
  if (details.frameId !== 0) return;

  const settings = await settingsStore.getValue();
  if (!settings.dedup.globalEnabled) return;
  if (!settings.dedup.addressBarDedup) return;

  const url = details.url;
  if (!url || isInternalUrl(url) || isNewTabPage(url)) return;
  if (isDisabledHost(url, settings.dedup.disabledHosts)) return;

  let tab;
  try {
    tab = await browser.tabs.get(details.tabId);
  } catch {
    return;
  }
  if (tab.pinned) return;

  const rule = matchRule(url, settings.dedup.rules);
  if (!rule) return;

  const canonical = canonicalize(url, rule.pipeline);
  const existing = await findExistingTab({
    canonical,
    pipeline: rule.pipeline,
    scope: rule.scope,
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
