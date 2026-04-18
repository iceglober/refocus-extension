import { describe, expect, it } from 'vitest';
import { emptyState, toSnapshot } from '@/utils/watch/snapshot';
import type { GqlPr } from '@/utils/github/types';

function pr(overrides: Partial<GqlPr> = {}): GqlPr {
  return {
    id: 'PR_1',
    number: 1,
    title: 'T',
    url: 'https://github.com/o/r/pull/1',
    updatedAt: '2026-01-01T00:00:00Z',
    merged: false,
    closed: false,
    mergeable: 'MERGEABLE',
    repository: { nameWithOwner: 'o/r' },
    commits: {
      nodes: [
        {
          commit: {
            oid: 'abc',
            statusCheckRollup: null,
          },
        },
      ],
    },
    reviews: { nodes: [] },
    comments: { nodes: [] },
    ...overrides,
  };
}

describe('toSnapshot', () => {
  it('maps a vanilla PR with no checks', () => {
    const s = toSnapshot(pr());
    expect(s.sha).toBe('abc');
    expect(s.rollupState).toBeNull();
    expect(s.failingContexts).toEqual([]);
    expect(s.ref.repo).toBe('o/r');
  });

  it('maps reviews and comments with fallback author', () => {
    const s = toSnapshot(
      pr({
        reviews: {
          nodes: [
            { id: 'r1', author: { login: 'alice' }, state: 'APPROVED', submittedAt: null },
            { id: 'r2', author: null, state: 'COMMENTED', submittedAt: null },
          ],
        },
        comments: {
          nodes: [
            { id: 'c1', author: { login: 'bob' }, bodyText: 'hi', createdAt: '', url: 'u1' },
            { id: 'c2', author: null, bodyText: 'x', createdAt: '', url: 'u2' },
          ],
        },
      }),
    );
    expect(s.reviews[0]).toEqual({ id: 'r1', reviewer: 'alice', state: 'APPROVED' });
    expect(s.reviews[1]?.reviewer).toBe('unknown');
    expect(s.comments[1]?.author).toBe('unknown');
  });

  it('extracts failing CheckRun conclusions', () => {
    const s = toSnapshot(
      pr({
        commits: {
          nodes: [
            {
              commit: {
                oid: 'abc',
                statusCheckRollup: {
                  state: 'FAILURE',
                  contexts: {
                    nodes: [
                      { __typename: 'CheckRun', name: 'lint', conclusion: 'FAILURE', status: 'COMPLETED', detailsUrl: null },
                      { __typename: 'CheckRun', name: 'unit', conclusion: 'TIMED_OUT', status: 'COMPLETED', detailsUrl: null },
                      { __typename: 'CheckRun', name: 'e2e', conclusion: 'CANCELLED', status: 'COMPLETED', detailsUrl: null },
                      { __typename: 'CheckRun', name: 'ok', conclusion: 'SUCCESS', status: 'COMPLETED', detailsUrl: null },
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    );
    expect(s.rollupState).toBe('FAILURE');
    expect(s.failingContexts).toEqual(['lint', 'unit', 'e2e']);
  });

  it('extracts failing StatusContext entries', () => {
    const s = toSnapshot(
      pr({
        commits: {
          nodes: [
            {
              commit: {
                oid: 'abc',
                statusCheckRollup: {
                  state: 'ERROR',
                  contexts: {
                    nodes: [
                      { __typename: 'StatusContext', context: 'ci', state: 'ERROR', targetUrl: null },
                      { __typename: 'StatusContext', context: 'deploy', state: 'FAILURE', targetUrl: null },
                      { __typename: 'StatusContext', context: 'pass', state: 'SUCCESS', targetUrl: null },
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    );
    expect(s.failingContexts).toEqual(['ci', 'deploy']);
  });

  it('handles missing commit gracefully', () => {
    const s = toSnapshot(pr({ commits: { nodes: [] } }));
    expect(s.sha).toBe('');
    expect(s.rollupState).toBeNull();
  });
});

describe('emptyState', () => {
  it('produces a state with empty-sha sentinel', () => {
    const s = emptyState();
    expect(s.lastSeenSha).toBe('');
    expect(s.lastReviewIds).toEqual([]);
    expect(s.merged).toBe(false);
    expect(s.updatedAt).toBeGreaterThan(0);
  });
});
