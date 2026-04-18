import { settingsStore } from '@/utils/storage';
import { ALL_EVENT_KINDS } from '@/utils/types';
import type { PrEventKind, Settings } from '@/utils/types';
import { escapeHtml } from '../ui';

const LABELS: Record<PrEventKind, string> = {
  'checks.passed': 'Checks passed',
  'checks.failed': 'Checks failed',
  'checks.pending': 'Checks started',
  'review.submitted': 'Review submitted',
  merged: 'PR merged',
  closed: 'PR closed (not merged)',
  'conflict.added': 'Conflicts appeared',
  'conflict.cleared': 'Conflicts resolved',
  mention: '@-mentioned in comment',
};

export function renderWatchNotificationsPane(
  root: HTMLElement,
  settings: Settings,
) {
  root.innerHTML = `
    <h2>Watch — Notifications</h2>

    <h2>Per-event</h2>
    ${ALL_EVENT_KINDS.map(
      (k) => `
      <label class="row">
        <input type="checkbox" class="evt" data-kind="${k}" ${
          settings.watch.notifyOn[k] ? 'checked' : ''
        } />
        <span>${escapeHtml(LABELS[k])} <code>${k}</code></span>
      </label>
    `,
    ).join('')}

    <h2>Muted repos</h2>
    <div class="row">
      <input id="mute-input" type="text" placeholder="owner/repo" style="flex:1" />
      <button id="add-mute" class="primary">Mute</button>
    </div>
    <ul class="list">
      ${settings.watch.repoMutes
        .map(
          (r) => `
        <li>
          <code style="flex:1">${escapeHtml(r)}</code>
          <button class="unmute danger" data-repo="${escapeHtml(r)}">Unmute</button>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;

  root.querySelectorAll<HTMLInputElement>('.evt').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const kind = cb.dataset.kind as PrEventKind;
      const next = structuredClone(settings);
      next.watch.notifyOn[kind] = cb.checked;
      await settingsStore.setValue(next);
    });
  });

  const muteInput = root.querySelector<HTMLInputElement>('#mute-input')!;
  root.querySelector('#add-mute')!.addEventListener('click', async () => {
    const val = muteInput.value.trim();
    if (!/^[^/]+\/[^/]+$/.test(val)) {
      alert('Repo must be in "owner/repo" form.');
      return;
    }
    const next = structuredClone(settings);
    if (!next.watch.repoMutes.includes(val)) next.watch.repoMutes.push(val);
    await settingsStore.setValue(next);
  });
  root.querySelectorAll<HTMLButtonElement>('.unmute').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const repo = btn.dataset.repo!;
      const next = structuredClone(settings);
      next.watch.repoMutes = next.watch.repoMutes.filter((r) => r !== repo);
      await settingsStore.setValue(next);
    });
  });
}
