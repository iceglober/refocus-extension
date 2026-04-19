import type { GroupSettings, TabActivityMap } from '../types';

export async function collapseOldGroups(
  settings: GroupSettings,
  activity: TabActivityMap,
): Promise<void> {
  if (settings.collapseAfterMinutes <= 0) return;

  const threshold = settings.collapseAfterMinutes * 60_000;
  const now = Date.now();
  const groups = await chrome.tabGroups.query({});

  for (const group of groups) {
    if (group.collapsed) continue;

    const tabs = await chrome.tabs.query({ groupId: group.id });
    if (tabs.length === 0) continue;

    const mostRecent = Math.max(
      ...tabs.map((t) => (t.id ? (activity[t.id] ?? 0) : 0)),
    );

    if (now - mostRecent >= threshold) {
      await chrome.tabGroups.update(group.id, { collapsed: true });
    }
  }
}
