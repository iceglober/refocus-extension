import { DEFAULT_SETTINGS } from '@/utils/defaults';
import { settingsStore } from '@/utils/storage';
import type { Settings } from '@/utils/types';

export function renderImportExportPane(root: HTMLElement, settings: Settings) {
  root.innerHTML = `
    <h2>Import / Export</h2>
    <p class="muted">Settings only — tokens are never included.</p>

    <div class="row">
      <button id="export" class="primary">Export settings</button>
      <button id="reset" class="danger">Reset to defaults</button>
    </div>

    <h2>Import</h2>
    <input id="import-file" type="file" accept="application/json" />
    <p class="muted">Or paste JSON:</p>
    <textarea id="import-text" placeholder='{"schemaVersion":1, ...}'></textarea>
    <div class="row">
      <button id="import-apply">Import</button>
    </div>
  `;

  root.querySelector('#export')!.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'refocus-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  root.querySelector('#reset')!.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    settingsStore.setValue(DEFAULT_SETTINGS);
  });

  const fileInput = root.querySelector<HTMLInputElement>('#import-file')!;
  const textInput = root.querySelector<HTMLTextAreaElement>('#import-text')!;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    textInput.value = await file.text();
  });

  root.querySelector('#import-apply')!.addEventListener('click', async () => {
    const raw = textInput.value.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Settings;
      if (parsed.schemaVersion !== 2)
        throw new Error(`Unsupported schemaVersion: ${parsed.schemaVersion}`);
      if (!confirm('Overwrite current settings?')) return;
      await settingsStore.setValue(parsed);
    } catch (err) {
      alert(`Import failed: ${String(err)}`);
    }
  });
}
