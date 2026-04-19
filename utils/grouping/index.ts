import { settingsStore } from '../storage';
import { assignTabToGroup } from './assign';

export function registerGroupingListeners(): void {
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;
    const settings = await settingsStore.getValue();
    if (!settings.groups.enabled) return;
    await assignTabToGroup(
      tabId,
      tab.url,
      tab.windowId!,
      tab.groupId ?? -1,
      settings.groups,
    );
  });

  browser.tabs.onCreated.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;
    const settings = await settingsStore.getValue();
    if (!settings.groups.enabled) return;
    await assignTabToGroup(
      tab.id,
      tab.url,
      tab.windowId!,
      tab.groupId ?? -1,
      settings.groups,
    );
  });
}
