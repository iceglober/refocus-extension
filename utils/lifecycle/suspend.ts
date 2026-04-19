import { matchHostGlob } from '../rules';
import { settingsStore } from '../storage';
import { safeParse } from '../urlGuards';
import { getActivity } from './activity';

export async function runSuspendCycle(): Promise<void> {
  const settings = await settingsStore.getValue();
  if (!settings.suspend.enabled) return;

  const activity = await getActivity();
  const now = Date.now();
  const threshold = settings.suspend.idleMinutes * 60_000;
  const tabs = await browser.tabs.query({});

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.active) continue;
    if (tab.discarded) continue;
    if (tab.audible) continue;
    if (tab.pinned && !settings.suspend.suspendPinned) continue;

    const url = safeParse(tab.url);
    if (!url) continue;
    if (
      settings.suspend.exemptHosts.some((h) => matchHostGlob(url.host, h))
    )
      continue;

    const lastActive = activity[tab.id] ?? 0;
    if (now - lastActive < threshold) continue;

    try {
      await browser.tabs.discard(tab.id);
    } catch {
      // Tab may have closed between query and discard
    }
  }
}
