import { updateSettings } from '@/utils/storage';
import { ALL_EVENT_KINDS } from '@/utils/types';
import type { PrEventKind, Settings } from '@/utils/types';
import { escapeHtml } from '@/utils/html';

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
    cb.addEventListener('change', () => {
      const kind = cb.dataset.kind as PrEventKind;
      updateSettings((s) => {
        s.watch.notifyOn[kind] = cb.checked;
      });
    });
  });

  const muteInput = root.querySelector<HTMLInputElement>('#mute-input')!;
  root.querySelector('#add-mute')!.addEventListener('click', () => {
    const val = muteInput.value.trim();
    if (!/^[^/]+\/[^/]+$/.test(val)) {
      alert('Repo must be in "owner/repo" form.');
      return;
    }
    updateSettings((s) => {
      if (!s.watch.repoMutes.includes(val)) s.watch.repoMutes.push(val);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('.unmute').forEach((btn) => {
    btn.addEventListener('click', () => {
      const repo = btn.dataset.repo!;
      updateSettings((s) => {
        s.watch.repoMutes = s.watch.repoMutes.filter((r) => r !== repo);
      });
    });
  });
}
