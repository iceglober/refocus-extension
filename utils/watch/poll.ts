import { AuthError, RateLimitError, poll as pollApi } from '../github/client';
import type { GqlPr, GqlResponse } from '../github/types';
import { authStore, prStateStore, settingsStore } from '../storage';
import type { PrStateMap } from '../types';
import { diff } from './diff';
import { dispatch } from './notify';
import { emptyState, toSnapshot } from './snapshot';

export async function runPollCycle(): Promise<void> {
  const [settings, auth, states] = await Promise.all([
    settingsStore.getValue(),
    authStore.getValue(),
    prStateStore.getValue(),
  ]);
  if (!settings.watch.enabled) return;
  if (auth.mode === 'none' || !auth.token) return;

  let response: GqlResponse;
  try {
    response = await pollApi(settings.watch.explicitPrs);
  } catch (err) {
    if (err instanceof AuthError) {
      await authStore.setValue({ mode: 'none' });
      return;
    }
    if (err instanceof RateLimitError) {
      console.warn('[refocus:watch] rate limited');
      return;
    }
    console.error('[refocus:watch] poll failed', err);
    return;
  }

  const viewerLogin = response.data?.viewer.login ?? auth.login ?? '';
  if (viewerLogin && viewerLogin !== auth.login) {
    await authStore.setValue({ ...auth, login: viewerLogin });
  }

  const seen = collectPrs(response, settings.watch.autoTargets);
  const nextStates: PrStateMap = { ...states };

  for (const pr of seen) {
    const snap = toSnapshot(pr);
    const prev = states[pr.id] ?? emptyState();
    const { events, nextState } = diff(prev, snap, viewerLogin);
    nextStates[pr.id] = nextState;
    for (const ev of events) {
      await dispatch(ev);
    }
  }

  // Evict states for PRs we haven't seen in 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const id of Object.keys(nextStates)) {
    const state = nextStates[id];
    if (state && state.updatedAt < cutoff) delete nextStates[id];
  }

  await prStateStore.setValue(nextStates);
}

function collectPrs(
  response: GqlResponse,
  auto: { authored: boolean; assigned: boolean; reviewRequested: boolean },
): GqlPr[] {
  const map = new Map<string, GqlPr>();
  const add = (pr: GqlPr | null | undefined) => {
    if (pr && pr.id) map.set(pr.id, pr);
  };

  const data = response.data;
  if (!data) return [];

  if (auto.authored) data.viewer.pullRequests.nodes.forEach(add);
  if (auto.assigned) data.assigned.nodes.forEach((n) => add(n as GqlPr));
  if (auto.reviewRequested)
    data.reviewRequested.nodes.forEach((n) => add(n as GqlPr));
  data.nodes?.forEach((n) => add(n as GqlPr));

  return [...map.values()];
}
