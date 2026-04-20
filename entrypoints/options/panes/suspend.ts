import { updateSettings } from '@/utils/storage';
import type { Settings, SuspendSettings } from '@/utils/types';
import { escapeHtml } from '@/utils/html';

const IDLE_OPTIONS: SuspendSettings['idleMinutes'][] = [15, 30, 60, 120, 240];

export function renderSuspendPane(root: HTMLElement, settings: Settings) {
  const s = settings.suspend;
  root.innerHTML = `
    <h2>Tab Suspension</h2>
    <p class="muted">Automatically discard inactive tabs to free memory. Discarded tabs reload when clicked.</p>

    <div class="row">
      <label><input type="checkbox" id="suspend-enabled" ${s.enabled ? 'checked' : ''} /> Enabled</label>
    </div>

    <div class="field">
      <label>Suspend after idle for</label>
      <select id="suspend-idle">
        ${IDLE_OPTIONS.map(
          (m) =>
            `<option value="${m}" ${m === s.idleMinutes ? 'selected' : ''}>${m < 60 ? `${m} min` : `${m / 60} hr`}</option>`,
        ).join('')}
      </select>
    </div>

    <div class="row">
      <label><input type="checkbox" id="suspend-pinned" ${s.suspendPinned ? 'checked' : ''} /> Suspend pinned tabs</label>
    </div>

    <h2>Exempt Hosts</h2>
    <p class="muted">Tabs on these hosts will never be suspended.</p>
    <div class="row">
      <input id="exempt-input" type="text" placeholder="figma.com" style="flex:1" />
      <button id="add-exempt" class="primary">Add</button>
    </div>
    <ul class="list">
      ${s.exemptHosts
        .map(
          (h) => `
        <li>
          <code style="flex:1">${escapeHtml(h)}</code>
          <button class="remove-exempt danger" data-host="${escapeHtml(h)}">Remove</button>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;

  root
    .querySelector<HTMLInputElement>('#suspend-enabled')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.suspend.enabled = (e.target as HTMLInputElement).checked),
      );
    });

  root
    .querySelector<HTMLSelectElement>('#suspend-idle')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.suspend.idleMinutes = Number(
            (e.target as HTMLSelectElement).value,
          ) as SuspendSettings['idleMinutes']),
      );
    });

  root
    .querySelector<HTMLInputElement>('#suspend-pinned')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.suspend.suspendPinned = (e.target as HTMLInputElement).checked),
      );
    });

  const input = root.querySelector<HTMLInputElement>('#exempt-input')!;
  const add = () => {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    updateSettings((st) => {
      if (!st.suspend.exemptHosts.includes(val))
        st.suspend.exemptHosts.push(val);
    });
  };
  root.querySelector('#add-exempt')!.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  root.querySelectorAll<HTMLButtonElement>('.remove-exempt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const host = btn.dataset.host!;
      updateSettings((st) => {
        st.suspend.exemptHosts = st.suspend.exemptHosts.filter(
          (h) => h !== host,
        );
      });
    });
  });
}
