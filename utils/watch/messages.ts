import { resolvePrIdFromUrl } from '../github/client';
import { updateSettings } from '../storage';

type Msg =
  | { kind: 'watch.addPr'; prId: string }
  | { kind: 'watch.resolvePrId'; url: string };

async function handle(msg: Msg): Promise<unknown> {
  if (msg.kind === 'watch.addPr') {
    await updateSettings((s) => {
      if (!s.watch.explicitPrs.includes(msg.prId)) {
        s.watch.explicitPrs.push(msg.prId);
      }
    });
    return { ok: true };
  }
  return { prId: await resolvePrIdFromUrl(msg.url) };
}

export function registerWatchMessages(): void {
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Msg | undefined;
    if (msg && typeof msg === 'object') {
      handle(msg).then(sendResponse, (err) => {
        console.error('[refocus:messages]', err);
        sendResponse({ ok: false, error: String(err) });
      });
    }
    return true;
  });
}
