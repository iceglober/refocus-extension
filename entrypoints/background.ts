import { registerDedupListeners } from '@/utils/dedup';
import { registerAddressBarDedup } from '@/utils/dedup/addressBar';
import { registerGroupingListeners } from '@/utils/grouping';
import { registerLifecycleListeners } from '@/utils/lifecycle';
import { registerLifecycleMessages } from '@/utils/lifecycle/messages';
import { registerWatchListeners } from '@/utils/watch';
import { registerWatchMessages } from '@/utils/watch/messages';
import { settingsStore } from '@/utils/storage';

export default defineBackground(() => {
  console.log('[refocus] background booted');

  registerDedupListeners();
  registerWatchMessages();
  registerLifecycleMessages();
  registerGroupingListeners();

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    const msg = raw as Record<string, unknown> | undefined;
    if (!msg || typeof msg !== 'object' || !('kind' in msg)) return true;

    if (msg.kind === 'sidePanel.open' && sender.tab?.windowId) {
      chrome.sidePanel
        .open({ windowId: sender.tab.windowId })
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: String(err) }),
        );
    }
    if (msg.kind === 'settings.get') {
      settingsStore
        .getValue()
        .then(sendResponse)
        .catch(() => sendResponse(null));
    }
    return true;
  });

  chrome.sidePanel.setOptions({ path: 'sidepanel.html' }).catch(() => {});

  registerWatchListeners().catch((err) => console.error('[refocus:watch]', err));
  registerLifecycleListeners().catch((err) =>
    console.error('[refocus:lifecycle]', err),
  );

  (async () => {
    const settings = await settingsStore.getValue();
    if (settings.dedup.addressBarDedup) registerAddressBarDedup();
  })().catch((err) => console.error('[refocus:addressBar]', err));
});
