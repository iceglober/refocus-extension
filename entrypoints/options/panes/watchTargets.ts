import { settingsStore } from '@/utils/storage';
import type { Settings } from '@/utils/types';
import { escapeHtml } from '../ui';

const POLL_OPTIONS: Array<30 | 60 | 120 | 300> = [30, 60, 120, 300];

export function renderWatchTargetsPane(root: HTMLElement, settings: Settings) {
  const { watch } = settings;

  root.innerHTML = `
    <h2>Watch — Targets</h2>

    <div class="field">
      <label>Poll interval</label>
      <select id="poll-interval">
        ${POLL_OPTIONS.map(
          (s) =>
            `<option value="${s}" ${
              s === watch.pollIntervalSec ? 'selected' : ''
            }>${s} seconds</option>`,
        ).join('')}
      </select>
    </div>

    <h2>Automatic targets</h2>
    <label class="row">
      <input type="checkbox" id="auto-authored" ${
        watch.autoTargets.authored ? 'checked' : ''
      } />
      <span>PRs I authored</span>
    </label>
    <label class="row">
      <input type="checkbox" id="auto-assigned" ${
        watch.autoTargets.assigned ? 'checked' : ''
      } />
      <span>PRs assigned to me</span>
    </label>
    <label class="row">
      <input type="checkbox" id="auto-review" ${
        watch.autoTargets.reviewRequested ? 'checked' : ''
      } />
      <span>PRs with review requested from me</span>
    </label>

    <h2>Explicit PRs</h2>
    <p class="muted">Paste a PR URL or GraphQL node id. URLs are resolved to node ids on add.</p>
    <div class="row">
      <input id="pr-input" type="text" placeholder="https://github.com/owner/repo/pull/123" style="flex:1" />
      <button id="add-pr" class="primary">Add</button>
    </div>
    <ul class="list">
      ${watch.explicitPrs
        .map(
          (id) => `
        <li>
          <code style="flex:1">${escapeHtml(id)}</code>
          <button class="remove-pr danger" data-id="${escapeHtml(
            id,
          )}">Remove</button>
        </li>
      `,
        )
        .join('')}
    </ul>

    <h2>Explicit Repos</h2>
    <div class="row">
      <input id="repo-input" type="text" placeholder="owner/repo" style="flex:1" />
      <select id="repo-filter">
        <option value="all">All PRs</option>
        <option value="involving-me">Only involving me</option>
      </select>
      <button id="add-repo" class="primary">Add</button>
    </div>
    <ul class="list">
      ${watch.explicitRepos
        .map(
          (r) => `
        <li>
          <code style="flex:1">${escapeHtml(r.repo)}</code>
          <span class="muted">${escapeHtml(r.filter)}</span>
          <button class="remove-repo danger" data-repo="${escapeHtml(
            r.repo,
          )}">Remove</button>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;

  root.querySelector<HTMLSelectElement>('#poll-interval')!.addEventListener(
    'change',
    async (e) => {
      const val = Number((e.target as HTMLSelectElement).value) as
        | 30
        | 60
        | 120
        | 300;
      const next = structuredClone(settings);
      next.watch.pollIntervalSec = val;
      await settingsStore.setValue(next);
    },
  );

  const toggle = (
    id: string,
    field: keyof Settings['watch']['autoTargets'],
  ) => {
    root.querySelector<HTMLInputElement>(`#${id}`)!.addEventListener(
      'change',
      async (e) => {
        const next = structuredClone(settings);
        next.watch.autoTargets[field] = (
          e.target as HTMLInputElement
        ).checked;
        await settingsStore.setValue(next);
      },
    );
  };
  toggle('auto-authored', 'authored');
  toggle('auto-assigned', 'assigned');
  toggle('auto-review', 'reviewRequested');

  const prInput = root.querySelector<HTMLInputElement>('#pr-input')!;
  root.querySelector('#add-pr')!.addEventListener('click', async () => {
    const val = prInput.value.trim();
    if (!val) return;
    let prId = val;
    if (val.startsWith('http')) {
      const resp = (await browser.runtime.sendMessage({
        kind: 'watch.resolvePrId',
        url: val,
      })) as { prId?: string } | undefined;
      if (!resp?.prId) {
        alert('Could not resolve PR id from that URL. Sign in first?');
        return;
      }
      prId = resp.prId;
    }
    const next = structuredClone(settings);
    if (!next.watch.explicitPrs.includes(prId))
      next.watch.explicitPrs.push(prId);
    await settingsStore.setValue(next);
  });
  root.querySelectorAll<HTMLButtonElement>('.remove-pr').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id!;
      const next = structuredClone(settings);
      next.watch.explicitPrs = next.watch.explicitPrs.filter((x) => x !== id);
      await settingsStore.setValue(next);
    });
  });

  const repoInput = root.querySelector<HTMLInputElement>('#repo-input')!;
  const repoFilter = root.querySelector<HTMLSelectElement>('#repo-filter')!;
  root.querySelector('#add-repo')!.addEventListener('click', async () => {
    const val = repoInput.value.trim();
    if (!/^[^/]+\/[^/]+$/.test(val)) {
      alert('Repo must be in "owner/repo" form.');
      return;
    }
    const next = structuredClone(settings);
    if (!next.watch.explicitRepos.find((r) => r.repo === val)) {
      next.watch.explicitRepos.push({
        repo: val,
        filter: repoFilter.value as 'all' | 'involving-me',
      });
    }
    await settingsStore.setValue(next);
  });
  root.querySelectorAll<HTMLButtonElement>('.remove-repo').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const repo = btn.dataset.repo!;
      const next = structuredClone(settings);
      next.watch.explicitRepos = next.watch.explicitRepos.filter(
        (r) => r.repo !== repo,
      );
      await settingsStore.setValue(next);
    });
  });
}
