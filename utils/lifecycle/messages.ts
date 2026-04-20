import { getStaleTabs } from './stale';

type Msg =
  | { kind: 'lifecycle.getStaleTabs' }
  | { kind: 'lifecycle.discardTab'; tabId: number }
  | { kind: 'lifecycle.closeTab'; tabId: number };

async function handle(msg: Msg): Promise<unknown> {
  if (msg.kind === 'lifecycle.getStaleTabs') {
    return { tabs: await getStaleTabs() };
  }
  if (msg.kind === 'lifecycle.discardTab') {
    await browser.tabs.discard(msg.tabId).catch(() => {});
    return { ok: true };
  }
  if (msg.kind === 'lifecycle.closeTab') {
    await browser.tabs.remove(msg.tabId).catch(() => {});
    return { ok: true };
  }
  return { ok: false };
}

export function registerLifecycleMessages(): void {
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Msg | undefined;
    if (msg && typeof msg === 'object' && 'kind' in msg) {
      if (!msg.kind.startsWith('lifecycle.')) return true;
      handle(msg).then(sendResponse, (err) => {
        console.error('[refocus:lifecycle:messages]', err);
        sendResponse({ ok: false, error: String(err) });
      });
    }
    return true;
  });
}
