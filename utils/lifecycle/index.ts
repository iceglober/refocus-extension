import { collapseOldGroups } from '../grouping/collapse';
import { settingsStore } from '../storage';
import { recordActivity, removeActivity } from './activity';
import { getActivity } from './activity';
import { runStaleCycle } from './stale';
import { runSuspendCycle } from './suspend';

const ALARM_NAME = 'refocus:tab-lifecycle';

async function refreshAlarm(): Promise<void> {
  const settings = await settingsStore.getValue();
  const needed =
    settings.suspend.enabled ||
    settings.stale.enabled ||
    (settings.groups.enabled && settings.groups.collapseAfterMinutes > 0);

  await browser.alarms.clear(ALARM_NAME);
  if (needed) {
    await browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }
}

async function runLifecycleCycle(): Promise<void> {
  const settings = await settingsStore.getValue();
  await runSuspendCycle();
  await runStaleCycle();
  if (settings.groups.enabled && settings.groups.collapseAfterMinutes > 0) {
    const activity = await getActivity();
    await collapseOldGroups(settings.groups, activity);
  }
}

export async function registerLifecycleListeners(): Promise<void> {
  browser.tabs.onActivated.addListener(({ tabId }) => {
    recordActivity(tabId);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    removeActivity(tabId);
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    runLifecycleCycle().catch((err) =>
      console.error('[refocus:lifecycle]', err),
    );
  });

  await refreshAlarm();
  settingsStore.watch(() => {
    refreshAlarm().catch((err) =>
      console.error('[refocus:lifecycle:alarm]', err),
    );
  });
}
