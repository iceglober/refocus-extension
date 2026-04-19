import { updateSettings } from '@/utils/storage';
import type { GroupSettings, GroupRule, Settings, TabGroupColor } from '@/utils/types';
import { escapeHtml } from '@/utils/html';

const COLORS: TabGroupColor[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
];

export function renderGroupsPane(root: HTMLElement, settings: Settings) {
  const g = settings.groups;
  root.innerHTML = `
    <h2>Tab Auto-Grouping</h2>
    <p class="muted">Automatically organize tabs into groups by domain or custom rules.</p>

    <div class="row">
      <label><input type="checkbox" id="groups-enabled" ${g.enabled ? 'checked' : ''} /> Enabled</label>
    </div>

    <div class="field">
      <label>Grouping mode</label>
      <select id="groups-mode">
        <option value="domain" ${g.mode === 'domain' ? 'selected' : ''}>By domain (automatic)</option>
        <option value="rules" ${g.mode === 'rules' ? 'selected' : ''}>By custom rules</option>
      </select>
    </div>

    <div class="field">
      <label>Auto-collapse groups after (minutes, 0 = never)</label>
      <input type="number" id="groups-collapse" value="${g.collapseAfterMinutes}" min="0" style="width:80px" />
    </div>

    <div id="rules-section" ${g.mode !== 'rules' ? 'style="display:none"' : ''}>
      <h2>Group Rules</h2>
      <button id="add-group-rule" class="primary">Add rule</button>
      <table>
        <thead><tr><th>Host</th><th>Group</th><th>Color</th><th></th></tr></thead>
        <tbody>
          ${g.rules
            .map(
              (r) => `
            <tr data-id="${escapeHtml(r.id)}">
              <td><code>${escapeHtml(r.hostGlob)}</code></td>
              <td>${escapeHtml(r.groupTitle)}</td>
              <td>${escapeHtml(r.color)}</td>
              <td>
                <button class="remove-rule danger" data-id="${escapeHtml(r.id)}">Remove</button>
              </td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  root
    .querySelector<HTMLInputElement>('#groups-enabled')!
    .addEventListener('change', (e) => {
      updateSettings(
        (st) =>
          (st.groups.enabled = (e.target as HTMLInputElement).checked),
      );
    });

  root
    .querySelector<HTMLSelectElement>('#groups-mode')!
    .addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement)
        .value as GroupSettings['mode'];
      updateSettings((st) => (st.groups.mode = mode));
    });

  root
    .querySelector<HTMLInputElement>('#groups-collapse')!
    .addEventListener('change', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (val >= 0)
        updateSettings((st) => (st.groups.collapseAfterMinutes = val));
    });

  root.querySelector('#add-group-rule')?.addEventListener('click', () => {
    const host = prompt('Host glob (e.g. github.com, *.figma.com):');
    if (!host) return;
    const title = prompt('Group title:');
    if (!title) return;
    const color = (prompt(
      `Color (${COLORS.join(', ')}):`,
      'blue',
    ) ?? 'blue') as TabGroupColor;

    const rule: GroupRule = {
      id: crypto.randomUUID(),
      name: title,
      enabled: true,
      hostGlob: host.trim().toLowerCase(),
      groupTitle: title.trim(),
      color: COLORS.includes(color) ? color : 'blue',
    };

    updateSettings((st) => st.groups.rules.push(rule));
  });

  root
    .querySelectorAll<HTMLButtonElement>('.remove-rule')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!;
        updateSettings(
          (st) => (st.groups.rules = st.groups.rules.filter((r) => r.id !== id)),
        );
      });
    });
}
