import { matchRule } from '@/utils/rules';
import { authStore, prStateStore, settingsStore, updateSettings } from '@/utils/storage';
import { escapeHtml } from '@/utils/html';
import { safeParse } from '@/utils/urlGuards';

async function render() {
  const app = document.getElementById('app')!;
  const [settings, auth, prState, activeTabs] = await Promise.all([
    settingsStore.getValue(),
    authStore.getValue(),
    prStateStore.getValue(),
    browser.tabs.query({ active: true, currentWindow: true }),
  ]);
  const tab = activeTabs[0];

  const url = tab?.url ?? '';
  const host = url ? safeParse(url)?.host ?? '' : '';
  const hostDisabled = settings.dedup.disabledHosts.includes(host);
  const rule = url ? matchRule(url, settings.dedup.rules) : null;
  const watchedCount = Object.keys(prState).length;

  const authLine =
    auth.mode === 'none'
      ? '<span class="muted">Not signed in to GitHub</span>'
      : `Signed in as <b>${escapeHtml(auth.login ?? 'unknown')}</b> (${auth.mode})`;

  app.innerHTML = `
    <h1>Refocus</h1>

    <div class="status">${authLine}</div>

    <div class="row">
      <span>Globally enabled</span>
      <input type="checkbox" id="global" ${
        settings.dedup.globalEnabled ? 'checked' : ''
      } />
    </div>

    <div class="row">
      <span>Reuse tabs on <code>${escapeHtml(host || '—')}</code></span>
      <input type="checkbox" id="host" ${
        host && !hostDisabled ? 'checked' : ''
      } ${!host ? 'disabled' : ''} />
    </div>

    <p class="muted">Matched rule: ${rule ? escapeHtml(rule.name) : 'none'}</p>

    <div class="row">
      <span>Watch enabled</span>
      <input type="checkbox" id="watch" ${
        settings.watch.enabled ? 'checked' : ''
      } />
    </div>

    <p class="muted">Watching ${watchedCount} PR${watchedCount === 1 ? '' : 's'}</p>

    <div class="footer">
      <a id="options" href="#">Options</a>
    </div>
  `;

  document.getElementById('global')!.addEventListener('change', (e) => {
    updateSettings((s) => {
      s.dedup.globalEnabled = (e.target as HTMLInputElement).checked;
    });
  });

  document.getElementById('host')!.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    updateSettings((s) => {
      const set = new Set(s.dedup.disabledHosts);
      if (enabled) set.delete(host);
      else set.add(host);
      s.dedup.disabledHosts = [...set];
    });
  });

  document.getElementById('watch')!.addEventListener('change', (e) => {
    updateSettings((s) => {
      s.watch.enabled = (e.target as HTMLInputElement).checked;
    });
  });

  document.getElementById('options')!.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
}

render();
