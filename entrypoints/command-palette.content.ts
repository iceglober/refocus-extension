import { createShadowRootUi } from 'wxt/client';
import { renderPalette } from '@/utils/commandPalette/ui';
import type {
  PaletteCandidate,
  PaletteSnapshot,
} from '@/utils/commandPalette/types';

export default defineContentScript({
  matches: ['https://*/*'],
  async main(ctx) {
    let cleanup: (() => void) | null = null;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    function unmount(): void {
      try {
        cleanup?.();
      } catch {
        /* noop */
      }
      cleanup = null;
      try {
        ui?.remove();
      } catch {
        /* noop */
      }
      ui = null;
    }

    async function openPalette(): Promise<void> {
      if (ui) {
        // Re-focus existing palette instead of remounting.
        const shadow = ui.shadow;
        const input = shadow?.querySelector(
          '[data-palette-input]',
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select();
        return;
      }
      ui = await createShadowRootUi(ctx, {
        name: 'refocus-command-palette',
        position: 'overlay',
        zIndex: 2147483647,
        onMount(container) {
          cleanup = renderPalette(container, {
            requestSnapshot: async (): Promise<PaletteSnapshot> => {
              const res = (await browser.runtime.sendMessage({
                kind: 'palette.snapshot.request',
              })) as PaletteSnapshot | null | undefined;
              console.log('[refocus:palette] snapshot response', res);
              if (!res || !Array.isArray((res as PaletteSnapshot).candidates)) {
                return { candidates: [] };
              }
              return res;
            },
            activate: async (c: PaletteCandidate) => {
              await browser.runtime.sendMessage({
                kind: 'palette.activate',
                candidate: c,
              });
            },
            activateQueryAsUrl: async (q: string) => {
              const res = (await browser.runtime.sendMessage({
                kind: 'palette.activate',
                queryAsUrl: q,
              })) as { opened?: boolean } | null;
              return Boolean(res?.opened);
            },
            maxResults: 8,
            onClose: () => unmount(),
          });
        },
      });
      ui.mount();
    }

    // IMPORTANT: register the listener synchronously at boot, before any await,
    // so no 'palette.open' message is lost to a late registration.
    browser.runtime.onMessage.addListener((raw: unknown) => {
      const msg = raw as { kind?: string } | undefined;
      if (msg?.kind === 'palette.open') {
        openPalette().catch((err) =>
          console.error('[refocus:palette]', err),
        );
      }
      return undefined;
    });

    ctx.onInvalidated(() => unmount());
  },
});
