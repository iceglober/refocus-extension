import type { Tabs } from 'wxt/browser';

export async function focus(tab: Tabs.Tab): Promise<void> {
  if (tab.id == null || tab.windowId == null) return;
  await browser.tabs.update(tab.id, { active: true });
  await browser.windows.update(tab.windowId, {
    focused: true,
    state: 'normal',
  });
}
