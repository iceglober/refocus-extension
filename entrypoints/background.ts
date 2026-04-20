import {
  activateCandidate,
  activateQueryAsUrl,
} from '@/utils/commandPalette/activate';
import { buildSnapshot } from '@/utils/commandPalette/search';
import type { PaletteCandidate } from '@/utils/commandPalette/types';
import { registerDedupListeners } from '@/utils/dedup';
import { registerAddressBarDedup } from '@/utils/dedup/addressBar';
import { registerGroupingListeners } from '@/utils/grouping';
import { registerLifecycleListeners } from '@/utils/lifecycle';
import { registerLifecycleMessages } from '@/utils/lifecycle/messages';
import { settingsStore } from '@/utils/storage';
import { registerWatchListeners } from '@/utils/watch';
import { registerWatchMessages } from '@/utils/watch/messages';

// URL prefixes where content scripts cannot run; shortcut must fall back to popup.
const UNREACHABLE_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'file://',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
];

function isUnreachablePage(url: string | undefined | null): boolean {
  if (!url) return true;
  return UNREACHABLE_PREFIXES.some((p) => url.startsWith(p));
}

let palettePopupWindowId: number | null = null;

async function openPalettePopup(): Promise<void> {
  if (palettePopupWindowId != null) {
    try {
      await browser.windows.update(palettePopupWindowId, { focused: true });
      return;
    } catch {
      palettePopupWindowId = null;
    }
  }
  try {
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL('command-palette-popup.html'),
      type: 'popup',
      width: 560,
      height: 420,
      focused: true,
    });
    if (win?.id != null) {
      palettePopupWindowId = win.id;
      // Defensive re-focus for mac quirks.
      try {
        await browser.windows.update(win.id, { focused: true });
      } catch {
        /* noop */
      }
    }
  } catch (err) {
    console.error('[refocus:palette] popup open failed', err);
  }
}

async function sendPaletteOpenWithTimeout(
  tabId: number,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    browser.tabs
      .sendMessage(tabId, { kind: 'palette.open' })
      .then(() => {
        clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

async function handlePaletteShortcut(): Promise<void> {
  const settings = await settingsStore.getValue();
  // Command palette is on by default; only early-exit if the user explicitly disabled it.
  if (settings.commandPalette?.enabled === false) return;

  let tab: chrome.tabs.Tab | undefined;
  try {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    tab = tabs[0] as chrome.tabs.Tab | undefined;
  } catch {
    tab = undefined;
  }

  if (!tab || tab.id == null || isUnreachablePage(tab.url)) {
    await openPalettePopup();
    return;
  }

  const delivered = await sendPaletteOpenWithTimeout(tab.id, 300);
  if (!delivered) {
    await openPalettePopup();
  }
}

export default defineBackground(() => {
  console.log('[refocus] background booted');

  registerDedupListeners();
  registerWatchMessages();
  registerLifecycleMessages();
  registerGroupingListeners();

  // Command palette: shortcut listener (top-level).
  browser.commands.onCommand.addListener((command: string) => {
    if (command !== 'open-command-palette') return;
    handlePaletteShortcut().catch((err) =>
      console.error('[refocus:palette]', err),
    );
  });

  // Clear tracked popup id when the user closes it.
  browser.windows.onRemoved.addListener((windowId: number) => {
    if (windowId === palettePopupWindowId) palettePopupWindowId = null;
  });

  // Dedicated palette listener. Kept separate so its `return true` / sendResponse
  // async flow is unambiguous and not entangled with other branches.
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Record<string, unknown> | undefined;
    if (!msg || typeof msg !== 'object') return true;

    if (msg.kind === 'palette.snapshot.request') {
      (async () => {
        try {
          const s = await settingsStore.getValue();
          const cp = s.commandPalette ?? {
            enabled: true,
            includeHistory: true,
            includeBookmarks: true,
            maxResults: 8,
          };
          const snap = await buildSnapshot(
            cp.includeHistory,
            cp.includeBookmarks,
          );
          console.log('[refocus:palette] snapshot built', {
            total: snap.candidates.length,
            tabs: snap.candidates.filter((c) => c.source === 'tab').length,
            bookmarks: snap.candidates.filter((c) => c.source === 'bookmark')
              .length,
            history: snap.candidates.filter((c) => c.source === 'history')
              .length,
            first3: snap.candidates.slice(0, 3).map((c) => ({
              source: c.source,
              title: c.title,
              url: c.url,
            })),
          });
          sendResponse(snap);
        } catch (err) {
          console.error('[refocus:palette] snapshot', err);
          sendResponse({ candidates: [], error: String(err) });
        }
      })();
      return true;
    }

    if (msg.kind === 'palette.activate') {
      const candidate = msg.candidate as PaletteCandidate | undefined;
      const queryAsUrl = msg.queryAsUrl as string | undefined;
      (async () => {
        try {
          if (candidate) {
            await activateCandidate(candidate);
            sendResponse({ ok: true });
            return;
          }
          if (typeof queryAsUrl === 'string') {
            const opened = await activateQueryAsUrl(queryAsUrl);
            sendResponse({ ok: true, opened });
            return;
          }
          sendResponse({ ok: false, error: 'missing candidate or queryAsUrl' });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;
    }

    return true;
  });

  // Main listener for the rest of the extension.
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
