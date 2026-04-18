import { describe, expect, it } from 'vitest';
import { diff } from '@/utils/watch/diff';
import type { PrSnapshot } from '@/utils/watch/snapshot';
import { emptyState } from '@/utils/watch/snapshot';

const ref = {
  id: 'PR_1',
  number: 1,
  title: 'T',
  url: 'https://github.com/o/r/pull/1',
  repo: 'o/r',
};

const snapBase: PrSnapshot = {
  ref,
  sha: 'abc',
  rollupState: null,
  failingContexts: [],
  reviews: [],
  comments: [],
  mergeable: 'MERGEABLE',
  merged: false,
  closed: false,
};

describe('diff', () => {
  it('first observation emits nothing', () => {
    const { events, nextState } = diff(emptyState(), snapBase, 'me');
    expect(events).toEqual([]);
    expect(nextState.lastSeenSha).toBe('abc');
  });

  it('PENDING → SUCCESS emits checks.passed once', () => {
    const pending = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastRollupState: 'PENDING' as const,
      firstPendingAt: Date.now() - 60000,
    };
    const snap = { ...snapBase, rollupState: 'SUCCESS' as const };
    const { events, nextState } = diff(pending, snap, 'me');
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('checks.passed');

    // Second poll with same state: no event
    const { events: e2 } = diff(nextState, snap, 'me');
    expect(e2).toEqual([]);
  });

  it('PENDING → FAILURE emits checks.failed with failing context names', () => {
    const pending = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastRollupState: 'PENDING' as const,
    };
    const snap = {
      ...snapBase,
      rollupState: 'FAILURE' as const,
      failingContexts: ['lint', 'unit'],
    };
    const { events } = diff(pending, snap, 'me');
    expect(events[0]).toMatchObject({
      kind: 'checks.failed',
      failing: ['lint', 'unit'],
    });
  });

  it('new push resets timing and re-emits pending', () => {
    const prev = {
      ...emptyState(),
      lastSeenSha: 'old',
      lastRollupState: 'SUCCESS' as const,
    };
    const snap = {
      ...snapBase,
      sha: 'new',
      rollupState: 'PENDING' as const,
    };
    const { events, nextState } = diff(prev, snap, 'me');
    expect(events.some((e) => e.kind === 'checks.pending')).toBe(true);
    expect(nextState.firstPendingAt).toBeDefined();
  });

  it('merge emits once', () => {
    const prev = { ...emptyState(), lastSeenSha: 'abc' };
    const snap = { ...snapBase, merged: true, closed: true };
    const { events, nextState } = diff(prev, snap, 'me');
    expect(events.some((e) => e.kind === 'merged')).toBe(true);
    const { events: e2 } = diff(nextState, snap, 'me');
    expect(e2.some((e) => e.kind === 'merged')).toBe(false);
  });

  it('closed (not merged) emits closed', () => {
    const prev = { ...emptyState(), lastSeenSha: 'abc' };
    const snap = { ...snapBase, closed: true, merged: false };
    const { events } = diff(prev, snap, 'me');
    expect(events.some((e) => e.kind === 'closed')).toBe(true);
    expect(events.some((e) => e.kind === 'merged')).toBe(false);
  });

  it('mention detection: word boundary, case-insensitive, skip self-mentions', () => {
    const prev = { ...emptyState(), lastSeenSha: 'abc', lastCommentIds: [] };
    const snap = {
      ...snapBase,
      comments: [
        { id: 'c1', author: 'alice', body: 'hey @Austin take a look', url: 'u1' },
        { id: 'c2', author: 'austin', body: 'cc @austin', url: 'u2' }, // self-mention
        { id: 'c3', author: 'bob', body: 'contact@austin.com', url: 'u3' }, // not a mention
      ],
    };
    const { events } = diff(prev, snap, 'austin');
    const mentions = events.filter((e) => e.kind === 'mention');
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ commentId: 'c1' });
  });

  it('conflict.added fires on transition from MERGEABLE to CONFLICTING', () => {
    const prev = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastMergeable: 'MERGEABLE' as const,
    };
    const snap = { ...snapBase, mergeable: 'CONFLICTING' as const };
    const { events } = diff(prev, snap, 'me');
    expect(events.some((e) => e.kind === 'conflict.added')).toBe(true);
  });

  it('conflict.cleared fires on transition from CONFLICTING to MERGEABLE', () => {
    const prev = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastMergeable: 'CONFLICTING' as const,
    };
    const snap = { ...snapBase, mergeable: 'MERGEABLE' as const };
    const { events } = diff(prev, snap, 'me');
    expect(events.some((e) => e.kind === 'conflict.cleared')).toBe(true);
  });

  it('review.submitted fires for new reviews, not for seen ones', () => {
    const prev = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastReviewIds: ['r1'],
    };
    const snap = {
      ...snapBase,
      reviews: [
        { id: 'r1', reviewer: 'alice', state: 'COMMENTED' as const },
        { id: 'r2', reviewer: 'bob', state: 'APPROVED' as const },
      ],
    };
    const { events } = diff(prev, snap, 'me');
    const reviews = events.filter((e) => e.kind === 'review.submitted');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ reviewId: 'r2', reviewer: 'bob' });
  });

  it('no-change poll emits nothing', () => {
    const prev = {
      ...emptyState(),
      lastSeenSha: 'abc',
      lastRollupState: 'SUCCESS' as const,
      lastMergeable: 'MERGEABLE' as const,
    };
    const snap = { ...snapBase, rollupState: 'SUCCESS' as const };
    const { events } = diff(prev, snap, 'me');
    expect(events).toEqual([]);
  });
});
