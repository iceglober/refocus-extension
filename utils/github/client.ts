import { authStore, settingsStore } from '../storage';
import { POLL_QUERY, RESOLVE_PR_ID_QUERY } from './queries';
import type { GqlResponse } from './types';

export class GithubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GithubError';
  }
}
export class AuthError extends GithubError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'AuthError';
  }
}
export class RateLimitError extends GithubError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = 'RateLimitError';
  }
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const auth = await authStore.getValue();
  if (auth.mode === 'none' || !auth.token)
    throw new AuthError(401, 'Not signed in');

  const settings = await settingsStore.getValue();
  const endpoint = settings.watch.apiBaseUrl.replace(/\/$/, '') + '/graphql';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401) throw new AuthError(401, 'Token invalid');
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') throw new RateLimitError(403, 'Rate limit exceeded');
    throw new GithubError(403, 'Forbidden');
  }
  if (!res.ok) throw new GithubError(res.status, `HTTP ${res.status}`);

  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors && body.errors.length > 0)
    throw new GithubError(200, body.errors.map((e) => e.message).join('; '));
  if (!body.data) throw new GithubError(200, 'Empty response');
  return body.data;
}

export async function poll(
  explicitIds: readonly string[],
): Promise<GqlResponse> {
  // gql() returns the `data` payload; wrap it in a GqlResponse shape for the caller.
  const data = await gql<NonNullable<GqlResponse['data']>>(POLL_QUERY, {
    explicitIds,
  });
  return { data };
}

export async function resolvePrIdFromUrl(url: string): Promise<string | null> {
  try {
    const data = await gql<{ resource: { id?: string } | null }>(
      RESOLVE_PR_ID_QUERY,
      { url },
    );
    return data.resource?.id ?? null;
  } catch {
    return null;
  }
}
