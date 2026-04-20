import { renderPalette } from '@/utils/commandPalette/ui';
import type {
  PaletteCandidate,
  PaletteSnapshot,
} from '@/utils/commandPalette/types';

const root = document.getElementById('app')!;

renderPalette(root, {
  embedded: true,
  maxResults: 8,
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
  onClose: () => {
    window.close();
  },
});
