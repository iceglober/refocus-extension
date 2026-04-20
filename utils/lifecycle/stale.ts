import { settingsStore, staleNotifiedStore } from '../storage';
import { getActivity } from './activity';

export interface StaleTab {
  tabId: number;
  title: string;
  url: string;
  lastActiveAt: number;
}

export async function getStaleTabs(): Promise<StaleTab[]> {
  const settings = await settingsStore.getValue();
  if (!settings.stale.enabled) return [];

  const activity = await getActivity();
  const now = Date.now();
  const threshold = settings.stale.staleAfterHours * 3_600_000;
  const tabs = await browser.tabs.query({});
  const stale: StaleTab[] = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.active) continue;
    if (tab.pinned) continue;
    if (tab.audible) continue;

    const lastActive = activity[tab.id] ?? 0;
    if (now - lastActive < threshold) continue;

    stale.push({
      tabId: tab.id,
      title: tab.title ?? tab.url,
      url: tab.url,
      lastActiveAt: lastActive,
    });
  }

  return stale.sort((a, b) => a.lastActiveAt - b.lastActiveAt);
}

export async function runStaleCycle(): Promise<void> {
  const settings = await settingsStore.getValue();
  if (!settings.stale.enabled) return;

  const stale = await getStaleTabs();
  if (stale.length === 0) return;

  const notified = await staleNotifiedStore.getValue();
  const now = Date.now();
  const graceMs = settings.stale.graceMinutes * 60_000;

  const pastGrace: StaleTab[] = [];
  const newlyStale: StaleTab[] = [];

  for (const tab of stale) {
    const notifiedAt = notified[tab.tabId];
    if (notifiedAt && now - notifiedAt >= graceMs) {
      pastGrace.push(tab);
    } else if (!notifiedAt) {
      newlyStale.push(tab);
    }
  }

  if (pastGrace.length > 0) {
    const toClose = pastGrace.slice(0, settings.stale.maxAutoClose);
    const ids = toClose.map((t) => t.tabId);
    try {
      await browser.tabs.remove(ids);
    } catch {
      // Some tabs may have already been closed
    }
    const next = { ...notified };
    for (const id of ids) delete next[id];
    await staleNotifiedStore.setValue(next);
  }

  if (newlyStale.length > 0) {
    const titles = newlyStale
      .slice(0, 5)
      .map((t) => t.title)
      .join('\n');
    const extra =
      newlyStale.length > 5 ? `\n+${newlyStale.length - 5} more` : '';

    await browser.notifications.create(`refocus:stale-${now}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: `${newlyStale.length} stale tab${newlyStale.length > 1 ? 's' : ''}`,
      message: `${titles}${extra}\nThey'll auto-close after ${settings.stale.graceMinutes}m if not visited.`,
    });

    const next = { ...notified };
    for (const tab of newlyStale) next[tab.tabId] = now;
    await staleNotifiedStore.setValue(next);
  }
}
