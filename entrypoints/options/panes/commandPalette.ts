import { updateSettings } from '@/utils/storage';
import type { Settings } from '@/utils/types';

export function renderCommandPalettePane(
  root: HTMLElement,
  settings: Settings,
): void {
  const cp = settings.commandPalette;
  root.innerHTML = `
    <h2>Command Palette</h2>
    <p class="muted">A Raycast/Spotlight-style palette that opens in the page. Type to fuzzy-match across open tabs, browser history, and bookmarks. Enter switches to an existing tab or opens a new one.</p>

    <div class="row">
      <label><input type="checkbox" id="cp-enabled" ${cp.enabled ? 'checked' : ''} /> Enabled</label>
    </div>

    <div class="row">
      <label><input type="checkbox" id="cp-history" ${cp.includeHistory ? 'checked' : ''} /> Include browser history</label>
    </div>
    <div class="row">
      <label><input type="checkbox" id="cp-bookmarks" ${cp.includeBookmarks ? 'checked' : ''} /> Include bookmarks</label>
    </div>

    <h2>Keyboard Shortcut</h2>
    <p class="muted">Default: <kbd>Ctrl</kbd> + <kbd>.</kbd> (on macOS: <kbd>⌘</kbd> + <kbd>.</kbd>). Some sites (Google Docs, code editors) may capture keyboard shortcuts before the extension sees them. Rebind if needed.</p>
    <div class="row">
      <button id="cp-configure-shortcut" class="primary">Configure shortcut</button>
    </div>
  `;

  const enabledInput = root.querySelector<HTMLInputElement>('#cp-enabled')!;
  const historyInput = root.querySelector<HTMLInputElement>('#cp-history')!;
  const bookmarksInput = root.querySelector<HTMLInputElement>('#cp-bookmarks')!;

  enabledInput.addEventListener('change', () => {
    updateSettings((s) => {
      s.commandPalette.enabled = enabledInput.checked;
    });
  });

  historyInput.addEventListener('change', () => {
    updateSettings((s) => {
      s.commandPalette.includeHistory = historyInput.checked;
    });
  });

  bookmarksInput.addEventListener('change', () => {
    updateSettings((s) => {
      s.commandPalette.includeBookmarks = bookmarksInput.checked;
    });
  });

  root
    .querySelector<HTMLButtonElement>('#cp-configure-shortcut')!
    .addEventListener('click', () => {
      browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
}
