import { resolvePrIdFromUrl } from '../github/client';
import { settingsStore } from '../storage';

type Msg =
  | { kind: 'watch.addPr'; prId: string }
  | { kind: 'watch.resolvePrId'; url: string };

export function registerWatchMessages(): void {
  browser.runtime.onMessage.addListener(((
    raw: unknown,
    _sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => {
    const msg = raw as Msg | undefined;
    if (!msg || typeof msg !== 'object') return undefined;

    (async () => {
      if (msg.kind === 'watch.addPr') {
        const settings = await settingsStore.getValue();
        if (!settings.watch.explicitPrs.includes(msg.prId)) {
          const next = structuredClone(settings);
          next.watch.explicitPrs.push(msg.prId);
          await settingsStore.setValue(next);
        }
        sendResponse({ ok: true });
        return;
      }
      if (msg.kind === 'watch.resolvePrId') {
        const id = await resolvePrIdFromUrl(msg.url);
        sendResponse({ prId: id });
        return;
      }
    })().catch((err) => {
      console.error('[refocus:messages]', err);
      sendResponse({ ok: false, error: String(err) });
    });
    return true as const; // async
  }) as unknown as Parameters<typeof browser.runtime.onMessage.addListener>[0]);
}
