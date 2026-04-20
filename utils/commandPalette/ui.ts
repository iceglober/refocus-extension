import { queryLooksLikeDomain } from './activate';
import { filterAndRank } from './search';
import { PALETTE_CSS } from './styles';
import type { PaletteCandidate, PaletteSnapshot } from './types';

export interface PaletteServices {
  requestSnapshot: () => Promise<PaletteSnapshot>;
  activate: (candidate: PaletteCandidate) => Promise<void>;
  activateQueryAsUrl: (query: string) => Promise<boolean>;
  maxResults: number;
  onClose: () => void;
  /** Whether the palette is rendered as an overlay (content script) vs inside
   * a dedicated window (popup). Affects the backdrop styling. */
  embedded?: boolean;
}

/**
 * Render the command palette inside `root`. Returns a cleanup function.
 *
 * Idempotent: if a palette is already mounted in this root, re-focuses the
 * existing input and returns a no-op cleanup.
 */
export function renderPalette(
  root: Element,
  services: PaletteServices,
): () => void {
  console.log('[refocus:palette] renderPalette called', {
    rootTag: (root as HTMLElement).tagName,
    embedded: services.embedded,
  });
  const existing = root.querySelector(
    '[data-palette-root]',
  ) as HTMLElement | null;
  if (existing) {
    console.log('[refocus:palette] already mounted, refocusing');
    const existingInput = existing.querySelector(
      '[data-palette-input]',
    ) as HTMLInputElement | null;
    existingInput?.focus();
    existingInput?.select();
    return () => {};
  }

  const ownerDocument = (root as HTMLElement).ownerDocument ?? document;

  const styleEl = ownerDocument.createElement('style');
  styleEl.textContent = PALETTE_CSS;
  root.appendChild(styleEl);

  const wrapper = ownerDocument.createElement('div');
  wrapper.setAttribute('data-palette-root', '');
  if (services.embedded) wrapper.setAttribute('data-embedded', 'true');
  wrapper.innerHTML = `
    <div data-palette-card role="dialog" aria-modal="true" aria-label="Command palette">
      <input data-palette-input type="text" autocomplete="off" spellcheck="false" placeholder="Search tabs, history, bookmarks…" />
      <ul data-palette-list role="listbox"></ul>
      <div data-palette-empty hidden>No matches.</div>
      <div data-palette-hint hidden></div>
    </div>
  `;
  root.appendChild(wrapper);

  const input = wrapper.querySelector<HTMLInputElement>(
    '[data-palette-input]',
  )!;
  const list = wrapper.querySelector<HTMLUListElement>(
    '[data-palette-list]',
  )!;
  const emptyEl = wrapper.querySelector<HTMLDivElement>(
    '[data-palette-empty]',
  )!;
  const hintEl = wrapper.querySelector<HTMLDivElement>(
    '[data-palette-hint]',
  )!;

  let snapshot: PaletteSnapshot | null = null;
  let current: PaletteCandidate[] = [];
  let selectedIndex = 0;
  let isMounted = true;

  function render(): void {
    list.textContent = '';
    if (current.length === 0) {
      const q = input.value.trim();
      if (!snapshot) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Loading…';
      } else if (q) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'No matches.';
      } else {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Start typing to search your tabs.';
      }
      if (q && snapshot && queryLooksLikeDomain(q)) {
        hintEl.hidden = false;
        hintEl.textContent = `Press Enter to open https://${q}`;
      } else {
        hintEl.hidden = true;
      }
      return;
    }
    emptyEl.hidden = true;
    hintEl.hidden = true;
    for (let i = 0; i < current.length; i++) {
      const c = current[i];
      if (!c) continue;
      const li = ownerDocument.createElement('li');
      li.setAttribute('role', 'option');
      if (i === selectedIndex) li.setAttribute('aria-selected', 'true');
      li.dataset.index = String(i);

      const titleEl = ownerDocument.createElement('div');
      titleEl.className = 'title';
      const sourceBadge = ownerDocument.createElement('span');
      sourceBadge.className = 'source';
      sourceBadge.textContent = c.source;
      titleEl.appendChild(sourceBadge);
      titleEl.appendChild(ownerDocument.createTextNode(c.title));

      const urlEl = ownerDocument.createElement('div');
      urlEl.className = 'url';
      urlEl.textContent = c.url;

      li.appendChild(titleEl);
      li.appendChild(urlEl);
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectedIndex = i;
        void activateSelected();
      });
      list.appendChild(li);
    }
  }

  function recompute(): void {
    if (!snapshot) {
      current = [];
      selectedIndex = 0;
      render();
      return;
    }
    current = filterAndRank(input.value, snapshot, services.maxResults);
    console.log('[refocus:palette] recompute', {
      query: input.value,
      snapshotCount: snapshot.candidates?.length ?? 0,
      matched: current.length,
    });
    if (selectedIndex >= current.length) selectedIndex = 0;
    render();
  }

  async function activateSelected(): Promise<void> {
    const q = input.value.trim();
    if (current.length === 0) {
      if (q && queryLooksLikeDomain(q)) {
        const ok = await services.activateQueryAsUrl(q);
        if (ok && isMounted) services.onClose();
      }
      return;
    }
    const candidate = current[selectedIndex];
    if (!candidate) return;
    try {
      await services.activate(candidate);
    } finally {
      if (isMounted) services.onClose();
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (current.length > 0) {
        selectedIndex = (selectedIndex + 1) % current.length;
        render();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + current.length) % current.length;
        render();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void activateSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (isMounted) services.onClose();
    }
  }

  input.addEventListener('keydown', (e) => {
    console.log('[refocus:palette] keydown', e.key);
    onKeyDown(e);
  });
  input.addEventListener('input', () => {
    console.log('[refocus:palette] input event', input.value);
    recompute();
  });

  // Close when clicking the backdrop.
  wrapper.addEventListener('mousedown', (e) => {
    if (e.target === wrapper && isMounted) services.onClose();
  });

  // Kick off snapshot load.
  console.log('[refocus:palette] ui mounted, requesting snapshot');
  void (async () => {
    try {
      console.log('[refocus:palette] awaiting snapshot');
      const snap = await services.requestSnapshot();
      console.log('[refocus:palette] snapshot received by ui', {
        isMounted,
        count: snap?.candidates?.length ?? 0,
      });
      if (!isMounted) return;
      snapshot = snap;
      recompute();
    } catch (err) {
      if (!isMounted) return;
      console.error('[refocus:palette] snapshot failed', err);
      emptyEl.hidden = false;
      emptyEl.textContent = 'Failed to load. Check permissions in Options.';
    }
  })();

  // Focus the input after mount.
  setTimeout(() => {
    if (isMounted) input.focus();
  }, 0);
  render();

  return () => {
    isMounted = false;
    input.removeEventListener('keydown', onKeyDown);
    wrapper.remove();
    styleEl.remove();
  };
}
