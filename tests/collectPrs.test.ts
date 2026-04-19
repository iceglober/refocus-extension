import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/storage', () => ({
  storage: {
    defineItem: () => ({
      getValue: async () => ({}),
      setValue: async () => {},
      watch: () => () => {},
    }),
  },
}));

const { collectPrs } = await import('@/utils/watch/poll');
import type { GqlPr, GqlResponse } from '@/utils/github/types';

function pr(id: string): GqlPr {
  return {
    id,
    number: Number(id.replace(/\D/g, '')) || 0,
    title: id,
    url: `https://github.com/o/r/pull/${id}`,
    updatedAt: '',
    merged: false,
    closed: false,
    mergeable: 'MERGEABLE',
    repository: { nameWithOwner: 'o/r' },
    commits: { nodes: [] },
    reviews: { nodes: [] },
    comments: { nodes: [] },
  };
}

function resp(overrides: Partial<NonNullable<GqlResponse['data']>>): GqlResponse {
  return {
    data: {
      viewer: { login: 'me', pullRequests: { nodes: [] } },
      assigned: { nodes: [] },
      reviewRequested: { nodes: [] },
      ...overrides,
    },
  };
}

const ALL = { authored: true, assigned: true, reviewRequested: true };

describe('collectPrs', () => {
  it('returns [] for an empty response', () => {
    expect(collectPrs({}, ALL)).toEqual([]);
  });

  it('includes viewer PRs when authored is true', () => {
    const r = resp({ viewer: { login: 'me', pullRequests: { nodes: [pr('1')] } } });
    expect(collectPrs(r, ALL).map((p) => p.id)).toEqual(['1']);
    expect(collectPrs(r, { ...ALL, authored: false })).toEqual([]);
  });

  it('includes assigned + reviewRequested with respective flags', () => {
    const r = resp({
      assigned: { nodes: [{ __typename: 'PullRequest', ...pr('A') }] },
      reviewRequested: { nodes: [{ __typename: 'PullRequest', ...pr('B') }] },
    });
    expect(new Set(collectPrs(r, ALL).map((p) => p.id))).toEqual(new Set(['A', 'B']));
    expect(collectPrs(r, { ...ALL, assigned: false }).map((p) => p.id)).toEqual(['B']);
    expect(collectPrs(r, { ...ALL, reviewRequested: false }).map((p) => p.id)).toEqual(['A']);
  });

  it('always includes explicit nodes regardless of auto flags', () => {
    const r = resp({ nodes: [pr('X')] });
    expect(
      collectPrs(r, { authored: false, assigned: false, reviewRequested: false }).map(
        (p) => p.id,
      ),
    ).toEqual(['X']);
  });

  it('dedupes PRs that appear in multiple buckets', () => {
    const r = resp({
      viewer: { login: 'me', pullRequests: { nodes: [pr('dup')] } },
      assigned: { nodes: [{ __typename: 'PullRequest', ...pr('dup') }] },
    });
    expect(collectPrs(r, ALL).map((p) => p.id)).toEqual(['dup']);
  });

  it('drops null nodes', () => {
    const r = resp({
      assigned: { nodes: [null, { __typename: 'PullRequest', ...pr('ok') }] },
    });
    expect(collectPrs(r, ALL).map((p) => p.id)).toEqual(['ok']);
  });
});
