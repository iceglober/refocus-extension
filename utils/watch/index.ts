import { settingsStore } from '../storage';
import { registerNotificationHandlers } from './notify';
import { runPollCycle } from './poll';

const ALARM_NAME = 'refocus:watch-poll';

export async function registerWatchListeners(): Promise<void> {
  registerNotificationHandlers();

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    runPollCycle().catch((err) => console.error('[refocus:watch]', err));
  });

  await refreshAlarm();

  // Re-register whenever settings change
  settingsStore.watch(() => {
    refreshAlarm().catch((err) => console.error('[refocus:watch]', err));
  });
}

async function refreshAlarm(): Promise<void> {
  const settings = await settingsStore.getValue();
  await browser.alarms.clear(ALARM_NAME);
  if (!settings.watch.enabled) return;

  // browser minimum period is 0.5 min in production.
  const mins = Math.max(settings.watch.pollIntervalSec / 60, 0.5);
  browser.alarms.create(ALARM_NAME, { periodInMinutes: mins });
}
