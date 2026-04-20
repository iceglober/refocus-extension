import { updateSettings } from '@/utils/storage';
import type { Settings, StaleSettings } from '@/utils/types';
import { escapeHtml } from '@/utils/html';

const HOURS_OPTIONS: StaleSettings['staleAfterHours'][] = [24, 48, 168, 336];
const GRACE_OPTIONS: StaleSettings['graceMinutes'][] = [30, 60, 120];

function hoursLabel(h: number): string {
  if (h < 48) return `${h} hours`;
  return `${h / 24} days`;
}

export function renderStalePane(root: HTMLElement, settings: Settings) {
  const s = settings.stale;
  root.innerHTML = `
    <h2>Stale Tab Cleanup</h2>
    <p class="muted">Get notified about tabs you haven't visited in a while, then auto-close them after a grace period.</p>

    <div class="row">
      <label><input type="checkbox" id="stale-enabled" ${s.enabled ? 'checked' : ''} /> Enabled</label>
    </div>

    <div class="field">
      <label>Mark as stale after</label>
      <select id="stale-hours">
        ${HOURS_OPTIONS.map(
          (h) =>
            `<option value="${h}" ${h === s.staleAfterHours ? 'selected' : ''}>${hoursLabel(h)}</option>`,
        ).join('')}
      </select>
    </div>

    <div class="field">
      <label>Grace period before auto-close</label>
      <select id="stale-grace">
        ${GRACE_OPTIONS.map(
          (m) =>
            `<option value="${m}" ${m === s.graceMinutes ? 'selected' : ''}>${m} min</option>`,
        ).join('')}
      </select>
    </div>

    <div class="field">
      <label>Max tabs to auto-close per cycle</label>
      <input type="number" id="stale-max" value="${s.maxAutoClose}" min="1" max="50" style="width:80px" />
    </div>

    <h2>Stale Tabs Now</h2>
    <div id="stale-list"><p class="muted">Loading...</p></div>
  `;

  root
    .querySelector<HTMLInputElement>('#stale-enabled')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) => (st.stale.enabled = (e.target as HTMLInputElement).checked),
      );
    });

  root
    .querySelector<HTMLSelectElement>('#stale-hours')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.stale.staleAfterHours = Number(
            (e.target as HTMLSelectElement).value,
          ) as StaleSettings['staleAfterHours']),
      );
    });

  root
    .querySelector<HTMLSelectElement>('#stale-grace')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.stale.graceMinutes = Number(
            (e.target as HTMLSelectElement).value,
          ) as StaleSettings['graceMinutes']),
      );
    });

  root
    .querySelector<HTMLInputElement>('#stale-max')!
    .addEventListener('change', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (val >= 1) updateSettings((st) => (st.stale.maxAutoClose = val));
    });

  loadStaleTabs(root.querySelector('#stale-list')!);
}

async function loadStaleTabs(container: HTMLElement) {
  try {
    const resp = (await browser.runtime.sendMessage({
      kind: 'lifecycle.getStaleTabs',
    })) as { tabs: Array<{ tabId: number; title: string; url: string }> };

    if (!resp?.tabs?.length) {
      container.innerHTML = '<p class="muted">No stale tabs.</p>';
      return;
    }

    container.innerHTML = `
      <ul class="list">
        ${resp.tabs
          .map(
            (t) => `
          <li>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(t.url)}">${escapeHtml(t.title)}</span>
            <button class="close-tab danger" data-tab-id="${t.tabId}">Close</button>
            <button class="discard-tab" data-tab-id="${t.tabId}">Suspend</button>
          </li>
        `,
          )
          .join('')}
      </ul>
    `;

    container
      .querySelectorAll<HTMLButtonElement>('.close-tab')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          browser.runtime.sendMessage({
            kind: 'lifecycle.closeTab',
            tabId: Number(btn.dataset.tabId),
          });
          btn.closest('li')?.remove();
        });
      });

    container
      .querySelectorAll<HTMLButtonElement>('.discard-tab')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          browser.runtime.sendMessage({
            kind: 'lifecycle.discardTab',
            tabId: Number(btn.dataset.tabId),
          });
          btn.textContent = 'Suspended';
          btn.disabled = true;
        });
      });
  } catch {
    container.innerHTML = '<p class="muted">Could not load stale tabs.</p>';
  }
}
