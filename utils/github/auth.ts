import { authStore } from '../storage';

// Users register their own OAuth app on github.com; they paste the client ID here.
// We do NOT ship a Refocus-owned OAuth client in source.
export async function startOAuthFlow(
  clientId: string,
  apiBaseUrl: string,
): Promise<void> {
  const authBase = apiBaseUrl
    .replace(/\/api\/v3\/?$/, '')
    .replace(/\/$/, '');

  // 1. Device flow initiation
  const initRes = await fetch(`${authBase}/login/device/code`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: 'repo read:user',
    }),
  });
  if (!initRes.ok)
    throw new Error(`Device code request failed: ${initRes.status}`);
  const { device_code, user_code, verification_uri, interval } =
    (await initRes.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      interval: number;
    };

  // 2. Open the verification URL in a new tab for the user to enter the user_code.
  await browser.tabs.create({ url: verification_uri });
  // Show the device code to the user so they can enter it on GitHub.
  alert(
    `Enter this code on the page that just opened: ${user_code}\n\nClick OK, complete the flow in the browser, then come back — Refocus will poll for completion.`,
  );

  // 3. Poll until the user approves
  const token = await pollForToken(authBase, clientId, device_code, interval);

  // 4. Fetch viewer login
  const login = await fetchLogin(token, apiBaseUrl);

  await authStore.setValue({ mode: 'oauth', token, login });
}

async function pollForToken(
  authBase: string,
  clientId: string,
  deviceCode: string,
  intervalSec: number,
): Promise<string> {
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min
  let interval = intervalSec;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const res = await fetch(`${authBase}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const body = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (body.access_token) return body.access_token;
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') {
      interval += 5;
      continue;
    }
    throw new Error(
      `OAuth error: ${body.error_description ?? body.error ?? 'unknown'}`,
    );
  }
  throw new Error('OAuth device flow timed out');
}

async function fetchLogin(
  token: string,
  apiBaseUrl: string,
): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GET /user failed: ${res.status}`);
  const body = (await res.json()) as { login: string };
  return body.login;
}

// ============================================================================

export async function setPat(
  token: string,
  apiBaseUrl: string,
): Promise<void> {
  const login = await fetchLogin(token, apiBaseUrl);
  await authStore.setValue({ mode: 'pat', token, login });
}

export async function signOut(): Promise<void> {
  await authStore.setValue({ mode: 'none' });
}
