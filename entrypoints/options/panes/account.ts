import { setPat, signOut, startOAuthFlow } from '@/utils/github/auth';
import { authStore, updateSettings } from '@/utils/storage';
import type { Settings } from '@/utils/types';
import { escapeHtml } from '@/utils/html';

export async function renderAccountPane(root: HTMLElement, settings: Settings) {
  const auth = await authStore.getValue();

  if (auth.mode === 'none') {
    root.innerHTML = `
      <h2>Account</h2>

      <div class="field">
        <label for="api-base">API base URL</label>
        <input id="api-base" type="url" value="${escapeHtml(
          settings.watch.apiBaseUrl,
        )}" />
        <p class="muted">For GitHub Enterprise, use e.g. <code>https://ghe.your-company.com/api/v3</code>.</p>
      </div>

      <h2>OAuth (Device Flow)</h2>
      <p class="muted">Register an OAuth app on your GitHub instance and paste the client ID here. Scopes required: <code>repo</code>, <code>read:user</code>.</p>
      <div class="field">
        <label for="oauth-client">OAuth Client ID</label>
        <input id="oauth-client" type="text" value="${escapeHtml(
          settings.watch.oauthClientId ?? '',
        )}" />
      </div>
      <button id="oauth-start" class="primary">Sign in with OAuth</button>

      <h2>Personal Access Token</h2>
      <p class="muted">Alternatively, paste a fine-grained PAT with <code>pull_requests:read</code>, <code>contents:read</code>, and <code>metadata:read</code>.</p>
      <div class="field">
        <label for="pat">Token</label>
        <input id="pat" type="password" autocomplete="off" />
      </div>
      <button id="pat-save" class="primary">Save PAT</button>
    `;

    const apiBase = root.querySelector<HTMLInputElement>('#api-base')!;
    apiBase.addEventListener('change', () => {
      updateSettings((s) => {
        s.watch.apiBaseUrl = apiBase.value.trim() || 'https://api.github.com';
      });
    });

    root.querySelector<HTMLInputElement>('#oauth-client')!.addEventListener(
      'change',
      (e) => {
        const val = (e.target as HTMLInputElement).value.trim();
        updateSettings((s) => {
          s.watch.oauthClientId = val;
        });
      },
    );

    root.querySelector('#oauth-start')!.addEventListener('click', async () => {
      const clientId = (
        root.querySelector<HTMLInputElement>('#oauth-client')!.value
      ).trim();
      if (!clientId) {
        alert('Enter an OAuth client ID first.');
        return;
      }
      try {
        await startOAuthFlow(clientId, apiBase.value.trim());
      } catch (err) {
        alert(`OAuth failed: ${String(err)}`);
      }
    });

    root.querySelector('#pat-save')!.addEventListener('click', async () => {
      const token = (root.querySelector<HTMLInputElement>('#pat')!.value).trim();
      if (!token) {
        alert('Paste a token first.');
        return;
      }
      try {
        await setPat(token, apiBase.value.trim());
      } catch (err) {
        alert(`PAT save failed: ${String(err)}`);
      }
    });
    return;
  }

  root.innerHTML = `
    <h2>Account</h2>
    <p>Signed in as <b>${escapeHtml(auth.login ?? '?')}</b> via ${auth.mode.toUpperCase()}.</p>
    <p class="muted">API base URL: <code>${escapeHtml(
      settings.watch.apiBaseUrl,
    )}</code></p>

    <label class="row">
      <input type="checkbox" id="watch-enabled" ${
        settings.watch.enabled ? 'checked' : ''
      } />
      <span>Enable Watch polling</span>
    </label>

    <div class="row">
      <button id="sign-out" class="danger">Sign out</button>
    </div>
  `;

  root.querySelector<HTMLInputElement>('#watch-enabled')!.addEventListener(
    'change',
    (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      updateSettings((s) => {
        s.watch.enabled = checked;
      });
    },
  );

  root.querySelector('#sign-out')!.addEventListener('click', async () => {
    if (!confirm('Sign out of GitHub?')) return;
    await signOut();
  });
}
