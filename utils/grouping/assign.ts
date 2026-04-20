import { matchHostGlob } from '../rules';
import type { GroupSettings, TabGroupColor } from '../types';
import { safeParse } from '../urlGuards';

const COLORS: TabGroupColor[] = [
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
  'grey',
];

function hashColor(host: string): TabGroupColor {
  let hash = 0;
  for (let i = 0; i < host.length; i++) {
    hash = (hash * 31 + host.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export async function assignTabToGroup(
  tabId: number,
  tabUrl: string,
  windowId: number,
  currentGroupId: number,
  settings: GroupSettings,
): Promise<void> {
  const url = safeParse(tabUrl);
  if (!url) return;

  let title: string | undefined;
  let color: TabGroupColor | undefined;

  if (settings.mode === 'domain') {
    title = url.hostname;
    color = hashColor(url.hostname);
  } else {
    for (const rule of settings.rules) {
      if (!rule.enabled) continue;
      if (matchHostGlob(url.host, rule.hostGlob)) {
        title = rule.groupTitle;
        color = rule.color;
        break;
      }
    }
  }

  if (!title) return;

  const existing = await chrome.tabGroups.query({ title, windowId });
  const group = existing[0];

  if (group) {
    if (currentGroupId === group.id) return;
    await chrome.tabs.group({ tabIds: [tabId], groupId: group.id });
  } else {
    const groupId = await chrome.tabs.group({
      tabIds: [tabId],
      createProperties: { windowId },
    });
    await chrome.tabGroups.update(groupId, { title, color });
  }
}
