import { settingsStore } from '@/utils/storage';
import type { Settings } from '@/utils/types';
import { escapeHtml } from '../ui';

export function renderHostsPane(root: HTMLElement, settings: Settings) {
  root.innerHTML = `
    <h2>Disabled Hosts</h2>
    <p class="muted">Refocus will not dedup tabs on these hosts. Supports <code>example.com</code> and <code>*.example.com</code>.</p>
    <div class="row">
      <input id="host-input" type="text" placeholder="figma.com" style="flex:1" />
      <button id="add-host" class="primary">Add</button>
    </div>
    <ul class="list">
      ${settings.dedup.disabledHosts
        .map(
          (h) => `
        <li>
          <code style="flex:1">${escapeHtml(h)}</code>
          <button class="remove danger" data-host="${escapeHtml(h)}">Remove</button>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;

  const input = root.querySelector<HTMLInputElement>('#host-input')!;
  const add = async () => {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const next = structuredClone(settings);
    if (!next.dedup.disabledHosts.includes(val))
      next.dedup.disabledHosts.push(val);
    await settingsStore.setValue(next);
  };
  root.querySelector('#add-host')!.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  root.querySelectorAll<HTMLButtonElement>('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const host = btn.dataset.host!;
      const next = structuredClone(settings);
      next.dedup.disabledHosts = next.dedup.disabledHosts.filter(
        (h) => h !== host,
      );
      await settingsStore.setValue(next);
    });
  });
}
